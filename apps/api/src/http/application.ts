import { CaseBackup } from '../case-module/backup.service';
import { CaseController, CaseAuthController } from '../case-module/controllers';
import { CaseService } from '../case-module/case.service';
import { CaseCrypto } from '../case-module/crypto';
import { QualificationService } from '../case-module/qualification.service';
import { CaseDocuments } from '../case-module/documents.service';
import { CaseExport } from '../case-module/export.service';
import multipart from '@fastify/multipart';
import { resolve } from 'node:path';
import { MediaService, MEDIA_ROOT } from './media.service';
import 'reflect-metadata';
import { Catch, HttpException, Module } from '@nestjs/common';
import type {
  ArgumentsHost,
  ExceptionFilter,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { map } from 'rxjs';
import pino from 'pino';
import { Database } from './database';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { WorkspaceService } from './workspace.service';
import { AuthController, WorkspaceController, SystemController, HTTP_OPTIONS } from './controllers';
import type { HttpOptions } from './controllers';

const logger = pino({
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
});
@Module({})
// Nest uses this class as a metadata container for the runtime module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class HttpModule {}

@Catch()
class Errors implements ExceptionFilter {
  constructor(
    private readonly serveWeb: boolean,
    private readonly db: Database,
  ) {}
  async catch(error: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (
      this.serveWeb &&
      status === 404 &&
      request.method === 'GET' &&
      !/^\/api(?:\/|\?|$)/.test(request.url) &&
      !/\.[a-z0-9]+(?:\?|$)/i.test(request.url) &&
      request.headers.accept?.includes('text/html')
    ) {
      void reply.sendFile('index.html');
      return;
    }
    if (request.url.startsWith('/api/v1/')) {
      const actor = (request as FastifyRequest & { user?: { id: string } }).user;
      await this.db.auditLog
        .create({
          data: {
            actorId: actor?.id ?? null,
            action: 'LEGAL_REQUEST_DENIED',
            targetType: 'HTTP',
            targetId: null,
            requestId: request.id,
            ip: request.ip.slice(0, 45),
            metadata: { method: request.method, path: request.url.split('?')[0] ?? '', status },
          },
        })
        .catch(() =>
          logger.error({ event: 'legal.audit.failed', requestId: request.id }, 'Audit yozilmadi.'),
        );
    }
    const messages: Record<number, string> = {
      400: 'Kiritilgan ma’lumotlarni tekshiring.',
      401: 'Hisobga kirish kerak.',
      403: 'Bu amalga ruxsat yo‘q.',
      404: 'Ma’lumot topilmadi.',
      409: 'Ma’lumot allaqachon mavjud.',
      429: 'So‘rovlar ko‘paydi. Birozdan keyin urinib ko‘ring.',
    };
    const message =
      status === 429
        ? messages[429]
        : error instanceof HttpException && error.message && !/^[a-zA-Z ]+$/.test(error.message)
          ? error.message
          : (messages[status] ?? 'Serverda xato yuz berdi. Qayta urinib ko‘ring.');
    if (status >= 500)
      logger.error(
        {
          requestId: request.id,
          path: request.url.split('?')[0],
          status,
          errorType: error instanceof Error ? error.name : 'UnknownError',
          databaseCode:
            error instanceof Error && 'code' in error && typeof error.code === 'string'
              ? error.code
              : undefined,
        },
        'HTTP so‘rovida xato.',
      );
    void reply
      .status(status)
      .send({ success: false, error: { code: `HTTP_${status}`, message }, requestId: request.id });
  }
}

class Envelope implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    return next.handle().pipe(map((data: unknown) => ({ success: true, data, requestId: req.id })));
  }
}

export async function createApi(options: HttpOptions & { webDirectory?: string }) {
  const app = await NestFactory.create<NestFastifyApplication>(
    {
      module: HttpModule,
      imports: [
        JwtModule.register({
          secret: options.secret,
          signOptions: {
            expiresIn: '15m',
            algorithm: 'HS256',
            issuer: 'detective-board',
            audience: 'detective-web',
          },
          verifyOptions: {
            algorithms: ['HS256'],
            issuer: 'detective-board',
            audience: 'detective-web',
          },
        }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
      ],
      controllers: [
        AuthController,
        WorkspaceController,
        SystemController,
        CaseController,
        CaseAuthController,
      ],
      providers: [
        Database,
        CaseBackup,
        CaseService,
        CaseCrypto,
        QualificationService,
        CaseDocuments,
        CaseExport,
        MediaService,
        {
          provide: MEDIA_ROOT,
          useValue: options.mediaDirectory ?? resolve(process.cwd(), '.local/uploads'),
        },
        AuthService,
        SessionGuard,
        WorkspaceService,
        { provide: HTTP_OPTIONS, useValue: options },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    },
    new FastifyAdapter({ genReqId: () => randomUUID(), bodyLimit: 5 * 1024 * 1024 }),
    { logger: false },
  );
  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 1, parts: 2 },
  });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new Errors(!!options.webDirectory, app.get(Database)));
  app.useGlobalInterceptors(new Envelope());
  const server = app.getHttpAdapter().getInstance();
  server.addHook(
    'onRequest',
    (request: FastifyRequest, reply: FastifyReply, done: (error?: Error) => void) => {
      reply.header('X-Request-Id', request.id);
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      reply.header(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin) {
        const allowed = [
          `http://127.0.0.1:${process.env['PORT'] ?? '3000'}`,
          `http://localhost:${process.env['PORT'] ?? '3000'}`,
        ];
        if (process.env['NODE_ENV'] !== 'production')
          allowed.push('http://127.0.0.1:5173', 'http://localhost:5173');
        if (!allowed.includes(request.headers.origin)) {
          void reply.code(403).send({
            success: false,
            error: { code: 'ORIGIN_DENIED', message: 'So‘rov manbasiga ruxsat yo‘q.' },
            requestId: request.id,
          });
          return;
        }
      }
      done();
    },
  );
  if (options.webDirectory) {
    await app.register(staticFiles, { root: options.webDirectory, wildcard: false });
  }
  await app.init();
  await server.ready();
  return app;
}
