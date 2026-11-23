import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  LEGAL_ELEMENTS,
  ELEMENT_WEIGHTS,
  completeSchemas,
  draftSchemas,
  draftViewSchema,
  draftSavedSchema,
  scoreViewSchema,
} from '@detective/shared';
import type { LegalElement } from '@detective/shared';
import { CaseService, assertEdit, assertRead, audit, editable, lockedFile } from './case.service';
import type { CaseActor, Tx } from './case.service';
import { scoreQualification } from './scoring';
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function assertPeople(
  tx: Tx,
  caseId: string,
  element: LegalElement,
  payload: unknown,
) {
  if (element !== 'SUBJECT' && element !== 'PARTICIPATION') return;
  const rows = payload as { personId: string }[];
  const ids = [...new Set(rows.map((row) => row.personId).filter(Boolean))];
  if ((await tx.casePerson.count({ where: { caseId, personId: { in: ids } } })) !== ids.length)
    throw new BadRequestException('Shaxs ushbu ish ishtirokchisi emas.');
}
@Injectable()
export class QualificationService {
  constructor(@Inject(CaseService) readonly cases: CaseService) {}
  async read(actor: CaseActor, id: string, v2 = false) {
    const file = await this.cases.file(id);
    assertRead(actor, file);
    if (['ADMIN', 'AUDITOR'].includes(actor.role))
      throw new ForbiddenException('Kvalifikatsiya javoblarini o‘qish huquqi yo‘q.');
    const qualification = await this.cases.db.qualification.findFirst({
      where: { caseId: id, ...(actor.role === 'USER' ? { createdBy: actor.id } : {}) },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: { answers: true },
    });
    await audit(this.cases.db, actor, 'QUALIFICATION_READ', id);
    return draftViewSchema.parse({
      id: qualification?.status === 'DRAFT' ? qualification.id : null,
      answers:
        qualification?.answers.map((row) => ({
          episodeId: row.episodeId,
          elementType: row.elementType,
          payload: row.payload,
          version: row.version,
          updatedAt: row.updatedAt.toISOString(),
        })) ?? [],
      attemptsUsed: file._count.scores,
      referenceReady:
        file.episodes.reduce((sum, e) => sum + e._count.references, 0) === file.episodes.length * 5,
      canEdit:
        editable(actor, file) && (v2 || ['IN_INVESTIGATION', 'SCORED'].includes(file.status)),
      serverTime: new Date().toISOString(),
    });
  }
  async save(
    actor: CaseActor,
    id: string,
    element: LegalElement,
    input: { episodeId: string; payload: unknown; baseVersion: number },
    v2 = false,
  ) {
    const parsed = draftSchemas[element].safeParse(input.payload);
    if (!parsed.success)
      throw new BadRequestException('Javob shakli noto‘g‘ri yoki izoh juda uzun.');
    await this.cases.expire(id);
    return this.cases.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      assertEdit(actor, file);
      if (
        !(
          v2 ? ['ASSIGNED', 'IN_INVESTIGATION', 'SCORED'] : ['IN_INVESTIGATION', 'SCORED']
        ).includes(file.status)
      )
        throw new ConflictException('Avval ish hujjatini oching.');
      if (!file.episodes.some((e) => e.id === input.episodeId))
        throw new BadRequestException('Epizod bu ishga tegishli emas.');
      await assertPeople(tx, id, element, parsed.data);
      let draft = await tx.qualification.findFirst({
        where: { caseId: id, createdBy: actor.id, status: 'DRAFT' },
      });
      if (!draft) {
        draft = await tx.qualification.create({ data: { caseId: id, createdBy: actor.id } });
        const previous = await tx.qualification.findFirst({
          where: { caseId: id, createdBy: actor.id, status: 'SCORED' },
          orderBy: { submittedAt: 'desc' },
          include: { answers: true },
        });
        const draftId = draft.id;
        if (previous?.answers.length)
          await tx.qualificationAnswer.createMany({
            data: previous.answers.map((a) => ({
              caseId: id,
              qualificationId: draftId,
              episodeId: a.episodeId,
              elementType: a.elementType,
              payload: json(a.payload),
              version: a.version,
            })),
          });
      }
      const key = { qualificationId: draft.id, episodeId: input.episodeId, elementType: element };
      const current = await tx.qualificationAnswer.findUnique({
        where: { qualificationId_episodeId_elementType: key },
      });
      const conflict = (current?.version ?? 0) !== input.baseVersion;
      const answer = await tx.qualificationAnswer.upsert({
        where: { qualificationId_episodeId_elementType: key },
        create: { ...key, caseId: id, payload: json(parsed.data) },
        update: { payload: json(parsed.data), version: { increment: 1 } },
      });
      await tx.qualification.update({ where: { id: draft.id }, data: { updatedAt: new Date() } });
      if (file.status === 'SCORED' || (v2 && file.status === 'ASSIGNED'))
        await tx.caseFile.update({ where: { id }, data: { status: 'IN_INVESTIGATION' } });
      await audit(tx, actor, conflict ? 'DRAFT_CONFLICT_LWW' : 'DRAFT_SAVED', id, {
        episodeId: input.episodeId,
        element,
        version: answer.version,
        baseVersion: input.baseVersion,
      });
      return draftSavedSchema.parse({
        qualificationId: draft.id,
        answer: {
          episodeId: answer.episodeId,
          elementType: answer.elementType,
          payload: answer.payload,
          version: answer.version,
          updatedAt: answer.updatedAt.toISOString(),
        },
        conflict,
      });
    });
  }
  async submit(actor: CaseActor, id: string, qualificationId: string) {
    await this.cases.expire(id);
    return this.cases.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      assertEdit(actor, file);
      const references = await tx.referenceAnswer.findMany({ where: { caseId: id } });
      if (references.length !== file.episodes.length * 5)
        throw new UnprocessableEntityException('Etalon kiritilmagan.');
      if (file.status !== 'IN_INVESTIGATION')
        throw new ConflictException('Avval ish hujjatini oching va javoblarni saqlang.');
      const qualification = await tx.qualification.findFirst({
        where: { id: qualificationId, caseId: id, createdBy: actor.id, status: 'DRAFT' },
        include: { answers: true },
      });
      if (!qualification)
        throw new ConflictException('Joriy qoralama topilmadi yoki allaqachon tekshirilgan.');
      for (const episode of file.episodes)
        for (const element of LEGAL_ELEMENTS) {
          const row = qualification.answers.find(
            (a) => a.episodeId === episode.id && a.elementType === element,
          );
          const parsed = completeSchemas[element].safeParse(row?.payload);
          if (!parsed.success)
            throw new BadRequestException(
              `${episode.episodeNumber}-epizod: ${element} bo‘limini to‘liq to‘ldiring.`,
            );
          await assertPeople(tx, id, element, parsed.data);
        }
      const breakdown = scoreQualification(
        file.episodes.map((e) => ({
          id: e.id,
          episodeNumber: e.episodeNumber,
          weight: Number(e.weight),
        })),
        references,
        qualification.answers,
      );
      const attemptNumber = file._count.scores + 1;
      await tx.qualification.update({
        where: { id: qualificationId },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });
      await tx.caseFile.update({ where: { id }, data: { status: 'QUALIFICATION_SUBMITTED' } });
      await audit(tx, actor, 'QUALIFICATION_SUBMITTED', id, { qualificationId, attemptNumber });
      const score = await tx.caseScore.create({
        data: {
          caseId: id,
          qualificationId,
          attemptNumber,
          totalScore: breakdown.total,
          breakdown: json(breakdown),
          referenceRevision: file.referenceRevision,
          referenceSnapshot: json(
            references.map((r) => ({
              episodeId: r.episodeId,
              elementType: r.elementType,
              payload: r.payload,
              weight: Number(r.weight),
            })),
          ),
        },
      });
      await tx.qualification.update({ where: { id: qualificationId }, data: { status: 'SCORED' } });
      await tx.caseFile.update({ where: { id }, data: { status: 'SCORED' } });
      await audit(tx, actor, 'SCORED', id, {
        qualificationId,
        attemptNumber,
        totalScore: breakdown.total,
        referenceRevision: file.referenceRevision,
      });
      return scoreViewSchema.parse({
        id: score.id,
        qualificationId,
        createdBy: actor.id,
        investigator: actor.displayName,
        attemptNumber,
        totalScore: Number(score.totalScore),
        referenceRevision: score.referenceRevision,
        scoredAt: score.scoredAt.toISOString(),
        breakdown: score.breakdown,
      });
    });
  }
  async scores(actor: CaseActor, id: string) {
    const file = await this.cases.file(id);
    if (actor.role === 'USER') {
      if (
        file.assignedTergovchiId !== actor.id &&
        !(await this.cases.db.qualification.count({ where: { caseId: id, createdBy: actor.id } }))
      )
        throw new ForbiddenException('Faqat o‘z natijalaringizni ko‘rasiz.');
    } else assertRead(actor, file);
    const rows = await this.cases.db.caseScore.findMany({
      where: {
        caseId: id,
        ...(actor.role === 'USER' ? { qualification: { createdBy: actor.id } } : {}),
      },
      include: {
        qualification: { include: { author: { select: { id: true, displayName: true } } } },
      },
      orderBy: { attemptNumber: 'asc' },
    });
    await audit(this.cases.db, actor, 'SCORES_READ', id);
    const items = rows.map((row) =>
      scoreViewSchema.parse({
        id: row.id,
        qualificationId: row.qualificationId,
        createdBy: row.qualification.createdBy,
        investigator: row.qualification.author.displayName,
        attemptNumber: row.attemptNumber,
        totalScore: Number(row.totalScore),
        referenceRevision: row.referenceRevision,
        scoredAt: row.scoredAt.toISOString(),
        breakdown: row.breakdown,
      }),
    );
    return {
      items,
      best: items.length ? Math.max(...items.map((row) => row.totalScore)) : null,
      attemptsUsed: file._count.scores,
      maxAttempts: 3 as const,
    };
  }
  async references(actor: CaseActor, id: string) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Etalon faqat administrator uchun.');
    const file = await this.cases.file(id);
    const answers = await this.cases.db.referenceAnswer.findMany({
      where: { caseId: id },
      orderBy: [{ episodeId: 'asc' }, { elementType: 'asc' }],
    });
    await audit(this.cases.db, actor, 'REFERENCE_READ', id);
    return {
      revision: file.referenceRevision,
      weights: ELEMENT_WEIGHTS,
      answers: answers.map((r) => ({
        episodeId: r.episodeId,
        elementType: r.elementType,
        payload: r.payload,
      })),
    };
  }
  async putReferences(
    actor: CaseActor,
    id: string,
    input: {
      revision: number;
      answers: { episodeId: string; elementType: LegalElement; payload: unknown }[];
    },
  ) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Etalon faqat administrator uchun.');
    return this.cases.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      if (file.status === 'CLOSED')
        throw new ConflictException('Yopilgan ish etaloni o‘zgarmaydi.');
      if (file.referenceRevision !== input.revision)
        throw new ConflictException('Etalon yangilangan. Qayta yuklang.');
      const keys = new Set(input.answers.map((a) => a.episodeId + ':' + a.elementType));
      if (
        keys.size !== input.answers.length ||
        keys.size !== file.episodes.length * 5 ||
        file.episodes.some((e) => LEGAL_ELEMENTS.some((el) => !keys.has(e.id + ':' + el)))
      )
        throw new BadRequestException('Har epizod uchun beshta yagona etalon kerak.');
      for (const row of input.answers) {
        const parsed = completeSchemas[row.elementType].safeParse(row.payload);
        if (!parsed.success)
          throw new BadRequestException('Etalonning barcha bo‘limlarini to‘ldiring.');
        await assertPeople(tx, id, row.elementType, parsed.data);
        await tx.referenceAnswer.upsert({
          where: {
            caseId_episodeId_elementType: {
              caseId: id,
              episodeId: row.episodeId,
              elementType: row.elementType,
            },
          },
          create: {
            caseId: id,
            episodeId: row.episodeId,
            elementType: row.elementType,
            payload: json(parsed.data),
            weight: ELEMENT_WEIGHTS[row.elementType],
          },
          update: { payload: json(parsed.data), weight: ELEMENT_WEIGHTS[row.elementType] },
        });
      }
      await tx.caseFile.update({ where: { id }, data: { referenceRevision: { increment: 1 } } });
      await audit(tx, actor, 'REFERENCE_UPDATED', id, {
        revision: file.referenceRevision + 1,
        elements: keys.size,
      });
      return { revision: file.referenceRevision + 1 };
    });
  }
}
