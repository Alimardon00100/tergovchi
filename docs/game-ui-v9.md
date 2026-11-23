# v9 — Detective: Immersive UI

## Faza 0 — Tuzilish va fonlar

React sahnalari `apps/web/src/features/` ichida. Xona fonlari `shared/scene/SceneBackdrop.tsx` orqali `/scenes/*.webp` dan olinadi; sahna, vignette va donador tekstura alohida qatlamlarda turadi. Polaroidlar, qog‘ozlar, mixlar va iplar mavjud sahna tizimini davom ettiradi. Seyf profilning alohida sahnasidir.

Foydalanuvchi talabiga ko‘ra **Tergov xonasi foni o‘zgartirilmadi**: `apps/web/public/scenes/desk.webp`, uning yo‘li va asosiy fon effektlari saqlandi. SHA-256:

`150c0049e019be1ab85044278548b48bc1cb7a89e4cbf421782051b044eea583`

Brauzer sinovi fayl hashini ham, haqiqiy fon URLini ham tekshiradi. Nazorat, Himoya va Hukm uchun turli muhitlar yaratildi. Biriktirilgan suratlar vizual namuna sifatida ishlatildi; yangi rasmlar asl fotosuratlarning nusxasi emas. To‘liq promptlar, fayl yo‘llari va hashlar: [game-assets-v9.md](game-assets-v9.md).

## Faza 1 — Doska va qog‘ozlar

Doskada detektiv silueti yoki foydalanuvchi yuklagan avatar, yozuv mashinkasi uslubidagi ism, unvon va rasm ko‘rinishidagi pagon bor. Gazeta, xarita va xat bo‘sh joylarni to‘ldiradi; ular navigatsiyani to‘smaydi. Pagonlar ushbu o‘yin uchun chizilgan SVG tasvirlaridir, rasmiy xizmat belgilarining me’yoriy nusxasi sifatida berilmagan.

Ish raqami suratdan o‘ngda, sarlavhadan tepada o‘z chizig‘iga joylashtirildi. Uzun sarlavhalar papkada qisqartiriladi, to‘liq nom ochilgan hujjatda qoladi. Desktopda olti, telefon ekranida ikki ish ko‘rinadi.

Barcha filtrlar `PaperSelect` orqali ishlaydi. Radix klaviatura boshqaruvi va fokusni qaytarishni ta’minlaydi; boshqariladigan Provider ishlatilgani uchun yashirin native `<select>` ham yaratilmaydi. Ro‘yxat sepia qog‘oz, ajratish esa sariq-jigarrang rangda. Esc birinchi navbatda ochiq ro‘yxat yoki papkani yopadi.

## Faza 2 — Uch qavatli metall seyf

`Profile.tsx` va unga tegishli `.scene-vault` uslublari:

- Framer Motion yordamida o‘ng ilgak atrofida ochiladigan metall eshik; qayta yopish va ochish boshqaruvi.
- Tepada xizmat darajasi, jami ball, keyingi unvongacha qolgan ball, ismni saqlash, avatar yuklash va hisobdan chiqish.
- O‘rtada yakunlangan ish papkalari va dekorativ shaxsiy pistolet.
- Pastda jarayondagi va ochilmagan ishlar, kichik qog‘oz varaqlash boshqaruvi.

Avatar yuklash va logout faqat shu yuqori qavatda. Har qanday papka `/investigation-room?case=UUID` ga yo‘naltirib, aynan shu ishni ochadi. Sahifani yangilash ham shu ishni qayta ko‘rsatadi. Seyfning metall tasviri CSSda uch bo‘lak sifatida joylashtiriladi: kichik ekranda javon chiziqlari mazmunga mos qoladi. Kamaytirilgan harakat rejimida eshik darhol ochiladi.

## Faza 3 — Haqiqiy rasm yuklash

`MediaService` rasmni tekshiradi va `.local/uploads/` ichiga saqlaydi. Ma’lumotlar bazasidagi mavjud `User.avatarKey` va `Case.coverAssetKey` ustunlari ishlatiladi; yangi migratsiya talab qilinmaydi. API `avatarUrl` va `coverImageUrl` ni kalitdan hosil qiladi.

- `POST /api/users/me/avatar`: multipart `image`.
- `POST /api/admin/cases`: multipart `data` JSON va majburiy `image`; faqat administrator.
- `GET /api/media/:kind/:owner/:file`: sessiya va bazadagi ruxsat etilgan yozuv tekshiriladi.

JPG, PNG va WebP; 4 MB gacha, kamida 64×64, ko‘pi bilan 20 million piksel. SVG, buzilgan, animatsiyali va mos kelmagan MIME fayllar rad etiladi. Sharp rasmni qayta kodlab metama’lumotlarni olib tashlaydi: avatar 512×512, ish rasmi uzun tomoni 1600 gacha. Foydalanuvchi fayl nomi saqlash yo‘liga qo‘shilmaydi; server UUID yaratadi. Avatar almashtirilganda oldingi fayl o‘chiriladi, DB amali muvaffaqiyatsiz bo‘lsa yangi fayl tozalanadi.

`.local/uploads/` ni PostgreSQL zaxirasi bilan birga saqlang. Ushbu mahalliy versiyada rasm fayllari bitta kompyuter diskida turadi.

## Faza 4 — Tekshiruv va qayta ko‘rib chiqish

Avtomatik brauzer oqimi alohida vaqtinchalik hisob va vaqtinchalik ish bilan ishlaydi, yakunda o‘z yozuvlari va rasmlarini tozalaydi. Mavjud hisoblar saqlanadi. Ekran tasvirlari `.cache/qa/game-ui-v9/` ichida.

Tekshiruv sahnalarning 1440×900, 375×812 va 320×568 o‘lchamlarini, sahifa scrolli yo‘qligini, native select yo‘qligini, qog‘oz filtr klaviaturasini, mixlarga ulangan iplarni, ish ochish/yakunlashni, ball va unvonni, avatarni yangilashdan keyin saqlanishini, seyfdan aniq ishga o‘tishni, majburiy admin rasmini va eshik animatsiyasini qamrab oladi. Raqam/surat/sarlavha hamda kichik seyf papkasidagi sarlavha/holat joylashuvi alohida tekshiriladi.

Qo‘lda ko‘rilgan dastlabki 320 px seyfda matn siqilishi aniqlandi va tuzatildi. Self-review: sahnalar 9/10, doska va qog‘ozlar 9/10, seyf 8/10, rasm yuklash 9/10. Bu dizayn bo‘yicha ichki baho, mustaqil audit emas. Eng kichik ekranda papka nomi bitta qatorga qisqartiriladi; to‘liq nom ish ichida ochiladi.

### Yakuniy natija — 2026-11-22

- Unit/runtime/asset: 69/69; PostgreSQL integratsiya: 15/15; HTTP: 14/14. Jami **98/98**.
- Alohida yangi headless Chromium kontekstidagi to‘liq brauzer oqimi: o‘tdi. In-app browser mavjud bo‘lmagani uchun mahalliy Playwright ishlatildi; foydalanuvchining brauzer profili o‘qilmadi.
- 1440×900, 375×812, 320×568; normal va kamaytirilgan animatsiya rejimlari. Brauzer konsolida xato yo‘q.
- Typecheck, ESLint, Prettier, web/API production build: o‘tdi. `pnpm audit --audit-level=low`: ma’lum zaiflik topilmadi.
- Asosiy `D:\tergovchi\run.bat --no-pause --no-browser` orqali tayyorlash, migratsiya/seed, yig‘ish va HTTP serverni ishga tushirish qayta tekshirildi.
- Maxsus ball maydoni bo‘sh qolganda `null` saqlanishi va yangi Oson ishda **+20 ball** ko‘rsatilishi tekshirildi.
- Tergov fonining yuqoridagi SHA-256 qiymati ish boshida va brauzer sinovi oxirida bir xil.

Natijalar mahalliy Windows muhitiga tegishli. Mustaqil yuk testi yoki ishlab chiqarishga joylashtirish bu fazaga kiritilmagan.
