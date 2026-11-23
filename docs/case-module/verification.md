# Tekshiruv natijasi — 2026-11-23

Mahalliy Windows x64 / Node26 / PostgreSQL16 muhitida tekshirildi. `run.bat --no-pause --no-browser` migratsiya, seed, baza/Redis ulanishi, frontend va API buildini bajarib, `http://127.0.0.1:3000/board` manzilida serverni ochdi. Yangi modul `/case-files`da mavjud.

| Tekshiruv                               | Natija                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| Umumiy unit, asset va launcher testlari | 82/82                                                                            |
| Eski DB integratsiyasi                  | 15/15                                                                            |
| Eski HTTP integratsiyasi                | 19/19                                                                            |
| Yangi modul API integratsiyasi          | 15/15                                                                            |
| Jami unit/integratsiya/runtime          | **131/131**                                                                      |
| Sof scoring qamrovi                     | 100% statement, branch, function, line                                           |
| Eski o‘yin Playwright regressiyasi      | O‘tdi, 320/375 px, profil/parol/avatar va xonalar                                |
| Yangi modul Playwright E2E              | O‘tdi                                                                            |
| Axe — kvalifikatsiya sahifasi           | WCAG2/2.1 A/AA teglarida 0 avtomatik xato                                        |
| PDF eksport                             | Auditor nusxasi 2 sahifa, tergovchi nusxasi 1 sahifa; rastr va matn tekshirildi  |
| DOCX eksport                            | ZIP/XML, Calibri va sahifa geometriyasi, brauzer preview tekshirildi             |
| OpenAPI 3.1                             | 24 path, 29 operation, 35 schema; ichki havolalar va operation IDlar tekshirildi |
| Production bog‘liqliklari auditi        | Ma’lum zaiflik topilmadi                                                         |
| TypeScript / ESLint / Prettier          | O‘tdi                                                                            |

API testlari: parallel claim, rol/scope, previewda hujjatlar yo‘qligi, signed URL actor/hash/TTL, PII mask, last-write-wins audit, boshqa ish shaxsi/epizodini rad etish, 3 urinish va eng yaxshi baho, etalonsiz 422, rahbar tasdig‘i, reassign, suspend/resume, deadline, refresh rotation/replay/logout va shifrlangan backup/retention.

Yangi brauzer oqimi: admin ish yaratdi va etalonni saqladi; tergovchi previewdan ish oldi, PDF ochdi, to‘rtta tanlovli bo‘lim va bo‘sh ishtirokchilikni saqladi, oflayn izohni qayta uladi, 100 ball oldi va PDF yukladi; rahbar ishni yopdi; auditor PINFLning faqat oxirgi 4 raqamini ko‘rdi. Lotin/kirill/ruscha, dark tema va 390 pxda gorizontal overflow yo‘qligi tekshirildi.

So‘nggi lokal API o‘lchovi: 3 ta sun’iy ish, har endpoint uchun 30 namuna, Fastify inject va PostgreSQL. Dashboard P95 **9.28 ms**, workspace P95 **7.78 ms**. Bu to‘liq brauzer yuklanishi yoki ko‘p foydalanuvchili production SLA o‘lchovi emas.

Tergov xonasi `apps/web/public/scenes/desk.webp` SHA-256 qiymati o‘zgarmadi:

```text
150c0049e019be1ab85044278548b48bc1cb7a89e4cbf421782051b044eea583
```

Dalillar `.cache/case-module-qa/` va `.cache/qa/game-ui-v11/`da. Ular sun’iy QA ma’lumotlari bo‘lib, Gitga kiritilmaydi. DOCXni Wordda aniq sahifalash tekshiruvi yakunlanmadi: LibreOffice yo‘q, alohida yashirin Word COM renderer to‘xtab qoldi va yopildi. Brauzer preview Wordning aniq sahifalashini tasdiqlamaydi. Axe natijasi ham to‘liq qo‘lda WCAG auditi o‘rnini bosmaydi. Backup va production cheklovlari [arxitekturada](architecture.md).
