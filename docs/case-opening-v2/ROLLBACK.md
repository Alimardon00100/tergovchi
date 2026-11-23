# Case opening v2 — rollback playbook

## Odatdagi rollback: flag

1. Target runtime konfiguratsiyasida `FF_CASE_OPENING_V2=false` belgilang.
2. Backend konfiguratsiyasini mavjud xavfsiz reload/restart yo‘li bilan yangilang.
   Yangi kod deployi yoki DB downgrade kerak emas.
3. `/api/case-opening/config` joriy foydalanuvchi uchun `{enabled:false}`
   qaytarishini tekshiring. V2 endpointi 404, v1 endpointi ishlashi kerak.
4. Sahifani qayta oching yoki 10 soniyalik config refreshini kuting.
   Legacy workspace qaytadi. Yuborilmagan v2 qoralama v1 bilan bir xil local
   formatda ham saqlanadi; reconnectdan keyin legacy orqali yuborilishi testlangan.
5. V1 character va HTTP smoke testlarini tekshiring. Mavjud ustunlar, yangi
   shifrlangan contact/note va barcha urinishlarni saqlang.

## Zarurat bo‘lsa eski buildga qaytish

Rollback nuqtasi: `fix-case-opening/pre-refactor` (`d412b39`). Phase checkpointlar
`fix-case-opening/phase-0` … `phase-7` va rollout tayyorgarligi commitida mavjud.
Ishchi daraxtdagi o‘zgarishlarni yo‘qotmaslik uchun `reset --hard` ishlatmang.
Eski buildni alohida worktree yoki mavjud release artefaktidan tayyorlang:

```powershell
git worktree add .cache/case-opening-rollback fix-case-opening/pre-refactor
```

Eski build yangi nullable ustunlar bilan ishlay oladi. Shuning uchun odatda
DB ustunlarini tushirish talab etilmaydi. Ishlayotgan server oldingi DLLni
band qilsa, Prisma generationdan avval faqat shu ilovaning runtime’ini
odatiy launcher/release mexanizmi bilan to‘xtating; PostgreSQL/Redisni o‘chirmang.

## DB down — faqat alohida release zarurati bo‘lsa

1. V2ni o‘chiring va yozishlarni to‘xtating. Backup buyrug‘ini yana bajaring:
   `pnpm backup:case-opening:database`. Yangi `.dump.json` va arxiv mavjudligini
   tekshiring. Dastlabki backupdan keyingi yozuvlar ham saqlanishi kerak.
2. Eski schema bilan generatsiya qilingan eski backend buildiga o‘ting.
   Yangi Prisma klienti ustunlarni SELECT qilishi sabab, uni ishlatib turib
   DB downni bajarmang.
3. Target ulanishini PostgreSQLning xavfsiz PGHOST/PGPORT/PGUSER/PGDATABASE/
   PGPASSWORD konfiguratsiyasi orqali bering; parolni terminalga chiqarmang.
   `detective-board` ildizidan, targetga mos `psql` bilan:

   ```powershell
   psql -X --single-transaction --set ON_ERROR_STOP=1 --file=apps/api/prisma/rollbacks/202611230001_case_opening_v2.sql
   ```

4. SQL yangi contact/note qiymatlarini `CaseOpeningPersonRollback` jadvaliga
   ko‘chiradi va faqat ikki yangi ustunni tushiradi. Eski Person/CaseFile,
   hujjatlar, etalon, ball va seed yozuvlari o‘chirilmaydi.
5. Prisma migratsiya tarixini qo‘lda noto‘g‘ri belgilamang: `db execute`/psql
   Prisma historyni avtomatik orqaga qaytarmaydi. Qayta v2ga o‘tishdan oldin
   keyingi qadam bo‘yicha ustunlarni qayta qo‘shing; backup jadvalini saqlang.

## Down’dan keyin yana up

1. Yangi ustunlar yo‘q bo‘lsa, yozishlarni to‘xtatgan holda faqat shu SQLni
   targetga transactionda bajaring:

   ```powershell
   psql -X --single-transaction --set ON_ERROR_STOP=1 --file=apps/api/prisma/migrations/202611230001_case_opening_v2/migration.sql
   ```

2. Yangi backend/schema klientini tayyorlang, keyin `pnpm backfill:case-opening`.
   Bu backup jadvalidan faqat null maydonlarni tiklaydi; qayta ishlatish xavfsiz.
   Birinchi odatiy upda eski odamlarning yangi maydonlari null qoladi.
3. `pnpm test:case-opening:migration` va character testlarini alohida `_test`
   bazada bajaring. V1 va v2 preview/workspace parityni tekshiring.
4. Flagni faqat [rollout](ROLLOUT.md) tartibi bilan yoqing. Backup jadvalini
   avtomatik o‘chirmang; keyingi retention qarori alohida o‘zgarish bo‘ladi.

Up → down → up → backfill aynan PostgreSQL test sxemasida tekshirildi:
shifrlangan contact/note tiklandi, idempotency va eski row count saqlandi.
Pg_dump arxivi `pg_restore --list` va SHA-256 bilan tekshirildi; productionga
restore bajarilmadi. `.local/http-secret` va hujjat fayllari saqlanishi zarur.
