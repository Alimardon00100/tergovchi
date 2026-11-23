import { MediaService } from './media.service';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import {
  caseWriteSchema,
  idempotencyKeySchema,
  loginSchema,
  profileUpdateSchema,
  passwordChangeSchema,
  registerSchema,
  resolveCasePoints,
  uuidSchema,
} from '@detective/shared';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { AuthService, REFRESH_COOKIE } from './auth.service';
import { Database, publicUser } from './database';
import { SessionGuard } from './session.guard';
import type { UserRequest } from './session.guard';
import { WorkspaceService } from './workspace.service';

export const HTTP_OPTIONS = Symbol('HTTP_OPTIONS');
export type HttpOptions = {
  secret: string;
  workspaceId: string;
  controlToken: string;
  shutdown: () => void;
  mediaDirectory?: string;
  caseFilesDirectory?: string;
  backupEnabled?: boolean;
};
export function parseInput<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException('Kiritilgan ma’lumotlarni tekshiring.');
  return result.data;
}

@Controller('auth')
@Throttle({ default: { ttl: 60000, limit: 20 } })
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post('register') register(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.register(parseInput(registerSchema, body), reply, req.id);
  }
  @Post('login') login(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.auth.login(parseInput(loginSchema, body), reply);
  }
  @Post('refresh') refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.refresh(req.cookies[REFRESH_COOKIE], reply);
  }
  @Post('logout') logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.logout(req.cookies[REFRESH_COOKIE], reply);
  }
  @Get('me') @Throttle({ default: { ttl: 60000, limit: 120 } }) @UseGuards(SessionGuard) me(
    @Req() req: UserRequest,
  ) {
    return req.user;
  }
}

@Controller()
@UseGuards(SessionGuard)
export class WorkspaceController {
  constructor(
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
    @Inject(Database) private readonly db: Database,
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}
  @Get('workspace') state(@Req() req: UserRequest) {
    return this.workspace.state(req.user.id);
  }
  @Post('cases/:id/open') open(@Param('id') id: string, @Req() req: UserRequest) {
    return this.workspace.open(
      req.user.id,
      parseInput(uuidSchema, id),
      parseInput(idempotencyKeySchema, req.headers['idempotency-key']),
      req.id,
    );
  }
  @Post('cases/:id/close') close(@Param('id') id: string, @Req() req: UserRequest) {
    return this.workspace.close(req.user.id, parseInput(uuidSchema, id), req.id);
  }
  @Get('users/me') profile(@Req() req: UserRequest) {
    return this.workspace.profile(req.user.id);
  }
  @Get('users/me/cases') cases(@Req() req: UserRequest) {
    return this.workspace.profileCases(req.user.id);
  }
  @Patch('users/me/password')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  password(
    @Body() body: unknown,
    @Req() req: UserRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.changePassword(
      req.user.id,
      parseInput(passwordChangeSchema, body),
      reply,
      req.id,
    );
  }
  @Patch('users/me') async update(@Body() body: unknown, @Req() req: UserRequest) {
    return publicUser(
      await this.db.user.update({
        where: { id: req.user.id },
        data: parseInput(profileUpdateSchema, body),
      }),
    );
  }
  @Post('admin/cases')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async create(@Req() req: UserRequest) {
    if (req.user.role !== 'ADMIN')
      throw new ForbiddenException('Bu amal faqat administrator uchun.');
    const upload = await this.media.upload(req, true);
    const data = parseInput(
      caseWriteSchema.omit({ slug: true, publication: true, coverAssetKey: true }),
      upload.data,
    );
    const slug =
      data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 70) +
      '-' +
      randomUUID().slice(0, 8);
    const key = await this.media.save('cases', req.user.id, upload.image);
    try {
      return await this.db.$transaction(async (tx) => {
        const created = await tx.case.create({
          data: {
            ...data,
            slug,
            publication: 'PUBLISHED',
            coverAssetKey: key,
            basePoints: resolveCasePoints(data.difficulty, null),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: req.user.id,
            action: 'CASE_CREATED',
            targetType: 'CASE',
            targetId: created.id,
            requestId: req.id,
            metadata: { title: created.title },
          },
        });
        return { id: created.id };
      });
    } catch (error) {
      await this.media.remove(key).catch(() => undefined);
      throw error;
    }
  }
  @Post('users/me/avatar')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async avatar(@Req() req: UserRequest) {
    const upload = await this.media.upload(req, false);
    const key = await this.media.save('avatars', req.user.id, upload.image);
    let result;
    try {
      result = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${req.user.id}::uuid FOR UPDATE`;
        const previous = await tx.user.findUniqueOrThrow({
          where: { id: req.user.id },
          select: { avatarKey: true },
        });
        const user = await tx.user.update({ where: { id: req.user.id }, data: { avatarKey: key } });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'AVATAR_UPDATED',
            targetType: 'USER',
            targetId: user.id,
            requestId: req.id,
          },
        });
        return { user: publicUser(user), previous: previous.avatarKey };
      });
    } catch (error) {
      await this.media.remove(key).catch(() => undefined);
      throw error;
    }
    // A committed avatar remains usable if old-file cleanup fails.
    await this.media.remove(result.previous).catch(() => undefined);
    return result.user;
  }
  @Get('media/:kind/:owner/:file')
  async image(
    @Param('kind') kind: string,
    @Param('owner') owner: string,
    @Param('file') file: string,
    @Req() req: UserRequest,
    @Res() reply: FastifyReply,
  ) {
    parseInput(uuidSchema, owner);
    const key = `${kind}/${owner}/${file}`;
    const allowed =
      kind === 'avatars'
        ? await this.db.user.count({ where: { avatarKey: key, bannedAt: null } })
        : kind === 'cases'
          ? await this.db.case.count({
              where: {
                coverAssetKey: key,
                ...(req.user.role === 'ADMIN' ? {} : { publication: 'PUBLISHED' }),
              },
            })
          : 0;
    if (!allowed) throw new ForbiddenException('Bu rasmga ruxsat yo‘q.');
    const buffer = await this.media.read(key);
    reply.header('Cache-Control', 'private, max-age=300').type('image/webp').send(buffer);
  }
}

@Controller()
export class SystemController {
  constructor(
    @Inject(HTTP_OPTIONS) private readonly options: HttpOptions,
    @Inject(Database) private readonly db: Database,
  ) {}
  @Get('health') async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'detective-board', workspaceId: this.options.workspaceId };
  }
  @Post('internal/shutdown') shutdown(@Req() req: FastifyRequest) {
    const token = req.headers['x-runtime-token'];
    if (
      !this.options.controlToken ||
      typeof token !== 'string' ||
      Buffer.byteLength(token) !== Buffer.byteLength(this.options.controlToken) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(this.options.controlToken))
    )
      throw new ForbiddenException();
    setTimeout(this.options.shutdown, 150).unref();
    return { stopping: true };
  }
}
