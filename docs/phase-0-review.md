# FAZA 0 — Self-review hisoboti

Yangilangan sana: 2026-11-22, Asia/Tashkent.

Joriy Windows launcher loyiha ichidagi PostgreSQL 16 va Redis 7 ni avtomatik tayyorlaydi. Mavjud tashqi xizmatlar uchun LOCAL_SERVICES=external rejimi saqlangan. Kompyuterdagi PostgreSQL 18 tizim xizmati o‘zgartirilmagan va tekshiruv oxirida Running holatida edi.

## Rubric — 12 mezon

| Mezon               | Dalil yoki chegara                                                                     |
| ------------------- | -------------------------------------------------------------------------------------- |
| Arxitektura         | Workspace paketlari, umumiy kontraktlar, 9 ADR                                         |
| Type safety         | Strict TS, exact optional va indeks tekshiruvlari; typecheck o‘tdi                     |
| Vizual integratsiya | Olti sahna xaritasi va WebP pipeline mavjud; asl rasmlar yo‘q                          |
| UX va animatsiya    | Mahsulot ekranlari FAZA 1–3; fon/fallback va reduced-motion tayyor                     |
| Xavfsizlik          | Argon2id, strict DTO, tasodifiy xizmat parollari, paket SHA-256 tekshiruvi             |
| Performance         | Indeks va rasm cheklovlari mavjud; LCP/API p95 o‘lchanmagan                            |
| Testlar             | 64 bazasiz test va 15 haqiqiy PostgreSQL integratsiya testi o‘tdi                      |
| Kod sifati          | Lint, format, typecheck va modul buildi o‘tdi                                          |
| Observability       | Seed va verify uchun Pino JSON; mahalliy xizmatlar log fayllari                        |
| DevOps              | Haqiqiy Windows start/stop/restart sinovi o‘tdi; tashqi xizmat rejimi va CI mavjud     |
| Hujjatlar           | README, 9 ADR, runbook, rasm va chekka holat xaritasi                                  |
| Chekka holatlar     | Yopiq port, URL, IPv6, Node versiyasi, zip-slip, buzilgan paket, qayta ishga tushirish |

To‘liq mahsulot uchun yakuniy 120 ballik baho chiqarilmagan. Mahsulot ekranlari, asl rasmlar, E2E va yuklama natijalari hali yo‘q.

## Joriy tekshiruvlar

| Tekshiruv                            | Natija                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| run.bat --no-pause                   | Exit 0; xizmatlar, Prisma Client, 2 migratsiya, seed va db:verify o‘tdi                                       |
| run.bat --stop --no-pause            | Exit 0; loyiha xizmatlari ma’lumotlarni saqlab to‘xtadi                                                       |
| To‘xtashdan keyin run.bat --no-pause | Exit 0; admin identifikatori va ishlar saqlandi, migratsiyalar takror qo‘llanmadi                             |
| pnpm typecheck                       | O‘tdi                                                                                                         |
| pnpm lint                            | O‘tdi, 0 ogohlantirish                                                                                        |
| pnpm test                            | 64 test: shared 43, API konfiguratsiya 2, React 4, rasm pipeline 3, mahalliy runtime 7, avtomatik xizmatlar 5 |
| pnpm test:db                         | Mahalliy PostgreSQL 16.16 da 15 test o‘tdi                                                                    |
| pnpm build                           | Uch TypeScript paketi kompilyatsiya qilindi                                                                   |
| pnpm db:validate                     | Sxema to‘g‘ri                                                                                                 |
| pnpm services:check                  | Xizmat portlari ochiq; db:verify loginlarni ham tasdiqladi                                                    |
| pnpm audit --json                    | 0 ma’lum paket zaifligi                                                                                       |

Jami 79 test o‘tdi. Mahalliy tekshiruvlar Node.js 26.7.0 da bajarildi. Asosiy baza va test bazasi alohida. Test sxemasi yakunda olib tashlandi; asosiy seed ma’lumotlari saqlandi. GitHub Actions masofadan ishga tushirilmagan.

## DoD

- [x] Joriy kod va launcher matnlari o‘zbekcha.
- [x] TS strict; explicit any yo‘q.
- [x] Typecheck, lint, 79 test va modul buildi o‘tdi.
- [x] Sakkiz model, 10 unvon, 6 ish va takroriy seed mavjud.
- [x] Mahalliy xizmatlar avtomatik tayyorlanadi.
- [x] Start, stop va restart haqiqiy Windows muhitida sinovdan o‘tdi.
- [x] Yangi muhitda autentifikatsiya, migratsiya va seed tekshirildi.
- [x] Eski .env nusxasi va mavjud tizim xizmati saqlandi.
- [ ] Asl fon rasmlari joylashtirildi va ekranlarda tekshirildi.

## Topilgan va tuzatilgan kamchiliklar

1. Launcher faqat tayyor xizmatlarni tekshirib, ular yo‘q bo‘lsa to‘xtardi — loyiha uchun alohida mahalliy xizmatlar yaratish qo‘shildi.
2. Windows pg_ctl jarayoni ochiq qolgan pipe sabab tayyor serverda ham timeout qaytarardi — STDIO to‘g‘ridan-to‘g‘ri log fayliga o‘tkazildi va to‘xtashdan keyingi start bilan tekshirildi.
3. Eski URLga qo‘lda ulanish talab qilinardi — managed rejimda .env avtomatik va atomik sozlanadi, avvalgi nusxasi saqlanadi.
4. Xizmatlar lifecycle’i mavjud emas edi — --stop va persistent data papkalari qo‘shildi.
5. Terminalda PowerShell uchun launcher yo‘li .\\run.bat shaklida hujjatlashtirildi.

## Keyingi faza

Ushbu tarixiy hisobot yozilganida keyingi bosqich NestJS/Fastify HTTP serveri, auth va React/Vite sahifalari edi. Hozirgi ishlaydigan interfeys va tekshiruvlar [brauzer hisoboti](browser-review.md) da qayd etilgan. Asl fon rasmlari hali kerak.
