# Tergov doskasi

O‘zbek tilidagi point-and-click detektiv o‘yini. Interfeys noir stol, kork doska va interaktiv qog‘oz sahnalaridan iborat. React brauzer interfeysi va NestJS 11 / Fastify 5 HTTP serveri haqiqiy PostgreSQL bazasi bilan ishlaydi. Tergov doskasi, to‘rtta xona, ish papkalari va dalillar, ball/unvonlar, statistika, profil va administrator uchun yangi ish yaratish mavjud.

## Jinoyat ishi moduli v2

Doskaning **Jinoyat ishlari reyestri** qog‘ozi yoki **/case-files** manzili orqali yangi modulni oching. JPK hujjatlari va JK kvalifikatsiyasi, 5 rol, 24 soatlik lock, 100 ballik F1 baholash, 3 urinish, admin etaloni, audit, PDF/DOCX, uch til va offline qoralama ishlaydi. [Setup va demo](docs/case-module/README.md) · [C4/ERD](docs/case-module/architecture.md) · [OpenAPI 3.1](docs/case-module/openapi.json). Demo hisob parollari faqat mahalliy .local/demo-users.json faylida.

## Windowsda ishga tushirish

Node.js 22.13+ (22.x), 24.x yoki 26.x va Windows x64 kerak. [run.bat](run.bat) faylini ikki marta bosing. Ish joyining asosiy papkasidagi `run.bat` ham shu launcherni chaqiradi.

Birinchi ishga tushirishda internet kerak. Launcher pnpm va bog‘liqliklarni tayyorlaydi, loyiha uchun alohida PostgreSQL 16 va Redis 7 ni o‘rnatmasdan ishga tushiradi, bazalarni yaratadi, migratsiya va seedni bajaradi. Keyin interfeys va serverni yig‘ib, brauzerni ochadi. Parollar avtomatik yaratiladi; admin paroli faqat `.env` da qoladi.

Odatdagi manzil: **http://127.0.0.1:3000/board**. Port band bo‘lsa tanlangan manzil terminalda chiqariladi. Yangi foydalanuvchi kirish sahifasidagi “Ro‘yxatdan o‘tish” orqali hisob yaratadi; parol kamida 12 belgi. Admin hisobining manzili va paroli `.env` dagi `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` qiymatlaridir. Ularni chat yoki logga nusxalamang.

Kompyuterdagi mavjud PostgreSQL yoki boshqa tizim xizmatlari qayta sozlanmaydi. Odatdagi loyiha portlari 15432 va 16379; band bo‘lsa dastlabki sozlashda bo‘sh port tanlanadi.

```powershell
.\run.bat --no-pause
.\run.bat --no-pause --no-browser
.\run.bat --stop --no-pause
```

`--stop` web server va loyiha xizmatlarini to‘xtatadi va ma’lumotlarni saqlaydi. Keyingi ishga tushirish shu bazani davom ettiradi. Oddiy ikki marta bosilganda natijani o‘qish uchun oyna ochiq qoladi; uni yopish serverni to‘xtatmaydi.

## Interfeysdan foydalanish

- **Tergov doskasi** — qadalgan polaroid xonalar, mixlarga bog‘langan qizil iplar va shaxsiy guvohnoma. Surat ustiga bosib xonaga kiring.
- **Tergov xonasi** — 6 ta boshlang‘ich ish, qidiruv va qiyinchilik/holat filtrlari. Ishni boshlash dalillarni ochadi va ball beradi; takror ochish qo‘shimcha ball bermaydi.
- **Nazorat zali / Himoya xonasi** — davom etayotgan ishlar va materiallar. “Tergovni yakunlash” ishni Hukm zaliga o‘tkazadi.
- **Statistika / Profil** — oxirgi 7 kunlik haqiqiy ballar, ishlar holati, yetakchilar, ismni saqlash va animatsiyani kamaytirish sozlamasi.
- **Maxfiy arxiv** — faqat administrator uchun; yangi ish darhol e’lon qilinadi.

Boshlang‘ich 18 ta matnli dalil o‘quv uchun yozilgan to‘qima materiallardir. Eski olti o‘quv ishini yakunlash foydalanuvchi amali bo‘lib qoladi; yangi /case-files modulida kvalifikatsiya etalonga ko‘ra avtomatik baholanadi. Admin sahifasida dalil/fayl tahriri, parolni tiklash va elektron pochta tasdig‘i hali yo‘q. Ishlar ro‘yxati hozir 100 ta e’lon qilingan ish bilan chegaralangan.

## Saqlanadigan fayllar

- `.local/postgres/` — PostgreSQL ma’lumotlari.
- `.local/redis/` — Redis ma’lumotlari.
- `.local/services.json` — loyiha portlari va xizmat parollari.
- `.local/postgres.log`, `redis.log`, `setup.log` — diagnostika.
- `.local/http.log`, `web.json` — web server diagnostikasi va manzili.
- `.local/http-secret`, `http-control` — maxfiy imzolash va mahalliy boshqaruv kalitlari; saqlang va ulashmang.
- `.tools/` — loyiha uchun bajariluvchi fayllar.
- `.env.before-local-services` — avtomatik sozlashdan oldingi muhit nusxasi.

Bu fayllar Gitga kiritilmaydi. `.local` ni o‘chirish loyiha ma’lumotlarini yo‘qotadi. Oddiy to‘xtatish uchun `--stop` ishlating.

## Mavjud serverlardan foydalanish

Mahalliy avtomatik xizmatlar o‘rniga o‘z serverlaringizdan foydalanish uchun `.env` da rejimni aniq belgilang:

```dotenv
LOCAL_SERVICES=external
DATABASE_URL=postgresql://detective:YOUR_PASSWORD@127.0.0.1:5432/detective?schema=public
TEST_DATABASE_URL=postgresql://detective:YOUR_PASSWORD@127.0.0.1:5432/detective_test?schema=public
REDIS_URL=redis://127.0.0.1:6379
```

Bu rejimda hisob va bazalar oldindan mavjud bo‘ladi. PostgreSQL 16 hamda Redis 7 xizmatlarini o‘zingiz boshqarasiz. Paroldagi maxsus URL belgilarini encode qiling. Linux/macOS va CI uchun shu rejim qo‘llanadi.

Avvalgi loyiha shablonidagi `127.0.0.1:15432/detective` manzili avtomatik mahalliy rejimga o‘tkaziladi; eski `.env` nusxasi saqlanadi. Boshqa tashqi server manzillari avtomatik almashtirilmaydi.

## Terminal buyruqlari

pnpm 9.15.9 mavjud terminalda:

```powershell
pnpm start
pnpm services:check
pnpm services:stop
```

`services:check` TCP portlarini, `db:verify` esa haqiqiy login va seed natijasini tekshiradi. PowerShellda kerak bo‘lsa `pnpm.cmd` dan foydalaning.

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:db
pnpm test:http
pnpm build
pnpm format:check
```

Mahalliy rejim `detective_test` bazasini ham yaratadi. Integratsiya sinovi har safar alohida tasodifiy sxemadan foydalanadi, yakunda faqat o‘sha sxemani olib tashlaydi.

Brauzer sinovi uchun avval ilovani ishga tushiring. Alohida Chromium yuklash va sinash (PowerShell):

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.cache/playwright"
pnpm exec playwright install chromium
pnpm test:browser
```

Sinov vaqtinchalik `qa-browser-…@example.test` hisobini yaratadi, yakunda faqat o‘sha hisobning yozuvlarini o‘chiradi. Ekran tasvirlari `.cache/qa/game-ui-v11/` da qoladi. Port o‘zgarsa `E2E_URL=http://127.0.0.1:PORT` belgilang.

Oddiy foydalanish va ishlab chiqarish buildini tekshirish uchun BAT launcherdan foydalaning.

## Bajariluvchi fayllar manbasi

PostgreSQL 16.16 [embedded-postgres](https://github.com/leinelissen/embedded-postgres) platform paketidan olinadi va versiya lockfile’da mahkamlangan. Windows uchun Redis 7.2.16 [redis-windows](https://github.com/redis-windows/redis-windows) loyihasidan olinadi; arxiv hajmi va SHA-256 tekshirilgandan keyin ochiladi. Ushbu Windows porti mahalliy ishlab chiqish uchun; ishlab chiqarishda tashqi server rejimi tanlanadi.

## Hujjatlar

[Runbook](docs/runbook.md), [runtime qarori](docs/adr/009-native-runtime.md), [HTTP/UI qarori](docs/adr/010-browser-app.md), [rasm manbalari](docs/assets.md) va [brauzer tekshiruvi](docs/browser-review.md). `phase-0-review.md` avvalgi poydevor bosqichining tarixiy hisobotidir.

[Faza 0–5 va senior baholari](docs/game-ui-v7.md), [yangi fonlar va promptlar](docs/game-assets.md). Xonadan doskaga qog‘oz yorliq yoki Esc bilan qayting; ochiq papkada Esc avval papkani yopadi. Desktopda 6, mobilda 2 papka ko‘rinadi. Qolganlari Oldingi/Keyingi orqali varaqlanadi.

## Metall seyf va rasmlar

Profilning chap tomonida uch metall javon bor: maxsus vositalar, ochilgan va ochilmagan ishlar. O‘ngga ochiladigan eshikning ichki tomonida guvohnoma, unvon, ball, avatar, hisobdan chiqish va parolni o‘zgartirish joylashgan. Telefonda `Profil` / `Javonlar` tugmalaridan foydalaning. Seyf papkasi aynan o‘sha ishni Tergov xonasida ochadi. Avatar va admin qo‘shadigan yangi ish rasmi haqiqiy fayl sifatida saqlanadi; yangi ishda rasm majburiy. JPG/PNG/WebP, 4 MB gacha, kamida 64×64 tanlang.

`.local/uploads/` ichida avatar va ish rasmlari turadi. Ma’lumotlarni ko‘chirish yoki zaxiralashda ushbu papkani PostgreSQL bazasi bilan birga saqlang. Filtrlar qog‘oz uslubidagi ro‘yxatlar, Tergov xonasining asl stoli esa o‘zgarishsiz qoldirilgan.

[Faza 0–4 va tekshiruv hisoboti](docs/game-ui-v9.md), [v9 rasmlari va promptlari](docs/game-assets-v9.md).

[Metall seyfning to‘liq React/SVG/CSS kodi va parol API izohi](docs/profile-safe.md). Parol o‘zgarganda barcha mavjud sessiyalar yopiladi va yangi parol bilan qayta kiriladi. Eski Argon2 hisoblari ishlashda davom etadi; yangi parol bcrypt bilan saqlanadi.

## v11: shaxsiy jild va barcha ishlar

Seyfdagi guvohnomaning istalgan joyini bosib to‘liq profilni oching. `Tahrirlash` orqali ism, avatar va parolni yangilang; yangi parolni takrorlash talab qilinadi. `OCHILGAN ISHLAR` javoni faqat yakunlangan ishlar uchun. Har ikki javondagi `Hammasi` barcha ishlarni, jumladan jarayondagilarni ham suratli papkalarda ochadi. Yuborilgan to‘qqizta pagon surati unvonlarga bog‘langan.

[Joriy v11 komponentlari, rasmlar mosligi va tekshiruv hisoboti](docs/profile-safe-v11.md).
