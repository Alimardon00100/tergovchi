# Case opening v2 — o‘zgarish va tekshiruv

Sana: 2026-11-23, Asia/Tashkent. Branch: `fix/case-opening-v2`.
Discovery va boshlang‘ich xatti-harakat: [AUDIT.md](AUDIT.md).

## Natija

V2 yoqilgan foydalanuvchi ishni olganda `/cases/:id/workspace` ochiladi.
Preview meta va qisqa sharhni ko‘rsatadi. Hujjatlar/dalillar v2da faqat faol
lock egasiga beriladi. Gumondorlar kartasi jins, aloqa va izohni ham chiqaradi;
auditor uchun maxfiy maydonlar maskalanadi. Natija birinchi submitdan keyin ko‘rinadi.

Kvalifikatsiyaning besh bo‘limi React Hook Form + Zod bilan tekshiriladi.
Autosave 2 soniya, tab almashtirilganda davom etadi; offline qoralama qayta
yuboriladi. Server rad etgan optimistik qiymat oxirgi tasdiqlangan qiymatga qaytadi.
V2 flagi o‘chirilganda yuborilmagan qoralama v1 orqali ham tiklanadi.

Foydalanuvchi tasdiqlagan istisnolar: `YORDAMCHI` saqlangan; qasddan subyektiv
bo‘limda to‘rtta teng ulush saqlangan. Scoring yadrosi o‘zgarmagan: 50 + 4×12.5,
F1 va mustaqil baholash. Maksimum uch urinish, eng yaxshi baho va tarix saqlanadi.
Etalon revisioni eski bahoni qayta hisoblamaydi; keyingi submit yangi attempt
bo‘ladi, mavjud uchta urinish limiti doirasida.

## O‘zgarish chegarasi

| Fayl/guruh                                                                         | O‘zgarish turi                                       | Sabab va blast radius                                                       |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/api/src/case-module/opening*`, `flags.ts`                                    | Yangi v2 controller, ruxsat, telemetry, runtime flag | Faqat case moduli; default off                                              |
| `case-module/{documents.service,qualification.service,crypto}.ts`                  | Default v1 saqlanadigan parametrlar                  | V2 lock va URL versiyasi; v1 character testi saqlangan                      |
| `apps/api/src/http/application.ts`                                                 | Controller/provider/hook ro‘yxati                    | Umumiy integratsiya nuqtasi; eski HTTP regressiyasi yashil                  |
| `packages/shared/src/case-module/opening-v2.ts`                                    | Yangi strict DTOlar                                  | Eski DTOlar o‘zgarmagan                                                     |
| `apps/api/prisma/` va `case-module/backfill.ts`                                    | Nullable shifrlangan maydonlar, up/down/backfill     | Eski jadval va yozuvlar saqlanadi                                           |
| `apps/web/src/features/case-module/Opening*`, `CaseWorkspaceV2`, `useOpeningDraft` | Alohida v2 UI                                        | Legacy workspace fallback saqlanadi                                         |
| `CaseShell`, `CaseDashboard`, `CaseAdmin`, `CaseWorkspace`, `i18n`                 | Kichik ulash o‘zgarishlari                           | Flag, preview sana, admin details, mavjud General/Resultsni qayta ishlatish |
| `apps/web/src/app/App.tsx`                                                         | Workspace route/alias                                | Auth, profil, eski o‘yin biznes kodi tahrirlanmagan                         |
| Testlar, `scripts/`, `.github/workflows/foundation.yml`                            | QA, backup, metrikalar, CI                           | Ajratilgan `_test` sxemalar                                                 |

## V2 API kontrakti

Javob envelope’i avvalgidek `{success,data,requestId}`; xatoda `error.code/message`.
Auth mavjud cookie yoki Bearer orqali. V2 o‘chiq cohort uchun v2 so‘rovlari 404.

| Amal          | Endpoint                                                 | Muhim qoida                                        |
| ------------- | -------------------------------------------------------- | -------------------------------------------------- |
| GET           | `/api/case-opening/config`                               | Joriy foydalanuvchi uchun `{enabled}`              |
| GET           | `/api/v2/meta`, `/api/v2/cases`                          | Meta/ro‘yxat parity                                |
| GET           | `/api/v2/cases/:id`                                      | Preview; materiallar yo‘q                          |
| GET           | `/api/v2/cases/:id/workspace`                            | Meta, epizodlar, ruxsatlar                         |
| POST / DELETE | `/api/v2/cases/:id/lock`                                 | Claim 200; konflikt 409; TTL 24h                   |
| GET           | `/api/v2/cases/:id/documents`                            | Faqat faol lock egasi; URL TTL 15min               |
| GET           | `/api/v2/cases/:id/documents/:documentId/file?token=...` | Actor, hash, expiry va API versiyasi tekshiriladi  |
| GET / POST    | `/api/v2/cases/:id/persons`                              | POST faqat admin, NEW holat; contact/note optional |
| GET           | `/api/v2/cases/:id/qualification`                        | Qoralama                                           |
| PUT           | `/api/v2/cases/:id/qualification/answers`                | `{episodeId,elementType,payload,baseVersion}`      |
| POST          | `/api/v2/cases/:id/qualification/submit`                 | `{qualificationId}`; 200; 3/min, etalonsiz 422     |
| GET           | `/api/v2/cases/:id/score`                                | Urinishlar tarixi va best                          |
| GET / PUT     | `/api/v2/admin/cases/:id/reference-answers`              | Faqat admin; revision himoyasi                     |
| POST          | `/api/case-opening/events`                               | `{caseId,tab}`; audit va drop-off uchun            |

V1ning URL, DTO, 201 claim/submit va mavjud rol ruxsatlari saqlangan.
V2ning qat’iy hujjat siyosati v2 endpointlariga tegishli. V2 signed tokenini
v1 fayl endpointiga ko‘chirish rad etiladi. Eski v1 ruxsatlarini butunlay
bekor qilish alohida breaking policy rolloutini talab qiladi.

## DB va backup

`202611230001_case_opening_v2` faqat `Person.contactEncrypted` va
`Person.noteEncrypted` nullable TEXT ustunlarini qo‘shadi. Qiymatlar mavjud
AES-GCM orqali shifrlanadi. Eski shaxslar uchun null saqlanadi, PII taxmin qilinmaydi.
Down qiymatlarni `CaseOpeningPersonRollback` jadvalida saqlaydi; qayta updan
keyin `pnpm backfill:case-opening` ularni idempotent tiklaydi.

Asosiy bazaning pg_dump nusxasi `.local/backups/`da olindi: 75 060 bayt;
SHA-256 `9b40d1bf806c26f33ac288346420cda92cb3228d951d404f10bf09fd0750d2dd`.
Yonidagi `.dump.json` manifestida filename va `archiveListVerified:true` bor.
Mos PostgreSQL 16.16 client vositalari `.tools/postgres-client-16.16/`da.
`pg_restore --list` tekshirildi; bu nusxa productionga restore qilinmadi.
Asosiy bazaga yangi migratsiya qo‘llanmagan; test migratsiyalari disposable sxemalarda bajarildi.

## Tekshiruv dalillari

| Tekshiruv                           | Natija                                                          |
| ----------------------------------- | --------------------------------------------------------------- |
| Unit/runtime                        | 101/101: shared 43, web 6, API 32, runtime 20                   |
| Eski DB / HTTP / case API           | 15/15 + 19/19 + 15/15                                           |
| O‘zgarmagan v1 character            | 6/6; phase-1 Git hash bilan solishtirilgan                      |
| V2 policy/parity                    | 9/9; preview, workspace, meta, list, persons, references, score |
| Up/down/backfill                    | 1/1; encrypted ma’lumot va eski row count saqlangan             |
| Performance                         | 1/1; har yo‘nalish 30 namuna, 30 haqiqiy valid submit           |
| Browser                             | 7 asosiy + 1 flag-off + 1 runtime-rollback = 9/9                |
| Jami alohida testlar                | 176/176                                                         |
| Scoring coverage                    | Statement/branch/function/line: 100%                            |
| TypeScript, ESLint, Prettier, build | Yashil                                                          |
| Axe                                 | WCAG 2/2.1 A/AA avtomatik tekshiruvda 0 violation               |

Oxirgi local API P95: dashboard 9.66 ms, preview 8.93 ms, workspace 8.98 ms,
submit 14.99 ms, document 10.71 ms. Bu sequential Fastify inject + PostgreSQL
vaqtidir; to‘liq sahifa yuklanishi yoki production load SLA sifatida talqin qilinmaydi.

QA artefaktlari: `.cache/case-opening-v2-qa/{workspace,qualification,mobile}.png`,
`accessibility.json`, `performance.json`; CI ham shu artefaktlarni saqlaydi.
Prisma native klienti alohida ignored outputga to‘liq generatsiya qilinib,
`_test` bazasida SELECT 1 va yangi maydonlar bilan tekshirildi. Default outputda
ishlab turgan server DLLni band qiladi; odatiy `run.bat` avval serverni xavfsiz
to‘xtatib, keyin generatsiya qiladi.

## Ishga tushirish va qolgan release ishlari

Default `FF_CASE_OPENING_V2=false`. Production flagi yoki serveri almashtirilmagan.
[Rollout](docs/case-opening-v2/ROLLOUT.md), [rollback](docs/case-opening-v2/ROLLBACK.md)
va [5 qadamli demo](docs/case-opening-v2/DEMO.md) tayyor.
Dev/staging → 10% → 100% rollout va bir haftalik kuzatuv operator tomonidan
alohida muhitlarda bajariladi; bu sessiyada production rollout bajarildi deb belgilanmagan.
