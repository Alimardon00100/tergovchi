import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { personV2Schema } from '@detective/shared';
import type { PersonCreateV2 } from '@detective/shared';
import { CaseService, assertRead, audit, lockedFile } from './case.service';
import type { CaseActor } from './case.service';

@Injectable()
export class CaseOpeningService {
  constructor(@Inject(CaseService) readonly cases: CaseService) {}
  async persons(actor: CaseActor, id: string) {
    const people = await this.cases.persons(actor, id);
    const rows = await this.cases.db.casePerson.findMany({
      where: { caseId: id },
      include: { person: true },
    });
    return people.map((person) => {
      const row = rows.find((item) => item.personId === person.id)?.person;
      const detail = (value: string | null | undefined) =>
        value ? (person.masked ? '[YASHIRILGAN]' : this.cases.crypto.decrypt(value)) : null;
      return personV2Schema.parse({
        ...person,
        contact: detail(row?.contactEncrypted),
        note: detail(row?.noteEncrypted),
      });
    });
  }
  async addPerson(actor: CaseActor, id: string, input: PersonCreateV2) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Faqat administrator shaxs qo‘shadi.');
    if (new Date(input.birthDate) > new Date())
      throw new BadRequestException('Tug‘ilgan sana kelajakda bo‘lmasin.');
    return this.cases.db.$transaction(async (tx) => {
      const file = await lockedFile(tx, id);
      if (file.status !== 'NEW')
        throw new ConflictException('Shaxslar ish biriktirilishidan oldin kiritiladi.');
      const encrypt = (value: string | null) => (value ? this.cases.crypto.encrypt(value) : null);
      const person = await tx.person.create({
        data: {
          fullName: input.fullName,
          birthDate: new Date(input.birthDate),
          gender: input.gender,
          addressEncrypted: this.cases.crypto.encrypt(input.address),
          pinflEncrypted: encrypt(input.pinfl),
          pinflLast4: input.pinfl?.slice(-4) ?? null,
          photoUrl: input.photoUrl,
          contactEncrypted: encrypt(input.contact),
          noteEncrypted: encrypt(input.note),
        },
      });
      await tx.casePerson.create({ data: { caseId: id, personId: person.id, role: input.role } });
      await audit(tx, actor, 'PERSON_CREATED_V2', id, { personId: person.id });
      return { id: person.id };
    });
  }
  async visit(actor: CaseActor, id: string, tab: string) {
    assertRead(actor, await this.cases.file(id));
    await audit(this.cases.db, actor, 'TAB_VISITED', id, { tab });
    return { recorded: true };
  }
}
