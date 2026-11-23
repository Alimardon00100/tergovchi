import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { tap } from 'rxjs';
import pino from 'pino';

export const openingLogger = pino();
type OpeningRequest = FastifyRequest<{ Params: { id?: string } }> & {
  user?: { id: string };
  openingAction?: string;
  openingScore?: number;
};

// Guards run before Nest interceptors; final responses are logged exactly once.
export function registerOpeningTelemetry(server: FastifyInstance) {
  const started = new WeakMap<FastifyRequest, number>();
  server.addHook('onRequest', (request, _reply, done) => {
    if (request.url.startsWith('/api/v2/')) started.set(request, performance.now());
    done();
  });
  server.addHook('onResponse', (request, reply, done) => {
    const req = request as OpeningRequest;
    if (request.url.startsWith('/api/v2/')) {
      const suffix = (request.url.split('?')[0] ?? '').split('/').at(-1);
      const fields = {
        event:
          reply.statusCode >= 400 ? 'caseOpening.request.failed' : 'caseOpening.request.completed',
        caseId: req.params?.id ?? null,
        userId: req.user?.id ?? null,
        requestId: request.id,
        action:
          req.openingAction ??
          (suffix === 'lock'
            ? request.method === 'POST'
              ? 'claim'
              : 'release'
            : suffix === 'submit'
              ? 'submit'
              : request.method + ' ' + request.routeOptions.url),
        duration: performance.now() - (started.get(request) ?? performance.now()),
        status: reply.statusCode,
        totalScore: req.openingScore,
      };
      if (reply.statusCode >= 500) openingLogger.error(fields);
      else if (reply.statusCode >= 400) openingLogger.warn(fields);
      else openingLogger.info(fields);
    }
    done();
  });
}
@Injectable()
export class CaseOpeningTelemetry implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<OpeningRequest>();
    req.openingAction = context.getHandler().name;
    return next.handle().pipe(
      tap((value: unknown) => {
        if (
          value &&
          typeof value === 'object' &&
          'totalScore' in value &&
          typeof value.totalScore === 'number'
        )
          req.openingScore = value.totalScore;
      }),
    );
  }
}
