import type { PrismaClient, Prisma } from '@prisma/client';
import type { UserRole } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import bcrypt from 'bcryptjs';
import { LEGAL_ELEMENTS, ELEMENT_WEIGHTS } from '@detective/shared';
import { CaseCrypto } from './crypto';
import { renderCasePdf } from './export.service';
export const LEGAL_DEPARTMENT = '00000000-0000-4000-8000-000000000001';
export const LEGAL_SEED_CASES = [
  '63000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000002',
  '63000000-0000-4000-8000-000000000003',
];
export type DemoAccount = { email: string; password: string; displayName: string; role: UserRole };
export async function seedLegalDatabase(
  db: PrismaClient,
  options: { secret: string; filesDirectory: string; accounts: DemoAccount[] },
) {
  const crypto = new CaseCrypto({
    secret: options.secret,
    workspaceId: 'seed',
    controlToken: 'seed',
    shutdown: () => undefined,
  });
  await db.department.upsert({
    where: { id: LEGAL_DEPARTMENT },
    create: { id: LEGAL_DEPARTMENT, code: 'ACADEMY', name: 'O‘quv tergov bo‘linmasi' },
    update: {},
  });
  const users = [];
  for (const a of options.accounts)
    users.push(
      await db.user.upsert({
        where: { email: a.email },
        create: {
          email: a.email,
          displayName: a.displayName,
          role: a.role,
          departmentId: LEGAL_DEPARTMENT,
          passwordHash: await bcrypt.hash(a.password, 12),
        },
        update: {},
      }),
    );
  const admin = users.find((u) => u.role === 'ADMIN');
  if (!admin) throw Error('Seed administrator required');
  for (const [index, id] of LEGAL_SEED_CASES.entries()) {
    if (await db.caseFile.findUnique({ where: { id } })) continue;
    const now = new Date(),
      deadlineAt = new Date(now.getTime() + 30 * 86400000),
      episodeCount = index === 1 ? 2 : 1;
    const persons = [
      {
        id: `63100000-0000-4000-8000-00000000000${index * 2 + 1}`,
        fullName: ['Jamshid O‘quvchi', 'Rustam Namunaviy', 'Odil Sinov'][index] ?? 'Sinov shaxs',
        photoUrl: '/suspects/station.webp',
        role: 'SUSPECT' as const,
      },
      {
        id: `63100000-0000-4000-8000-00000000000${index * 2 + 2}`,
        fullName: ['Nodira Guvoh', 'Aziz Namuna', 'Dilnoza Guvoh'][index] ?? 'Guvoh',
        photoUrl: '/suspects/letter.webp',
        role: 'WITNESS' as const,
      },
    ];
    const episodes = Array.from({ length: episodeCount }, (_, j) => ({
      id: `63200000-0000-4000-8000-0000000000${index + 1}${j + 1}`,
      episodeNumber: j + 1,
      description:
        j === 0
          ? 'O‘quv vaziyati: omborxonadagi buyumlar tungi vaqtda yashirin ravishda olib chiqilgan. Guvoh transport vositasini kuzatgan.'
          : 'Ikkinchi o‘quv epizodida boshqa manzildagi mulkka tajovuz holati o‘rganiladi. Shaxs va rol birinchi epizoddan mustaqil tanlanadi.',
      jkArticle: '169',
      location: j === 0 ? 'Namuna shahri, Birinchi ombor' : 'Namuna shahri, Ikkinchi ombor',
      dateTime: new Date(now.getTime() - (j + 2) * 86400000),
      weight: j === 0 ? 1 : 3,
    }));
    const documentId = `63300000-0000-4000-8000-00000000000${index + 1}`,
      storageKey = `${id}/${documentId}.pdf`;
    const pdf = await renderCasePdf([
      { text: 'O‘QUV PROTOKOLI — HAQIQIY ISH EMAS', heading: true },
      { text: 'Ushbu shaxslar, manzillar va PINFL raqamlari sun’iy sinov ma’lumotlaridir.' },
      { text: episodes[0]?.description ?? '' },
      {
        text: `Guvoh: ${persons[1]?.fullName}. Jinoyat tarkibi bo‘yicha xulosa dalillardan kelib chiqib tuziladi.`,
      },
    ]);
    const path = resolve(options.filesDirectory, storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, pdf, { mode: 0o600 });
    await db.$transaction(async (tx) => {
      await tx.caseFile.create({
        data: {
          id,
          caseNumber: `1-2026-00${index + 1}`,
          title:
            ['Omborxonadagi izlar', 'Ikki manzil, ikki epizod', 'Etaloni kutilayotgan ish'][
              index
            ] ?? 'O‘quv ishi',
          summary:
            'Sun’iy o‘quv vaziyati: mulkning yashirin ravishda olib chiqilgani haqida murojaat kelib tushgan. Dastlabki ma’lumotlar tekshirilmoqda.',
          initialFacts:
            'Omborxonada buyumlar yetishmasligi aniqlangan. Vaqt va shaxslar haqidagi dastlabki ma’lumotlar aniqlashtiriladi. Dalillar faqat ish olingach ochiladi.',
          openedAt: now,
          deadlineAt,
          departmentId: LEGAL_DEPARTMENT,
          createdById: admin.id,
          jkArticles: ['169'],
          referenceRevision: index === 2 ? 0 : 1,
          episodes: { create: episodes },
        },
      });
      for (const [j, p] of persons.entries()) {
        await tx.person.create({
          data: {
            id: p.id,
            fullName: p.fullName,
            birthDate: new Date(j === 0 ? '1994-04-12' : '2000-07-09'),
            gender: j === 0 ? 'MALE' : 'UNKNOWN',
            addressEncrypted: crypto.encrypt('Namuna shahri, Sun’iy ko‘cha, 12-uy'),
            pinflEncrypted: crypto.encrypt('00000000001234'),
            pinflLast4: '1234',
            photoUrl: p.photoUrl,
          },
        });
        await tx.casePerson.create({ data: { caseId: id, personId: p.id, role: p.role } });
      }
      await tx.caseDocument.create({
        data: {
          id: documentId,
          caseId: id,
          title: 'Dastlabki tekshiruv protokoli (o‘quv)',
          type: 'PROTOCOL',
          storageKey,
          mime: 'application/pdf',
          sha256: createHash('sha256').update(pdf).digest('hex'),
          bytes: pdf.length,
          authorId: admin.id,
          isEvidence: true,
        },
      });
      if (index !== 2)
        for (const [j, e] of episodes.entries()) {
          const personId = persons[j]?.id ?? persons[0]?.id;
          const payloads = {
            SUBJECT: [{ personId, role: 'IJROCHI' }],
            PARTICIPATION: [],
            OBJECT: ['PROPERTY'],
            OBJECTIVE: {
              action: 'HARAKAT',
              consequences: ['MATERIAL'],
              causality: 'MAVJUD',
              note: '',
            },
            SUBJECTIVE: {
              guilt: 'QASDDAN',
              intent: 'TOGRI',
              motive: 'GREED',
              motiveNote: '',
              purpose: 'ENRICHMENT',
              purposeNote: '',
            },
          };
          for (const elementType of LEGAL_ELEMENTS)
            await tx.referenceAnswer.create({
              data: {
                caseId: id,
                episodeId: e.id,
                elementType,
                payload: payloads[elementType] as Prisma.InputJsonValue,
                weight: ELEMENT_WEIGHTS[elementType],
              },
            });
        }
    });
  }
  return { legalCases: LEGAL_SEED_CASES.length, demoUsers: users.length };
}
export async function seedLocalLegal(db: PrismaClient) {
  const root = resolve(process.env['RUNTIME_ROOT'] ?? join(process.cwd(), '../..')),
    local = join(root, '.local');
  await mkdir(local, { recursive: true });
  const secretPath = join(local, 'http-secret');
  try {
    await writeFile(secretPath, randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
  } catch (e) {
    if (!(e instanceof Error && 'code' in e && e.code === 'EEXIST')) throw e;
  }
  const accountsPath = join(local, 'demo-users.json');
  let accounts: DemoAccount[];
  try {
    accounts = JSON.parse(await readFile(accountsPath, 'utf8')) as DemoAccount[];
  } catch (e) {
    if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e;
    accounts = (
      [
        { role: 'USER', displayName: 'Demo tergovchi', email: 'tergovchi' },
        { role: 'USER', displayName: 'Ikkinchi tergovchi', email: 'tergovchi2' },
        { role: 'HEAD', displayName: 'Demo rahbar', email: 'rahbar' },
        { role: 'PROSECUTOR', displayName: 'Demo prokuror', email: 'prokuror' },
        { role: 'ADMIN', displayName: 'Demo administrator', email: 'admin' },
        { role: 'AUDITOR', displayName: 'Demo auditor', email: 'auditor' },
      ] as const
    ).map((a) => ({
      ...a,
      email: a.email + '@demo.tergovchi.test',
      password: 'Demo-' + randomBytes(18).toString('base64url'),
    }));
    await writeFile(accountsPath, JSON.stringify(accounts, null, 2), { flag: 'wx', mode: 0o600 });
  }
  const secret = process.env['JWT_SECRET'] ?? (await readFile(secretPath, 'utf8')).trim();
  return seedLegalDatabase(db, { secret, filesDirectory: join(local, 'case-files'), accounts });
}
