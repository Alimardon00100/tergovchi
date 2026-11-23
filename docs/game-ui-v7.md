# Detective Interactive Scene v7

2026-11-22. Loyiha brauzerda ishlaydigan point-and-click detektiv o‘yini ko‘rinishiga o‘tkazildi. Asosiy sahnalar butun oynani egallaydi. Xonalar doskadagi polaroid suratlar orqali ochiladi; orqaga qaytish qog‘oz yorliq yoki Esc bilan bajariladi.

## Faza 0 — arxitektura va resurslar

React 18 / TypeScript frontend mavjud NestJS 11, Fastify 5, Prisma va PostgreSQL API bilan ishlaydi. JWT access/refresh, Argon2id, bir martalik ball tranzaksiyasi va unvon mexanizmi saqlandi.

- `src/shared/scene/SceneBackdrop.tsx`: sahna rasmlari va marshrutlar xaritasi; fonlar CSS `background-image` bilan beriladi.
- `src/shared/scene/SceneObjects.tsx`: qog‘oz sarlavha, ichki varaqlash va ekran o‘lchami.
- `src/app/Layout.tsx`: himoyalangan sahna, `LayoutGroup` / `layoutId`, kamera o‘tishi va qog‘oz qaytish yorlig‘i.
- `src/features/board/`: kork doska va real mix koordinatalarini kuzatuvchi SVG iplar.
- `src/features/cases/`: stol papkalari, umumiy `layoutId` bilan ochiladigan ish va dalillar.
- `src/features/{auth,rooms,profile,statistics,admin}/`: tegishli sahna amallari.
- `public/scenes/`: beshta lokal WebP fon; [yaratish promptlari](game-assets.md).

Asl matnda ko‘rsatilgan rasmlar biriktirilmagan. Yangi sahna fonlari built-in imagegen vositasida yaratildi. Ular asl reference rasmlari deb ko‘rsatilmaydi. CSS fon ustiga vinyetka, yupqa plyonka teksturasi va haqiqiy interaktiv qog‘ozlar qo‘yiladi.

Senior o‘zini baholash: **9/10**. Asos: ishlaydigan server va saqlanuvchi baza; cheklov: production yuk testi bu o‘zgarishga kirmaydi.

## Faza 1 — xizmatga kirish

Noir stol, chiroq, telefon va shlyapa foni. Markazdagi xizmat varaqasida chiziqli yozuv mashinkasi maydonlari va qizil muhr tugmasi. Haqiqiy ro‘yxatdan o‘tish/kirish va xato javoblari mavjud. Shriftlar lokal `Special Elite`, `Playfair Display` va `Courier New`.

Senior o‘zini baholash: **8.8/10**. Desktop va mobil shakllar tekshirildi; qisqa ekranlarda faqat varaqning ichi aylanishi mumkin.

## Faza 2 — kork doska

Yog‘och ramkali kork fon. Profil guvohnomasi, beshta qadalgan surat, qayd qog‘ozi va admin uchun Maxfiy arxiv joylangan. Qog‘ozlar foizli `position:absolute` va `rotate` bilan joylashtiriladi. Qizil iplar pinlarning DOM koordinatalaridan hisoblanadi; ekran/shrift o‘zgarganda va hover paytida yangilanadi. Iplar `stroke-dashoffset` bilan tortiladi. Suratdagi `layoutId` kirilayotgan sahnaga mos keladi. Tizimning reduced-motion sozlamasi ham hurmat qilinadi.

Senior o‘zini baholash: **9/10**. Asos: sidebar/navbar yo‘q, ip uchlari haqiqiy mixlarga ulanadi va klaviatura bilan suratlarni tanlash mumkin.

## Faza 3 — tergov stoli

Papka, skrepka, foto, yozuv mashinkasi nomi va holat muhri. Bosilganda papka o‘rtaga kattalashib ochiladi, orqadagi stol xiralashadi. Birinchi ochishda API ball beradi va dalil matnini ochadi; takror o‘qish ball bermaydi. Desktopda 6, mobilda o‘qiladigan 2 papka ko‘rinadi; qolganlari qog‘oz varaqlash orqali ochiladi. Sahifaning o‘zi scroll qilmaydi. Uzun dalillar faqat ochiq papka ichida aylantiriladi.

Senior o‘zini baholash: **8.8/10**. Asos: haqiqiy ball va saqlanish, 320 px ekran ham ishlaydi. Papkalar uchun oltita alohida to‘qima personaj portreti yaratildi; ular haqiqiy shaxs yoki real jinoyatga tegishli emas.

## Faza 4 — boshqa xonalar

Nazorat zalida eski monitorlar, Himoya xonasida qonun kitoblari va tarozi, Hukm zalida sudya bolg‘asi tushirilgan alohida fon bor. Nazorat va Himoyada davom etayotgan ishlar, Hukmda yakunlangan ishlar ko‘rinadi. Dalillarni o‘rganish va ishni yakunlash bazada saqlanadi.

Senior o‘zini baholash: **8.6/10**. Asos: alohida atmosferalar va haqiqiy progress. Yakunlash foydalanuvchi amali; avtomatik aybdorni aniqlash tizimi qo‘shilmagan.

## Faza 5 — hisobot va maxfiy arxiv

Statistika qog‘ozdagi qo‘lda chizilgandek SVG grafik, xizmat qaydlari va tergovchilar ro‘yxati shaklida. Mock raqam yo‘q. Profil shaxsiy varaq ko‘rinishida ism va harakat sozlamasini saqlaydi. Admin doskadagi Maxfiy arxiv qog‘ozi orqali kiradi, yozma daftarda ishlarni ko‘radi va yangi ishni muhrlab e’lon qiladi. Server rolni mustaqil tekshiradi.

Senior o‘zini baholash: **8.8/10**. Cheklovlar: fayl yuklash, dalil tahriri va parolni tiklash bu o‘zgarishga kirmaydi.

## Tekshirish

`pnpm test:browser` alohida Chromium kontekstida vaqtinchalik hisobdan foydalanadi. Auth, barcha xonalar, mix/ip koordinatalari, no-scroll, qidiruv/filtr, dalillar, takroriy ballsiz o‘qish, 200 ball/Katta leytenant, profil, 375×812 va 320×568 mobil sahnalar, maxfiy arxiv va animatsiyalar tekshiriladi. Sinov hisobi va sinov ishi oxirida olib tashlanadi.

Ekran rasmlari `.cache/qa/game-ui/` da. Browser pluginida mavjud brauzer aniqlanmagani uchun yangi headless Chromium ishlatildi; foydalanuvchining brauzer profili o‘qilmadi.

Launcherda paket yangilanishidan so‘ng kuzatilgan Windows `EPERM symlink` holati bir marta qayta uriniladi. Oddiy tarmoq xatosi darhol to‘xtaydi; bu ikki holat va qayta urinish chegarasi alohida real child-process testlari bilan tekshiriladi.

Yakuniy kod tekshiruvlari: 69 ta unit/runtime/asset testi, 15 ta PostgreSQL integratsiya testi va 9 ta HTTP testi — jami 93 ta o‘tdi. TypeScript va ESLint o‘tdi. Paketlar auditida 0 topilma.

Yakuniy brauzer natijasi: barcha oqimlar muvaffaqiyatli o‘tdi, console/page xatosi qayd etilmadi. 1440×900, 375×812 va 320×568 ekranlar tekshirildi. Animatsiyani kamaytirish rejimi va oddiy animatsiyali yuklanish alohida sinovdan o‘tdi; hoverda iplar mix ortidan siljishi ham tasdiqlandi. 5 ta fon va 6 ta portret loyiha ichida saqlangan.
