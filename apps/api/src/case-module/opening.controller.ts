import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import {
  answerWriteV2Schema,
  caseFileCreateSchema,
  caseListQuerySchema,
  personCreateV2Schema,
  referenceWriteSchema,
  submitQualificationSchema,
  uuidSchema,
} from '@detective/shared';
import { SessionGuard } from '../http/session.guard';
import type { UserRequest } from '../http/session.guard';
import { parseInput } from '../http/controllers';
import { CaseService } from './case.service';
import { QualificationService } from './qualification.service';
import { CaseDocuments } from './documents.service';
import { CaseOpeningGuard } from './opening-config.controller';
import { CaseOpeningService } from './opening.service';
import { CaseOpeningTelemetry } from './opening-telemetry';
import { CASE_OPENING_LIMITS } from './flags';

@Controller('v2')
@UseGuards(SessionGuard, CaseOpeningGuard)
@UseInterceptors(CaseOpeningTelemetry)
export class CaseOpeningController {
  constructor(
    @Inject(CaseService) readonly cases: CaseService,
    @Inject(QualificationService) readonly qualification: QualificationService,
    @Inject(CaseDocuments) readonly documents: CaseDocuments,
    @Inject(CaseOpeningService) readonly opening: CaseOpeningService,
  ) {}
  actor(req: UserRequest) {
    return this.cases.actor(req.user, req.id, req.ip);
  }
  id(value: string) {
    return parseInput(uuidSchema, value);
  }
  @Get('meta') async meta(@Req() req: UserRequest) {
    return this.cases.meta(await this.actor(req), req.user);
  }
  @Get('cases') async list(@Req() req: UserRequest, @Query() query: unknown) {
    return this.cases.list(await this.actor(req), parseInput(caseListQuerySchema, query));
  }
  @Post('cases') async create(@Req() req: UserRequest, @Body() input: unknown) {
    return this.cases.create(await this.actor(req), parseInput(caseFileCreateSchema, input));
  }
  @Get('cases/:id') async preview(@Req() req: UserRequest, @Param('id') id: string) {
    return this.cases.getPreview(await this.actor(req), this.id(id));
  }
  @Get('cases/:id/workspace') async workspace(@Req() req: UserRequest, @Param('id') id: string) {
    return this.cases.workspace(await this.actor(req), this.id(id));
  }
  @Post('cases/:id/lock') @HttpCode(200) async claim(
    @Req() req: UserRequest,
    @Param('id') id: string,
  ) {
    return this.cases.claim(await this.actor(req), this.id(id));
  }
  @Delete('cases/:id/lock') async release(@Req() req: UserRequest, @Param('id') id: string) {
    return this.cases.release(await this.actor(req), this.id(id));
  }
  @Get('cases/:id/documents') async docs(@Req() req: UserRequest, @Param('id') id: string) {
    return this.documents.list(await this.actor(req), this.id(id), 'v2');
  }
  @Get('cases/:id/documents/:documentId/file') async file(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Query('token') token: unknown,
    @Res() reply: FastifyReply,
  ) {
    const file = await this.documents.file(
      await this.actor(req),
      this.id(id),
      this.id(documentId),
      typeof token === 'string' ? token : '',
      'v2',
    );
    return reply
      .header('Cache-Control', 'private, no-store')
      .header('X-Frame-Options', 'SAMEORIGIN')
      .header(
        'Content-Disposition',
        'inline; filename="document.' + (file.mime === 'application/pdf' ? 'pdf' : 'webp') + '"',
      )
      .type(file.mime)
      .send(file.data);
  }
  @Get('cases/:id/persons') async persons(@Req() req: UserRequest, @Param('id') id: string) {
    return this.opening.persons(await this.actor(req), this.id(id));
  }
  @Post('cases/:id/persons') async addPerson(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.opening.addPerson(
      await this.actor(req),
      this.id(id),
      parseInput(personCreateV2Schema, input),
    );
  }
  @Get('cases/:id/qualification') async read(@Req() req: UserRequest, @Param('id') id: string) {
    return this.qualification.read(await this.actor(req), this.id(id), true);
  }
  @Put('cases/:id/qualification/answers') async save(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    const body = parseInput(answerWriteV2Schema, input);
    return this.qualification.save(
      await this.actor(req),
      this.id(id),
      body.elementType,
      body,
      true,
    );
  }
  @Post('cases/:id/qualification/submit')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: CASE_OPENING_LIMITS.submitPerMinute } })
  async submit(@Req() req: UserRequest, @Param('id') id: string, @Body() input: unknown) {
    return this.qualification.submit(
      await this.actor(req),
      this.id(id),
      parseInput(submitQualificationSchema, input).qualificationId,
    );
  }
  @Get('cases/:id/score') async score(@Req() req: UserRequest, @Param('id') id: string) {
    return this.qualification.scores(await this.actor(req), this.id(id));
  }
  @Get('admin/cases/:id/reference-answers') async references(
    @Req() req: UserRequest,
    @Param('id') id: string,
  ) {
    return this.qualification.references(await this.actor(req), this.id(id));
  }
  @Put('admin/cases/:id/reference-answers') async putReferences(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.qualification.putReferences(
      await this.actor(req),
      this.id(id),
      parseInput(referenceWriteSchema, input),
    );
  }
}
