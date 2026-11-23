import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { PublicUser } from '@detective/shared';
import { ACCESS_COOKIE, AuthService } from './auth.service';

export type UserRequest = FastifyRequest & { user: PublicUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<UserRequest>();
    const authorization = request.headers.authorization;
    const token =
      authorization === undefined
        ? request.cookies[ACCESS_COOKIE]
        : /^Bearer [A-Za-z0-9_.-]+$/.test(authorization)
          ? authorization.slice(7)
          : undefined;
    request.user = await this.auth.authenticate(token);
    return true;
  }
}
