import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { hash, verify, argon2id } from 'argon2';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { RegisterInput, LoginInput, PasswordChangeInput } from '@detective/shared';
import type { FastifyReply } from 'fastify';
import { Database, publicUser } from './database';

const ACCESS_SECONDS = 15 * 60;
const REFRESH_SECONDS = 7 * 24 * 60 * 60;
export const ACCESS_COOKIE = 'tergov_access';
export const REFRESH_COOKIE = 'tergov_refresh';
export const API_REFRESH_COOKIE = 'tergov_api_refresh';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  private cookies(
    reply: FastifyReply,
    userId: string,
    familyId: string,
    refresh: string,
    bearer = false,
  ) {
    const options = {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: process.env['COOKIE_SECURE'] === 'true',
    };
    const accessToken = this.jwt.sign({ sub: userId, sid: familyId });
    reply.setCookie(ACCESS_COOKIE, accessToken, {
      ...options,
      path: '/',
      maxAge: ACCESS_SECONDS,
    });
    reply.setCookie(bearer ? API_REFRESH_COOKIE : REFRESH_COOKIE, refresh, {
      ...options,
      path: bearer ? '/api/v1/auth' : '/api/auth',
      maxAge: REFRESH_SECONDS,
    });
    return accessToken;
  }

  private async passwordMatches(stored: string, password: string) {
    if (/^\$2[aby]\$/.test(stored)) {
      return (
        !bcrypt.truncates(password) && (await bcrypt.compare(password, stored).catch(() => false))
      );
    }
    return stored.startsWith('$argon2') && (await verify(stored, password).catch(() => false));
  }
  private async session(userId: string, expectedHash: string, reply: FastifyReply, bearer = false) {
    const refresh = randomBytes(32).toString('hex');
    const familyId = randomUUID();
    // Login, refresh and password changes acquire the user lock first.
    const user = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (current.passwordHash !== expectedHash || current.bannedAt)
        throw new UnauthorizedException('Parol o‘zgargan. Qayta kiring.');
      await tx.refreshToken.create({
        data: {
          userId,
          tokenHash: digest(refresh),
          familyId,
          expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000),
        },
      });
      return publicUser(current);
    });
    const accessToken = this.cookies(reply, userId, familyId, refresh, bearer);
    return { user, accessToken };
  }
  async register(input: RegisterInput, reply: FastifyReply, requestId: string) {
    const passwordHash = await hash(input.password, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    try {
      const user = await this.db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email: input.email, displayName: input.displayName, passwordHash, role: 'USER' },
        });
        await tx.auditLog.create({
          data: {
            actorId: created.id,
            action: 'AUTH_REGISTER',
            targetType: 'USER',
            targetId: created.id,
            requestId,
          },
        });
        return publicUser(created);
      });
      return (await this.session(user.id, passwordHash, reply)).user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Bu elektron pochta allaqachon ro‘yxatdan o‘tgan.');
      throw error;
    }
  }

  async login(input: LoginInput, reply: FastifyReply) {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const valid = user ? await this.passwordMatches(user.passwordHash, input.password) : false;
    if (!user || !valid || user.bannedAt)
      throw new UnauthorizedException('Elektron pochta yoki parol noto‘g‘ri.');
    return (await this.session(user.id, user.passwordHash, reply)).user;
  }

  async loginBearer(input: LoginInput, reply: FastifyReply) {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    if (!user || user.bannedAt || !(await this.passwordMatches(user.passwordHash, input.password)))
      throw new UnauthorizedException('Elektron pochta yoki parol noto‘g‘ri.');
    const session = await this.session(user.id, user.passwordHash, reply, true);
    return { ...session, tokenType: 'Bearer', expiresIn: ACCESS_SECONDS };
  }

  async refresh(raw: string | undefined, reply: FastifyReply, bearer = false) {
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) throw new UnauthorizedException('Qayta kirish kerak.');
    const next = randomBytes(32).toString('hex');
    // DECISION: reuse aniqlanganda revocation commit qilinadi; exception tranzaksiyadan tashqarida chiqariladi.
    const result = await this.db.$transaction(async (tx) => {
      const owner = await tx.refreshToken.findUnique({
        where: { tokenHash: digest(raw) },
        select: { userId: true },
      });
      if (!owner) return null;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${owner.userId}::uuid FOR UPDATE`;
      await tx.$executeRaw`SELECT id FROM "RefreshToken" WHERE "tokenHash" = ${digest(raw)} FOR UPDATE`;
      const current = await tx.refreshToken.findUnique({
        where: { tokenHash: digest(raw) },
        include: { user: true },
      });
      if (!current) return null;
      if (current.revokedAt || current.expiresAt <= new Date() || current.user.bannedAt) {
        await tx.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      const replacement = await tx.refreshToken.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: digest(next),
          expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000),
        },
      });
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { revokedAt: new Date(), replacedById: replacement.id },
      });
      return { user: publicUser(current.user), familyId: current.familyId };
    });
    if (!result) {
      this.clear(reply);
      throw new UnauthorizedException('Sessiya tugagan. Qayta kiring.');
    }
    const accessToken = this.cookies(reply, result.user.id, result.familyId, next, bearer);
    return bearer
      ? { user: result.user, accessToken, tokenType: 'Bearer', expiresIn: ACCESS_SECONDS }
      : result.user;
  }

  async authenticate(raw: string | undefined) {
    let payload: { sub: string; sid: string };
    try {
      if (!raw) throw new UnauthorizedException();
      payload = this.jwt.verify<{ sub: string; sid: string }>(raw);
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string')
        throw new UnauthorizedException();
    } catch {
      throw new UnauthorizedException('Hisobga kirish kerak.');
    }
    const [user, session] = await Promise.all([
      this.db.user.findUnique({ where: { id: payload.sub } }),
      this.db.refreshToken.findFirst({
        where: {
          userId: payload.sub,
          familyId: payload.sid,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }),
    ]);
    if (!user || user.bannedAt || !session) throw new UnauthorizedException();
    return publicUser(user);
  }

  async changePassword(
    userId: string,
    input: PasswordChangeInput,
    reply: FastifyReply,
    requestId: string,
  ) {
    const current = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (current.bannedAt || !(await this.passwordMatches(current.passwordHash, input.oldPassword)))
      throw new BadRequestException('Amaldagi parol noto‘g‘ri.');
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await this.db.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: userId, passwordHash: current.passwordHash, bannedAt: null },
        data: { passwordHash },
      });
      if (changed.count !== 1)
        throw new ConflictException('Parol boshqa oynada o‘zgargan. Qayta kiring.');
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'PASSWORD_CHANGED',
          targetType: 'USER',
          targetId: userId,
          requestId,
        },
      });
    });
    this.clear(reply);
    return { changed: true as const };
  }
  clear(reply: FastifyReply) {
    reply.clearCookie(ACCESS_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    reply.clearCookie(API_REFRESH_COOKIE, { path: '/api/v1/auth' });
  }

  async logoutBearer(raw: string | undefined, reply: FastifyReply) {
    if (raw) {
      const payload = this.jwt.verify<{ sid: string }>(raw);
      await this.db.refreshToken.updateMany({
        where: { familyId: payload.sid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.clear(reply);
    return { loggedOut: true };
  }
  async logout(raw: string | undefined, reply: FastifyReply) {
    if (raw) {
      const token = await this.db.refreshToken.findUnique({ where: { tokenHash: digest(raw) } });
      if (token)
        await this.db.refreshToken.updateMany({
          where: { familyId: token.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
    }
    this.clear(reply);
    return { loggedOut: true };
  }
}
