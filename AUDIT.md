# Case opening v2 — Faza 0 auditi

Sana: 2026-11-23 (Asia/Tashkent). Boshlang‘ich commit: `d412b39`.
Ish boshlanishida Git ishchi daraxti toza edi; mahalliy `AGENTS.md` topilmadi.
Branch: `fix/case-opening-v2`; boshlang‘ich tag: `fix-case-opening/pre-refactor`.

## Tasdiqlangan qarorlar

Foydalanuvchi discoverydagi uchta savolga quyidagicha javob berdi:

1. `HOMIYDA` yozuv xatosi; mavjud `YORDAMCHI` qiymati saqlanadi.
2. Qasddan holat uchun aybdorlik, qasd turi, motiv va maqsad to‘rtta teng
   ulushda baholanadi. Ehtiyotsizlikda uchta teng ulush saqlanadi.
3. `/api/v1` kontrakti saqlanadi; `/api/v2` va shaxsga ixtiyoriy aloqa/izoh
   maydonlari qo‘shiladi. Eski jadval va ma’lumotlar o‘chirilmaydi.

## Texnik inventar

| Qism              | Mavjud holat                                                                     |
| ----------------- | -------------------------------------------------------------------------------- |
| Monorepo          | pnpm 9.15.9, Turbo 2.11.13; `apps/*`, `packages/*`                               |
| Web               | React 18.3.1, Vite 8, React Router 7.18.6, TypeScript 5.8.3                      |
| Frontend ma’lumot | TanStack Query 5; Zustand 5; Zod 4.6.6                                           |
| Shakllar          | React Hook Form 7 o‘rnatilgan; case shakli hozir `useState`da                    |
| API               | NestJS 11.2.11, Fastify 5.12.8, Prisma 5.22.0                                    |
| DB                | PostgreSQL; `apps/api/prisma/schema.prisma`; 3 ta migratsiya                     |
| i18n              | `case-module/i18n.ts`: `translate(locale, key)`, lotin/kirill/ruscha             |
| Unit/integration  | Vitest 5.1.1; Fastify inject va haqiqiy ajratilgan PostgreSQL sxemasi            |
| Browser           | Playwright 1.65.1, axe; `.mjs` E2E skriptlar                                     |
| Config            | `tsconfig.test.json`, `vite.config.ts`, `eslint.config.mjs`, `.prettierrc.json`  |
| CI                | `.github/workflows/foundation.yml`; mavjud CI case integration/E2Eni chaqirmaydi |
| Env               | `.env.example`: DB/test DB/Redis va seed sozlamalari; v2 flag yo‘q               |
| Ishga tushirish   | `run.bat`, `scripts/start-local.mjs`; mahalliy PostgreSQL/Redis                  |

```text
apps/api/
  prisma/{schema.prisma,migrations/,seed.ts}
  src/{http/,case-module/,infra/}
  tests/ scripts/
apps/web/
  src/app/                       # router, layout, global UI
  src/features/case-module/      # o‘zgartiriladigan modul
  src/shared/                    # umumiy API/UI
packages/shared/src/case-module/ # DTO va Zod kvalifikatsiya sxemalari
docs/case-module/ tests/ scripts/
```

## Fayllar xaritasi va baseline

| Fayl                                                                                           | Hozirgi vazifa va xatti-harakat                                                                                                                    |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/App.tsx`                                                                     | `/case-files`, `admin`, `audit`, `:id` route’lari lazy yuklanadi. Preview alohida route emas, dialog. Global error boundary bor.                   |
| `apps/web/src/features/case-module/CaseShell.tsx`                                              | Til/tema, meta, pagination, muddat va umumiy loading/error UI. Meta `/v1/meta`dan olinadi.                                                         |
| `apps/web/src/features/case-module/CaseDashboard.tsx`                                          | Ro‘yxat, filter, preview dialog, claim. Claimdan so‘ng `/case-files/:id`ga o‘tadi; preview hujjat/shaxs chiqarmaydi, ochilgan sanani chiqarmaydi.  |
| `apps/web/src/features/case-module/CaseWorkspace.tsx`                                          | Umumiy, Hujjatlar, Ishtirokchilar, Kvalifikatsiya, Natija. Natija yuborishdan oldin ham ko‘rinadi; shaxs kartasida jins chiqmaydi.                 |
| `apps/web/src/features/case-module/CaseQualification.tsx`                                      | Epizodlar, Zod validatsiya, 2 soniya autosave, offline localStorage, version/LWW. Server rad etganda optimistik qiymat qaytarilmaydi.              |
| `apps/web/src/features/case-module/QualificationFields.tsx`                                    | Subyekt checkbox/rol, ishtirokchilik qatorlari, obyektlar va ikki tomon. Takror shaxs warning; qasd turi shartli majburiy.                         |
| `apps/web/src/features/case-module/CaseAdmin.tsx`                                              | Admin etaloni, yangi ish/material/shaxs kiritish va foydalanuvchilar; auditor audit UI. Etalon barcha epizoddagi beshta elementni talab qiladi.    |
| `apps/web/src/features/case-module/i18n.ts`                                                    | Qisqa kalitli mahalliy lug‘at; `caseOpening.*` namespace yo‘q.                                                                                     |
| `apps/web/src/features/case-module/local-drafts.ts`                                            | Chiqishda case local qoralamalarini tozalaydi.                                                                                                     |
| `apps/web/src/features/case-module/case-module.css`                                            | Case sahifalari uchun qog‘oz uslub, tab, shakl, viewer va responsive bezaklar.                                                                     |
| `apps/web/src/shared/api/client.ts`                                                            | Umumiy API klienti; case kodiga ishlatiladi. Auth va boshqa modullar uchun umumiy chegara.                                                         |
| `packages/shared/src/case-module/contracts.ts`                                                 | Strict preview/workspace/person/document DTOlar; signed URL `/api/v1/cases/` bilan boshlanishi shart.                                              |
| `packages/shared/src/case-module/qualification.ts`                                             | Besh element, qat’iy vaznlar, draft/complete Zod sxemalari, urinish/score DTOlar. Rol `YORDAMCHI`; obyektlarda qo‘shimcha `PUBLIC_HEALTH` ham bor. |
| `apps/api/src/case-module/controllers.ts`                                                      | `/api/v1` case/auth/admin REST kontrakti; javoblar global envelope’da. Claim/submit standart Nest POST sifatida 201 qaytaradi.                     |
| `apps/api/src/case-module/case.service.ts`                                                     | Role/scope, preview, workspace, TTL 24h lock, deadline, persons va audit. Lock `SELECT FOR UPDATE` bilan serializatsiya qilinadi.                  |
| `apps/api/src/case-module/qualification.service.ts`                                            | Draft, submit, admin etaloni va history. Jami case uchun 3 attempt; best saqlanadi; etalon revision va snapshot qayd etiladi.                      |
| `apps/api/src/case-module/scoring.ts`                                                          | Set F1; 50 + 4×12.5 mustaqil baholanadi. Qasddan subyektiv bo‘lim 4 teng maydon, ehtiyotsizlik 3 maydon; epizodlar vaznli o‘rtacha.                |
| `apps/api/src/case-module/documents.service.ts`                                                | PDF/image tozalash, signed URL TTL 15min, hash tekshirish. Hujjatni birinchi ochish ASSIGNEDni IN_INVESTIGATIONga o‘tkazadi.                       |
| `apps/api/src/case-module/crypto.ts`                                                           | AES-GCM PII va actor/case/document/hash/expiryga bog‘langan HMAC tokenlar.                                                                         |
| `apps/api/src/case-module/export.service.ts`                                                   | PDF/DOCX natijalar; mavjud rol va PII qoidalariga bog‘liq.                                                                                         |
| `apps/api/src/case-module/backup.service.ts`                                                   | Case jadvallari/fayllarining shifrlangan arxivi; bu to‘liq `pg_dump` o‘rnini bosmaydi.                                                             |
| `apps/api/src/case-module/seed.ts`                                                             | Sun’iy ishlar, shaxslar, hujjatlar, ikki epizodli va etalonsiz holat. Admin etalon kiritish oqimi ma’lum.                                          |
| `apps/api/src/http/application.ts`                                                             | Provider/controller ro‘yxati, audit xato filteri, envelope, umumiy 120/min throttle. Auth/dashboard bilan umumiy integratsiya nuqtasi.             |
| `apps/api/prisma/schema.prisma`                                                                | Eski `Case` bilan yangi `CaseFile` ajratilgan. Qualification/Answer, ReferenceAnswer, CaseScore, CaseLock va AuditLog mavjud.                      |
| `apps/api/prisma/migrations/202611220003_case_module/migration.sql`                            | Yangi case jadvallari, FK, unique va CHECK constraintlar; down/backfill skripti yo‘q.                                                              |
| `apps/api/tests/case-scoring.test.ts`                                                          | 9 unit: F1, rol, mustaqillik, subyektiv 4 maydon, epizod vazni va xatolar.                                                                         |
| `apps/api/tests/case-security.test.ts`                                                         | 4 unit: PII, signed URL, PDF/image xavfsizlik chegaralari.                                                                                         |
| `apps/api/tests/case-module.integration.test.ts`                                               | 15 integration: preview, claim race, document access, PII, draft, score, urinish, etalon, rol va backup.                                           |
| `apps/api/scripts/test-database.ts`                                                            | Faqat `_test` bazasiga ruxsat; tasodifiy `phase0_*` sxema yaratadi va faqat o‘shani yakunda o‘chiradi.                                             |
| `tests/case-module.browser.mjs`                                                                | Mavjud admin → preview → claim → document → autosave/offline → score → approve/auditor E2E.                                                        |
| `docs/case-module/{README.md,architecture.md,verification.md,acceptance.feature,openapi.json}` | Mavjud setup, arxitektura va oldingi QA. Oldingi hisobot bugungi qayta sinov o‘rnini bosmaydi.                                                     |

## Kuzatilgan oqim

1. `/case-files` ro‘yxati preview DTOlarni oladi. Ko‘rish dialogida faqat meta,
   summary va initialFacts chiqadi; hujjat, dalil va shaxslar yuborilmaydi.
2. Claim bir xil CaseFile satrini tranzaksiyada qulflaydi. Bitta tergovchi 201,
   ikkinchisi 409 oladi; lock 24 soatga va status ASSIGNEDga o‘tadi, audit yoziladi.
3. Workspace hujjat va shaxslarni alohida yuklaydi. Hujjat ochilmaguncha
   kvalifikatsiya tahriri yopiq. Boshqaruv rollariga qo‘shimcha o‘qish mavjud.
4. Har epizodda beshta javob saqlanadi; local qoralama 24 soat amal qiladi.
   Eskirgan baseVersion oxirgi yozuv bilan almashtiriladi va auditga tushadi.
5. Submit etalon, lock, rol, barcha javoblar va begona IDlarni tekshiradi.
   Noto‘g‘ri subyekt + qolgan to‘g‘ri elementlar = 50. Eng yaxshi 3 urinish ko‘rinadi.
6. Etalon yangilanishi revisionni oshiradi, eski ball/snapshotni o‘zgartirmaydi.
   Uchta urinish limiti revisiondan qat’i nazar case bo‘yicha sanaladi.

## Topilgan farqlar va xavflar

| ID  | Daraja     | Dalil / ta’sir                                                                                                                       | Keyingi yechim                                                                 |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| A01 | Yuqori     | V2 runtime flag yo‘q; case moduli doim faol                                                                                          | Default-off `FF_CASE_OPENING_V2`, clientga runtime config va v1 saqlash        |
| A02 | Yuqori     | API `/api/v1`; `answers/:element` va 201 claim; spec `/api/v2`, `answers`, 200 claim                                                 | Alohida v2 adapter va eski/yangi parity test                                   |
| A03 | Yuqori     | `CaseDocuments.list/file` dalil uchun faqat lock egasi qoidasini qo‘llamaydi; privileged role va closed/suspended owner lockdan ozod | V2da har list/file so‘rovida faol lock egasini tekshirish                      |
| A04 | O‘rta      | `Person`/DTOda contact/note yo‘q; kartada mavjud gender ham chiqmaydi                                                                | Nullable qo‘shimcha ustunlar va v2 DTO/UI; v1 strict DTO saqlanadi             |
| A05 | O‘rta      | `results` tab doim bor; `persons` labeli Ishtirokchilar                                                                              | V2 Natija faqat scoredan keyin, Gumondorlar nomi                               |
| A06 | O‘rta      | Submit endpointida maxsus throttle yo‘q, faqat global 120/min                                                                        | V2 submit 3/min; rate limit integration                                        |
| A07 | O‘rta      | Autosave rad etilganda UI qiymati qaytmaydi; generic xato sababni yashiradi                                                          | Tasdiqlangan server nusxasi, rollback va 409 uchun aniq xabar                  |
| A08 | O‘rta      | Har bo‘lim RHF ishlatmaydi; tablarda alohida boundary/skeleton yo‘q                                                                  | V2 uchun RHF+Zod, per-tab boundary va loading/empty UI                         |
| A09 | O‘rta      | Yangi namespace yo‘q, ayrim matnlar literal                                                                                          | Mavjud translate ustida `caseOpening.*` kalitlari                              |
| A10 | O‘rta      | Etalon revision o‘zgarsa ham max3 case bo‘yicha                                                                                      | Eski natijani avtomatik qayta baholamaslik; yangi submit yangi attempt         |
| A11 | O‘rta      | Preview openedAt DTOda bor, dialogda yo‘q                                                                                            | V2 previewda ochilgan sana                                                     |
| A12 | O‘rta      | Faqat up migratsiyalar mavjud                                                                                                        | Faqat yangi migratsiya uchun up/down/backfill va test DBda rollback tekshiruvi |
| A13 | O‘rta      | Muvaffaqiyatli endpointlar uchun caseId/userId/action/duration log va drop-off metric yo‘q                                           | Modul doirasida structured logging/metric va log-based kuzatuv                 |
| A14 | Past       | Bir nechta mavjud modul fayli 300 qatordan uzun                                                                                      | Yangi kodni kichik komponent/service’larda saqlash; keng rewrite qilmaslik     |
| A15 | Kelishildi | HOMIYDA/YORDAMCHI va subyektiv 3/4 ulush farqi                                                                                       | Yuqoridagi foydalanuvchi qaroriga ko‘ra mavjud scoring/rolni saqlash           |

## Blast radius — rejalashtirilgan chegaralar

| O‘zgarish                        | Ta’sirlanadigan qism                       | Xavf  | Himoya                                                        |
| -------------------------------- | ------------------------------------------ | ----- | ------------------------------------------------------------- |
| Character testlar va ushbu audit | Faqat test/docs                            | Past  | Funksional kod o‘zgarmaydi                                    |
| V2 controller va runtime config  | Faqat case API; global registration        | O‘rta | V1 baseline va parity, flag default false                     |
| Nullable person maydonlari       | Person modeli va v2 read/admin             | O‘rta | ADD COLUMN; eski seed, jadval, v1 DTO saqlanadi               |
| Workspace/preview UI             | Faqat case-module                          | O‘rta | Runtime flag; eski komponent fallback                         |
| Scoring                          | Yangi hisoblash algoritmi kerak emas       | Past  | Mavjud 9 scoring testi o‘zgarmaydi                            |
| Auth, doska, profil, eski o‘yin  | Umumiy application/router orqali bilvosita | O‘rta | Bu modullarning biznes kodi tahrirlanmaydi; smoke/integration |

## Shu sessiyada qayta bajarilgan tekshiruvlar

| Buyruq                             | Natija                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm typecheck`                   | O‘tdi; shared/api/web TypeScript                                             |
| `pnpm lint`                        | O‘tdi; 0 warning                                                             |
| `pnpm format:check`                | O‘tdi                                                                        |
| `pnpm test`                        | 43 shared + 6 web + 15 API + 18 runtime = 82/82                              |
| `pnpm test:case-module`            | 15/15; yangi ajratilgan test sxemada 3 migratsiya qo‘llandi                  |
| Jami                               | 97/97; yangi character/v2 testlar hali yozilmagan                            |
| Case dashboard/workspace P95       | 7.44/6.74 ms, 30 ta local Fastify inject namuna; browser/production SLA emas |
| Browser, eski HTTP/DB regressiyasi | Faza 0da qayta bajarilmadi; keyingi fazaga tegishli                          |
| Prod migratsiya/deploy             | Bajarilmadi                                                                  |

Terminal oddiy sandboxda `helper_sandbox_lock_failed` sabab ochilmadi; buyruqlar
kengaytirilgan terminal rejimida bajarildi. pnpm global PATHda yo‘q edi; tekshiruv
jarayonida mavjud `.tools/node_modules/.bin` PATHga qo‘shildi, so‘ng
`node .tools/node_modules/pnpm/bin/pnpm.cjs <script>` ishlatildi. Global sozlama o‘zgarmadi.

## Keyingi faza

V1 character testlarini yangi, keyin o‘zgartirilmaydigan faylda yozish. So‘ng
default-off runtime flag, additive migratsiya, v2 API/UI va zarur regression/E2E
tekshiruvlari. DB ishlari faqat zaxira va alohida test bazasidagi rollback dalili
bilan; production rollout va bir haftalik kuzatuv mahalliy QA bilan almashtirilmaydi.

## Yakuniy holat — 2026-11-23

Faza 0–7 implementatsiya va mahalliy QA bilan bajarildi. Rollout tayyorgarligi:
backup vositasi, 7 kunlik log metrikalari, guard xatolari logi, qoralamaning
v2 → v1 rollback himoyasi va CI tayyor. Haqiqiy staging/production rollout
va bir haftalik kuzatuv bajarilmagan; default flag false qoladi.

Yuqoridagi jadval discovery paytidagi baseline bo‘lib saqlangan. Topilmalar
bo‘yicha amalga oshirilgan o‘zgarishlar, testlarning yakuniy natijasi va
tasdiqlangan istisnolar [FIX_NOTE.md](FIX_NOTE.md)da. Yangi nullable ustunlar
faqat test sxemalarida qo‘llandi; asosiy bazadan tekshirilgan pg_dump olindi.
