# Mahalliy xizmatlarni boshqarish

## Boshlash va to‘xtatish

`run.bat` yoki `pnpm start` loyiha xizmatlari, migratsiya, seed va tekshiruvni bajaradi. `run.bat --stop` yoki `pnpm services:stop` xizmatlarni ma’lumotlarni saqlab to‘xtatadi.

Mahalliy rejim Windows x64 da ishlaydi va tizimga xizmat o‘rnatmaydi. Mavjud boshqa PostgreSQL serveriga tegmaydi. CI va boshqa platformalarda LOCAL_SERVICES=external qo‘llanadi.

## Ulanishlarni tekshirish

```powershell
pnpm services:check
pnpm db:verify
```

Birinchisi portni, ikkinchisi autentifikatsiya va seedni tekshiradi. Amaldagi portlar `.env` da; odatda 15432 va 16379. Port ochiqligi parol to‘g‘riligini anglatmaydi.

## Ishga tushirish xatosi

`.local/http.log`, `setup.log`, `postgres.log` va `redis.log` ni tekshiring. Birinchi yuklashda internet kerak; Redis arxivi SHA-256 tekshiruvidan o‘tmasa ishga tushirilmaydi. Xizmatlarni tayyorlash loyiha qulfi bilan navbatlanadi. Web ilovani bitta launcher oynasidan boshlang.

Mahalliy rejimda `.local/services.json` dagi parollarni qo‘lda almashtirmang: ular bazadagi hisob va Redis sozlamasiga mos bo‘lishi kerak. Tashqi rejimda URL va hisoblar serverning o‘ziga moslanadi.

## Migratsiya va seed

```powershell
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

Mavjud migratsiya SQLini tahrirlamang. Seed mavjud admin paroli va tahrirlangan ishlarni qayta yozmaydi. Admin paroli faqat `.env` da; ulanish URLlari va maxfiy fayllarni tashqi loglarga yubormang.

## Ma’lumotlarni saqlash

Asosiy ma’lumotlar `.local/postgres` va `.local/redis` da. Bu papkalarni odatiy to‘xtatish yoki xatoni tuzatish uchun o‘chirmang. Avval `services:stop` bilan to‘xtating, so‘ng zaxira oling.

`pg_dump` o‘rnatilgan bo‘lsa, `.env` dagi host/portga moslab formatli dump yarating. Parolni buyruq argumentida bermang. Tiklashni avval yangi, bo‘sh bazada sinang. Zaxira/tiklash mashqi bu o‘zgarishda bajarilmagan.

Avtomatik muhitga o‘tishdan oldingi qiymatlar `.env.before-local-services` da qoladi. Eski tashqi bazaning ma’lumotlari avtomatik ko‘chirilmaydi yoki o‘chirilmaydi.

## Joriy faza

Launcher HTTP serverni alohida yashirin jarayonda boshlaydi, sog‘liq tekshiruvini kutadi va brauzerni ochadi. Manzil odatda http://127.0.0.1:3000/board. `--no-browser` avtomatik ochishni o‘chiradi. `/api/health` muvaffaqiyatli javobi PostgreSQLga so‘rov bajarganini bildiradi; Redis alohida `db:verify` da tekshiriladi.

Qayta boshlashda avval aynan shu loyihaning HTTP serveri maxfiy boshqaruv kaliti bilan to‘xtatiladi. Bu Prisma DLL faylining Windowsda band qolishini oldini oladi. `--stop` avval web serverni, so‘ng bazalarni to‘xtatadi. Ilova faqat loopback manzilida tinglaydi.
