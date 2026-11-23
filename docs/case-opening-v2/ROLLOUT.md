# Case opening v2 — rollout va kuzatuv

Mahalliy kod, test va rollback tayyor. Dev/staging/prod muhitlariga release
va bir haftalik real kuzatuv ushbu sessiyada bajarilmagan. Hech qanday
foydalanuvchi cohori avtomatik production v2ga o‘tkazilmagan.

## Release ketma-ketligi

1. `fix/case-opening-v2`ning tekshirilgan commitidan release tayyorlang.
   `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
   `pnpm test:case-opening:character`, `pnpm test:case-opening:migration`,
   `pnpm test:case-opening:v2`, `pnpm test:case-opening:performance`,
   `pnpm build` va uchta `test:case-opening:browser*`ni bajaring.
2. Target DBga mos PostgreSQL client vositasi bilan
   `pnpm backup:case-opening:database`ni bajaring. `.dump.json` manifestida
   `archiveListVerified:true` va SHA-256 bo‘lishi kerak. DB nusxasi bilan birga
   mavjud `.local/http-secret`, `.local/case-files` va `.local/uploads`ni saqlang.
3. V2 o‘chiq turgan holda additive migratsiyani targetga qo‘llang:
   `pnpm db:migrate`; kerak bo‘lsa `pnpm backfill:case-opening`.
   Yangi Prisma klienti bilan ishlaydigan backendni boshlashdan avval
   ikki yangi ustun mavjud bo‘lishi shart.
4. Build/Prisma generationdan oldin eski lokal serverni odatiy launcher orqali
   to‘xtating. Lokal `run.bat --no-pause --no-browser` buni o‘zi bajaradi;
   keyin generate/migrate/seed/build/start bajaradi. Real muhitda mavjud
   release boshqaruvi qo‘llanadi; DB yoki Redisning boshqa instansiyasi almashtirilmaydi.
5. Dev va stagingda `FF_CASE_OPENING_V2=true`,
   `FF_CASE_OPENING_V2_PERCENTAGE=100` belgilang va backend konfiguratsiyasini
   qayta yuklang. [Demo](DEMO.md)ni ikki tergovchi va admin bilan tekshiring.
6. Production canary: `FF_CASE_OPENING_V2=true`,
   `FF_CASE_OPENING_V2_PERCENTAGE=10`. Tanlov SHA-256(userId) asosida stabil;
   har so‘rovda tasodifiy qayta tanlanmaydi. Flag serverda o‘qiladi,
   frontend `/api/case-opening/config`ni 10 soniyada yangilaydi.
7. Claim/submit muvaffaqiyati, 409/422/429, 5xx, qoralama va P95ni kuzating.
   Qabul mezonlari bajarilgandan keyin foizni 100ga o‘tkazing; kamida bir hafta
   metrikalarni tekshiring. V1ni bu release’da o‘chirmang.

Env o‘zgarishi yangi kod deployini talab qilmaydi; ishlayotgan process yangi
envni o‘zi olmagani uchun konfiguratsiya reloadi/restart kerak bo‘ladi.
Frontend build-time Vite flagiga bog‘lanmagan.

## Metrikalar

```powershell
pnpm metrics:case-opening
pnpm metrics:case-opening .local/http.log
```

Skript oxirgi 7 kunni hisoblaydi: claim/submit total, success va rate,
averageScore, uniqueTabVisits, P95 va oxirgi ko‘rilgan tabda submitsiz qolgan
user/case sessiyalar (`dropOff`). Sessiya keyin davom ettirilishi mumkin;
drop-off yakuniy voz kechish deb talqin qilinmaydi. Log rotation bo‘lsa,
tahlilga to‘liq 7 kunlik UTF-8 JSON-lines logini bering.

Har v2 javob statusi, guard rad etishi ham, bir marta qayd etiladi.
Logda caseId/userId/action/duration/requestId/status bor; body, token,
PINFL, contact yoki note chiqmaydi. Submit muvaffaqiyatida totalScore bor.
Varaq ko‘rish hodisalari auditga ham yoziladi.

`alerts.serverErrors > 0` yoki kamida 10 ta submitda success rate 95%dan
past bo‘lsa CLI exit code 2 qaytaradi. Mavjud log/alert tizimi shu natijani
iste’mol qilishi mumkin. Yangi tashqi Sentry/Grafana hisobi yoki notification
kanali yaratilmagan. To‘g‘ri xulosa uchun kutilgan 409/422/429larni ajrating.

| Budjet        | Chegara       |
| ------------- | ------------- |
| Dashboard API | P95 < 800 ms  |
| Preview API   | P95 < 600 ms  |
| Workspace API | P95 < 1200 ms |
| Submit API    | P95 < 2000 ms |
| Document API  | P95 < 1500 ms |

Mahalliy API o‘lchovi sahifa renderi yoki production bir vaqtdagi yuklamani
tasdiqlamaydi. Real tarmoqda shu endpointlar va browser yuklanishi ham kuzatiladi.

## Backup vositasi

`PG_DUMP_PATH` / `PG_RESTORE_PATH` orqali target major versiyasiga mos
clientni belgilang. Windowsda mavjud `.tools/postgres-client-16.16/bin/`
avtomatik tanlanadi; boshqa muhitda PATHdagi client ishlatiladi.
Client paketining rasmiy manbasi: [EDB binaries](https://www.enterprisedb.com/download-postgresql-binaries?lang=en).
Yangi pg_dump bilan olingan dumpni eski serverga qayta yuklash kafolatlanmagan;
shu sabab mos major ishlatiladi. [PostgreSQL pg_dump hujjati](https://www.postgresql.org/docs/18/app-pgdump.html).
