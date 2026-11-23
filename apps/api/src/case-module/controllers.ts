import { Database } from '../http/database';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  caseListQuerySchema,
  caseFileCreateSchema,
  personCreateSchema,
  elementSchema,
  draftWriteSchema,
  submitQualificationSchema,
  referenceWriteSchema,
  reassignSchema,
  resumeSchema,
  userRoleUpdateSchema,
  uuidSchema,
  loginSchema,
} from '@detective/shared';
import { parseInput } from '../http/controllers';
import { AuthService, ACCESS_COOKIE, API_REFRESH_COOKIE } from '../http/auth.service';
import { SessionGuard } from '../http/session.guard';
import type { UserRequest } from '../http/session.guard';
import { CaseService } from './case.service';
import { QualificationService } from './qualification.service';
import { CaseDocuments } from './documents.service';
import { CaseExport } from './export.service';
const pageSchema = z
  .object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
  .strict();
@Controller('v1/auth')
export class CaseAuthController {
  constructor(
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(Database) readonly db: Database,
  ) {}
  private record(userId: string, req: UserRequest, action: string) {
    return this.db.auditLog.create({
      data: {
        actorId: userId,
        action: 'LEGAL_AUTH_' + action,
        targetType: 'AUTH_SESSION',
        targetId: null,
        requestId: req.id,
        ip: req.ip.slice(0, 45),
        metadata: {},
      },
    });
  }
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async login(
    @Body() body: unknown,
    @Req() req: UserRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.loginBearer(parseInput(loginSchema, body), reply);
    await this.record(result.user.id, req, 'LOGIN');
    return result;
  }
  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async refresh(@Req() req: UserRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.refresh(req.cookies[API_REFRESH_COOKIE], reply, true);
    await this.record('user' in result ? result.user.id : result.id, req, 'REFRESH');
    return result;
  }
  @Post('logout')
  @UseGuards(SessionGuard)
  async logout(@Req() req: UserRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.logoutBearer(
      req.headers.authorization?.slice(7) ?? req.cookies[ACCESS_COOKIE],
      reply,
    );
    await this.record(req.user.id, req, 'LOGOUT');
    return result;
  }
}
@Controller('v1')
@UseGuards(SessionGuard)
export class CaseController {
  constructor(
    @Inject(CaseService) readonly cases: CaseService,
    @Inject(QualificationService) readonly qualifications: QualificationService,
    @Inject(CaseDocuments) readonly documents: CaseDocuments,
    @Inject(CaseExport) readonly exports: CaseExport,
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
  @Post('cases') async create(@Req() req: UserRequest, @Body() body: unknown) {
    return this.cases.create(await this.actor(req), parseInput(caseFileCreateSchema, body));
  }
  @Get('cases/:id') async preview(@Req() req: UserRequest, @Param('id') id: string) {
    return this.cases.getPreview(await this.actor(req), this.id(id));
  }
  @Get('cases/:id/workspace') async workspace(@Req() req: UserRequest, @Param('id') id: string) {
    return this.cases.workspace(await this.actor(req), this.id(id));
  }
  @Post('cases/:id/lock') async claim(@Req() req: UserRequest, @Param('id') id: string) {
    return this.cases.claim(await this.actor(req), this.id(id));
  }
  @Delete('cases/:id/lock') async release(@Req() req: UserRequest, @Param('id') id: string) {
    return this.cases.release(await this.actor(req), this.id(id));
  }
  @Get('cases/:id/persons') async persons(@Req() req: UserRequest, @Param('id') id: string) {
    return this.cases.persons(await this.actor(req), this.id(id));
  }
  @Post('cases/:id/persons') async addPerson(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.cases.addPerson(
      await this.actor(req),
      this.id(id),
      parseInput(personCreateSchema, body),
    );
  }
  @Get('cases/:id/documents') async docs(@Req() req: UserRequest, @Param('id') id: string) {
    return this.documents.list(await this.actor(req), this.id(id));
  }
  @Post('cases/:id/documents')
  @Throttle({ default: { ttl: 60000, limit: 15 } })
  async upload(@Req() req: UserRequest, @Param('id') id: string) {
    return this.documents.upload(await this.actor(req), this.id(id), req);
  }
  @Get('cases/:id/documents/:documentId/file')
  async file(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Query('token') token: unknown,
    @Res() reply: FastifyReply,
  ) {
    if (typeof token !== 'string') throw new BadRequestException('Hujjat havolasi talab qilinadi.');
    const file = await this.documents.file(
      await this.actor(req),
      this.id(id),
      this.id(documentId),
      token,
    );
    return reply
      .header('Cache-Control', 'private, no-store')
      .header('X-Frame-Options', 'SAMEORIGIN')
      .header(
        'Content-Security-Policy',
        "default-src 'self'; frame-ancestors 'self'; object-src 'self'",
      )
      .header(
        'Content-Disposition',
        'inline; filename="document.' + (file.mime === 'application/pdf' ? 'pdf' : 'webp') + '"',
      )
      .type(file.mime)
      .send(file.data);
  }
  @Get('cases/:id/qualification') async read(@Req() req: UserRequest, @Param('id') id: string) {
    return this.qualifications.read(await this.actor(req), this.id(id));
  }
  @Put('cases/:id/qualification/answers/:element') async save(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Param('element') element: string,
    @Body() body: unknown,
  ) {
    return this.qualifications.save(
      await this.actor(req),
      this.id(id),
      parseInput(elementSchema, element),
      parseInput(draftWriteSchema, body),
    );
  }
  @Post('cases/:id/qualification/submit') async submit(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.qualifications.submit(
      await this.actor(req),
      this.id(id),
      parseInput(submitQualificationSchema, body).qualificationId,
    );
  }
  @Get('cases/:id/score') async scores(@Req() req: UserRequest, @Param('id') id: string) {
    return this.qualifications.scores(await this.actor(req), this.id(id));
  }
  @Post('cases/:id/approve') async approve(@Req() req: UserRequest, @Param('id') id: string) {
    return this.cases.approve(await this.actor(req), this.id(id));
  }
  @Post('cases/:id/reassign') async reassign(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseInput(reassignSchema, body);
    return this.cases.reassign(await this.actor(req), this.id(id), input.userId, input.reason);
  }
  @Post('cases/:id/suspend') async suspend(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseInput(
      z.object({ reason: z.string().trim().min(5).max(1000) }).strict(),
      body,
    );
    return this.cases.suspend(await this.actor(req), this.id(id), input.reason);
  }
  @Post('cases/:id/resume') async resume(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parseInput(resumeSchema, body);
    return this.cases.resume(await this.actor(req), this.id(id), input.deadlineAt, input.reason);
  }
  @Get('cases/:id/export') async export(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Query('format') format: unknown,
    @Res() reply: FastifyReply,
  ) {
    const type = parseInput(z.enum(['pdf', 'docx']), format);
    const file = await this.exports.export(await this.actor(req), this.id(id), type);
    return reply
      .header('Cache-Control', 'private, no-store')
      .header('Content-Disposition', `attachment; filename="${file.filename}"`)
      .type(
        type === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      .send(file.buffer);
  }
  @Get('admin/cases/:id/reference-answers') async references(
    @Req() req: UserRequest,
    @Param('id') id: string,
  ) {
    return this.qualifications.references(await this.actor(req), this.id(id));
  }
  @Put('admin/cases/:id/reference-answers') async putReferences(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.qualifications.putReferences(
      await this.actor(req),
      this.id(id),
      parseInput(referenceWriteSchema, body),
    );
  }
  @Get('admin/users') async users(@Req() req: UserRequest, @Query() query: unknown) {
    return this.cases.users(await this.actor(req), parseInput(pageSchema, query).page);
  }
  @Patch('admin/users/:id') async user(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.cases.updateUser(
      await this.actor(req),
      this.id(id),
      parseInput(userRoleUpdateSchema, body),
    );
  }
  @Get('audit') async audits(@Req() req: UserRequest, @Query() query: unknown) {
    return this.cases.audits(await this.actor(req), parseInput(pageSchema, query).page);
  }
}
