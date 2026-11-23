import { HttpException, Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { tap } from 'rxjs';
import pino from 'pino';
import type { UserRequest } from '../http/session.guard';

export const openingLogger = pino();
@Injectable()
export class CaseOpeningTelemetry implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<UserRequest & { params: { id?: string } }>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const started = performance.now();
    const record = (failed: boolean, value?: unknown) => {
      const totalScore =
        value && typeof value === 'object' && 'totalScore' in value ? value.totalScore : undefined;
      const fields = {
        event: failed ? 'caseOpening.request.failed' : 'caseOpening.request.completed',
        caseId: req.params.id ?? null,
        userId: req.user.id,
        action: context.getHandler().name,
        requestId: req.id,
        duration: performance.now() - started,
        status: failed
          ? value instanceof HttpException
            ? value.getStatus()
            : 500
          : reply.statusCode,
        totalScore,
      };
      if (failed && fields.status >= 500) openingLogger.error(fields);
      else if (failed) openingLogger.warn(fields);
      else openingLogger.info(fields);
    };
    return next.handle().pipe(
      tap({
        next: (value) => record(false, value),
        error: (error: unknown) => record(true, error),
      }),
    );
  }
}
