# Metall seyf — avvalgi profil bosqichi

Joriy komponentlar va yangi modal oynalar: [v11 hisoboti](profile-safe-v11.md).

Rasmdagi tuzilish asosida profil qayta qurildi: chapdagi uch metall javon va o‘ngga ochilgan eshikning ichki tomonidagi guvohnoma. Tergov xonasi va uning fon fayli o‘zgartirilmadi.

## To‘liq kod

- [Profile.tsx](../apps/web/src/features/profile/Profile.tsx): API so‘rovlari, profil, avatar, saqlash, logout, metall eshik va mobil ko‘rinish.
- [SafeEquipment.tsx](../apps/web/src/features/profile/SafeEquipment.tsx): M1911 uslubidagi dekorativ pistolet, metall kishan va uch yulduzli pagon SVG kodlari.
- [SafeShelf.tsx](../apps/web/src/features/profile/SafeShelf.tsx): papkalar, muhrlar, varaqlash va aniq ishga yo‘naltirish.
- [PasswordDialog.tsx](../apps/web/src/features/profile/PasswordDialog.tsx): qog‘oz parol formasi, validatsiya, xato xabari va saqlash.
- [profile.css](../apps/web/src/features/profile/profile.css): faqat profilga tegishli metall, qog‘oz, eskirish va soya uslublari. Mavjud TailwindCSS va Framer Motion tizimiga ulangan.

Ism, unvon, ball, avatar va keyingi unvonga qolgan ball serverdan olinadi. Ular namuna rasmdagi qiymatlarga qattiq bog‘lanmagan. Masalan, Alimardon Xursandov hisobiga kirilsa, shu hisobning haqiqiy ma’lumotlari ko‘rinadi. Rasm bo‘lmasa, detektiv silueti va `Tergovchi_1` yorlig‘i chiqadi. Surat ustiga bosib avatarni yuklash mumkin.

## Eshik animatsiyasi

Tashqi konteyner `perspective: 2100px` va `transform-style: preserve-3d` ishlatadi. Framer Motion eshikni o‘ng ilgak atrofida ochadi:

```tsx
<motion.div
  initial={{ rotateY: 0 }}
  animate={{ rotateY: open ? 132 : 0 }}
  transition={{ duration: 1.15, ease: [0.22, 0.7, 0.2, 1] }}
  style={{ transformOrigin: '100% 50%' }}
/>
```

Eshikning ichki yuzasi `rotateY(180deg)` bilan teskari tomonga o‘rnatilgan; `backface-visibility: hidden` tashqi yozuvlarni ichkaridan ko‘rsatmaydi. `Qulflash` eshikni yopadi; old tomondagi metall tugma uni qayta ochadi. Kamaytirilgan harakat rejimi hisobga olinadi.

Desktopda javonlar va guvohnoma bir paytda ko‘rinadi. 650 px dan tor ekranda matn o‘qilishi uchun `Javonlar` / `Profil` metall tugmalari ishlatiladi. Sahifa scroll qilmaydi; faqat kichik ekrandagi uzun parol hujjati ichida scroll bo‘lishi mumkin.

## SVG va fizik materiallar

Pistolet konturi bir nechta SVG `path` bilan chizilgan. Qora metall korpusga yo‘nalishli gradient, yaltirash chiziqlari, soyalar, yog‘och dastaga esa jigarrang gradient va mayda naqsh berilgan. Bu dekorativ tasvir; boshqariladigan qurol mexanikasi yo‘q.

Kishan ikkita metall halqa, ustki mexanik qobiq va bog‘lovchi zanjir konturlaridan iborat. Qatlamli kontur, och metall gradienti va `feDropShadow` unga qalinlik beradi. Pagon ham SVG: metall asos va uchta oltin yulduz. Bular o‘yin uchun tasvirlar, rasmiy xizmat belgilari standarti emas.

Papkalar qog‘oz gradienti va pastki soyalar bilan chizilgan. `OCHILGAN` hamda `OCHILMAGAN` qizil muhrlari ingichka qirra, xira siyoh va ozgina aylantirish orqali bosma ko‘rinishga keltirilgan. Framer Motion hoverda papkani `scale: 1.05` qilib ko‘taradi; kamaytirilgan harakat rejimida animatsiya yo‘q. Papka `/investigation-room?case=UUID` orqali aynan shu ishni ochadi.

## Server API

NestJS umumiy `/api` prefiksi bilan quyidagilarni taqdim etadi:

| Endpoint                       | Natija                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `GET /api/users/me`            | Ochiq profil maydonlari, joriy unvon va rivojlanish. Parol hashi qaytarilmaydi.    |
| `GET /api/users/me/cases`      | `opened` va `unopened` massivlari. Ochilgan — jarayondagi yoki yakunlangan ishlar. |
| `POST /api/users/me/avatar`    | Haqiqiy multipart rasm yuklash; mavjud tekshirish va WebP saqlash saqlangan.       |
| `PATCH /api/users/me/password` | `{ oldPassword, newPassword }`; eski parolni tasdiqlash va yangisini saqlash.      |
| `POST /api/auth/logout`        | Cookie tozalash va sessiya oilasini bekor qilish.                                  |

Yangi parol kamida 12 belgidan iborat, bcrypt chegarasi sabab UTF-8 formatida 72 baytdan oshmaydi. Yangi hash `bcryptjs`, 12 rounds bilan saqlanadi. Oldingi Argon2 hisoblari moslik uchun tekshiriladi; bcrypt bilan saqlangan parollar bcrypt bilan tekshiriladi. Parolni almashtirish uchun eski parol kerak, bu parolni tiklash oqimi emas.

Yangi hash, barcha sessiyalarni bekor qilish va parolsiz audit yozuvi bitta Prisma tranzaksiyasida bajariladi. Kirish, refresh va parol almashinuvi bir xil foydalanuvchi qulfiga amal qiladi. Bir vaqtdagi ikki parol almashtirishdan bittasi qabul qilinadi. Muvaffaqiyatdan keyin foydalanuvchi yangi parol bilan qayta kiradi. Mavjud foydalanuvchilarni yoki ularning parollarini migratsiya bilan almashtirish bajarilmagan.

## Yakuniy tekshiruv — 2026-11-22

- `pnpm test`: 69/69 unit, runtime va asset sinovi.
- `pnpm test:db`: 15/15 PostgreSQL integratsiya sinovi.
- `pnpm test:http`: 19/19 HTTP sinovi; jami **103/103**.
- Typecheck, ESLint, Prettier va API/web production build o‘tdi. Bcrypt qo‘shilgandan keyingi paket auditida ma’lum zaiflik topilmadi.
- BAT launcher tayyorlash, migratsiya/seed, ulanishlar, build va serverni ishga tushirishdan muvaffaqiyatli o‘tdi.
- Alohida yangi headless Chromium kontekstida 1440×900, namunadagi 1024×572, 375×812 va 320×568 ko‘rinishlar tekshirildi. In-app browser mavjud bo‘lmagani uchun avvalgi mahalliy Playwright usuli ishlatildi.
- Profilni/avatarning saqlanishi, har ikkala turdagi papkalar, aniq ishga o‘tish, yopish/qayta ochish, kamaytirilgan/normal animatsiya, qog‘oz parol formasi, noto‘g‘ri eski parol xabari, muvaffaqiyatli almashtirish va yangi parol bilan kirish brauzerda tekshirildi.
- Papka raqami, sarlavhasi va muhri bir-birini to‘smasligi, profil matni tugmalar ustiga tushmasligi va sahifada scroll yo‘qligi tekshirildi. Sinovda atay yuborilgan noto‘g‘ri parolning kutilgan 400 javobidan tashqari brauzer xatosi yo‘q.

Tasvirlar `.cache/qa/game-ui-profile/` ichida: `safe.png`, `reference-safe.png`, `safe-closed.png`, `mobile-safe.png`, `mobile-shelves.png`, `small-safe.png`, `small-shelves.png`, `password-desktop.png`, `password-mobile.png`.

Tergov xonasining `apps/web/public/scenes/desk.webp` SHA-256 qiymati o‘zgarmagan:

`150c0049e019be1ab85044278548b48bc1cb7a89e4cbf421782051b044eea583`

Sinov hisoblari vaqtinchalik bo‘lib, o‘z yozuvlari va yuklagan fayllari bilan tozalandi. Mavjud foydalanuvchi ma’lumotlari saqlandi.
