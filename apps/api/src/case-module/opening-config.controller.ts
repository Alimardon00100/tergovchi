import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { caseOpeningEventSchema } from '@detective/shared';
import { SessionGuard } from '../http/session.guard';
import type { UserRequest } from '../http/session.guard';
import { parseInput } from '../http/controllers';
import { CaseService, audit } from './case.service';
import { CaseOpeningService } from './opening.service';
import { caseOpeningV2Enabled } from './flags';
import { openingLogger } from './opening-telemetry';

@Injectable()
export class CaseOpeningGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<UserRequest>();
    if (!caseOpeningV2Enabled(req.user.id)) throw new NotFoundException('Sahifa topilmadi.');
    return true;
  }
}
@Controller('case-opening')
@UseGuards(SessionGuard)
export class CaseOpeningConfigController {
  constructor(
    @Inject(CaseService) readonly cases: CaseService,
    @Inject(CaseOpeningService) readonly opening: CaseOpeningService,
  ) {}
  @Get('config') async config(@Req() req: UserRequest) {
    const actor = await this.cases.actor(req.user, req.id, req.ip);
    await audit(this.cases.db, actor, 'OPENING_CONFIG_READ', null);
    return { enabled: caseOpeningV2Enabled(req.user.id) };
  }
  @Post('events')
  @UseGuards(CaseOpeningGuard)
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  async event(@Req() req: UserRequest, @Body() input: unknown) {
    const body = parseInput(caseOpeningEventSchema, input);
    const result = await this.opening.visit(
      await this.cases.actor(req.user, req.id, req.ip),
      body.caseId,
      body.tab,
    );
    openingLogger.info({
      event: 'caseOpening.tab.visited',
      caseId: body.caseId,
      userId: req.user.id,
      action: body.tab,
      requestId: req.id,
    });
    return result;
  }
}
