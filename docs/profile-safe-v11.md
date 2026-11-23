# v11 — Metall seyf va shaxsiy jild

Profil sahifasi `Principal Game Architect Blueprint` asosida yangilandi. Boshqa xonalarning fonlari o‘zgartirilmadi. Foydalanuvchining aniqlashtirishiga muvofiq, **OCHILGAN ISHLAR javonida faqat yakunlangan (`CLOSED`) ishlar** ko‘rinadi. Pastda hali boshlanmagan ishlar bor. Jarayondagi ishlar ham `Hammasi` arxivida saqlanadi.

## Komponentlar va ishlaydigan amallar

- [SafeLayout.tsx](../apps/web/src/features/profile/SafeLayout.tsx) — API ma’lumotlari, sahna va modal holatlari. Route uchun `Profile.tsx` shu komponentni eksport qiladi.
- [SafeDoor.tsx](../apps/web/src/features/profile/SafeDoor.tsx) — o‘ngga ochiladigan eshik, dinamik PNG pagon, guvohnoma va metall tugmalar. Guvohnomaning rasmi, ismi, unvoni, balli yoki rivojlanish qismidan istalganini bosish to‘liq profilni ochadi.
- [SafeShelves.tsx](../apps/web/src/features/profile/SafeShelves.tsx), [SafeShelf.tsx](../apps/web/src/features/profile/SafeShelf.tsx) — uch javon, yakunlangan/boshlanmagan ishlar va har bir javondagi `Hammasi` tugmasi.
- [SafeCaseFolder.tsx](../apps/web/src/features/profile/SafeCaseFolder.tsx) — chap chetda ish surati, alohida raqam satri, nom va qizil muhr. Hoverda `y: -5`, `scale: 1.02`; papka aniq `/investigation-room?case=UUID` ga yo‘naltiradi.
- [FullProfileModal.tsx](../apps/web/src/features/profile/FullProfileModal.tsx) — ism, email, unvon, ball, qo‘shilgan sana, hisob turi, avatar va shaxsiy raqam. `Tahrirlash` orqali ism/rasm, parol bo‘limida esa amaldagi/yangi/takroriy parol kiritiladi.
- [AllCasesModal.tsx](../apps/web/src/features/profile/AllCasesModal.tsx) — faqat javonlardagi `Hammasi` orqali ochiladi; barcha ishlar, jumladan jarayondagilarni ham suratli, qiyshiq papkalar shaklida ko‘rsatadi. Ko‘p ish bo‘lsa hujjat varaqlanadi: desktopda olti, telefonda ikki papka.
- [PasswordForm.tsx](../apps/web/src/features/profile/PasswordForm.tsx) — umumiy uch maydonli parol formasi. Takroriy parol mos bo‘lmasa so‘rov yuborilmaydi. APIga faqat `oldPassword` va `newPassword` yuboriladi.

Eshikdagi `Saqlash` shaxsiy jildni tahrirlash rejimida ochadi. Jilddagi `Saqlash` ism va tanlangan avatarni saqlaydi. Parol bo‘limi ochiq bo‘lsa, shu tugma uchta parol maydonini tekshiradi, ism/rasm o‘zgarishlarini saqlab, keyin parolni almashtiradi. `Parolni saqlash` muhri ham shu oqimdan foydalanadi. Parol almashgach barcha sessiyalar yopiladi va yangi parol bilan kiriladi.

Ism, avatar va parol alohida mavjud API endpointlari orqali saqlanadi. Saqlashning keyingi qadami muvaffaqiyatsiz bo‘lsa, oldingi qadam saqlanganini xabar aniq ko‘rsatadi; masalan rasm saqlanib, ism yoki parol saqlanmagan holat yashirilmaydi. Profil va parol maydonlari yuklash paytida takror yuborishdan himoyalangan.

## Rasmlar va unvon mosligi

Yuborilgan to‘qqizta PNG **baytlarini o‘zgartirmasdan** `apps/web/public/ranks/` ichiga ko‘chirildi. Oq tashqi maydon rasmning o‘zida o‘chirilmagan: UI `clip-path` orqali pagon shaklini ajratadi. Bu kesish asl ranglar va detallarni saqlaydi. Dinamik yo‘l: `/ranks/${rankName.toLowerCase()}.png`.

| Loyiha unvoni     | Berilgan manba                                 | UI fayli                 |
| ----------------- | ---------------------------------------------- | ------------------------ |
| Leytenant         | `Code_Generated_Image (2).png`                 | `lieutenant.png`         |
| Katta leytenant   | `Code_Generated_Image.png`                     | `senior_lieutenant.png`  |
| Kapitan           | `Code_Generated_Image (3).png`                 | `captain.png`            |
| Mayor             | `Code_Generated_Image (4).png`                 | `major.png`              |
| Podpolkovnik      | `Code_Generated_Image (5).png`                 | `lieutenant_colonel.png` |
| Polkovnik         | `Code_Generated_Image (6).png`                 | `colonel.png`            |
| General-mayor     | `Code_Generated_Image (7).png`                 | `major_general.png`      |
| General-leytenant | `Code_Generated_Image (9).png`                 | `lieutenant_general.png` |
| General-polkovnik | `Code_Generated_Image (8).png`                 | `colonel_general.png`    |
| Marshal           | Mavjud loyiha SVG belgisi PNGga render qilindi | `marshal.png`            |

Marshal uchun yangi surat berilmagan; shu sabab uning mavjud o‘yin belgisi saqlandi. Rasmlar loyiha unvonlari ketma-ketligiga bog‘langan. Asl fayl nomlari va nazorat hashlari [rank-images.json](rank-images.json) da.

## Metall, patronlar va animatsiya

[SafeEquipment.tsx](../apps/web/src/features/profile/SafeEquipment.tsx) dagi M1911 uslubidagi pistolet va kishanga to‘rtta dekorativ patron qo‘shildi. Patronning uchi va gilzasi SVG `path`, guruch rangli gradient, ingichka yorug‘ chiziqlar va `feDropShadow` bilan tasvirlangan. Qurol va patronlar interaktiv otish mexanikasi bo‘lmagan dekorativ o‘yin obyektlaridir.

Seyf tashqi strukturasi absolyut joylashtiriladi; `preserve-3d`, 2100 px perspektiva va o‘ng ilgak (`transformOrigin: 100% 50%`) ishlatiladi. Desktopda eshik 132° ochiladi. Telefon ekranida profil/javonlar metall yorliqlari saqlangan. Modal hujjatlar Framer Motion `opacity: 0 → 1`, `scale: 0.9 → 1` bilan ochiladi; kamaytirilgan harakat rejimi hisobga olinadi.

Barcha yangi uslublar [profile.css](../apps/web/src/features/profile/profile.css) ichida: metall, qog‘oz, mix, surat va xira qizil muhr. Yangi yon menyu, navbar yoki native select qo‘shilmagan. Sahifa scroll qilmaydi; uzun shaxsiy hujjat ichidagi matn alohida scroll qilishi mumkin.

## API va ma’lumotlar

Mavjud autentifikatsiya, PostgreSQL, avatar yuklash va bcrypt parol almashtirish saqlandi. `GET /api/users/me/cases` javobiga faqat thumbnail uchun `slug` va `coverImageUrl` qo‘shildi. Yangi migratsiya yo‘q. Seed ishlar o‘z suratidan, administrator yuklagan ish esa saqlangan media URLidan foydalanadi. Ism, unvon va ball rasmga moslashtirish uchun sun’iy o‘zgartirilmaydi: masalan 90 ball bo‘lsa, 150 ballik chegaragacha 60 ball qolishi avtomatik hisoblanadi.

## Tekshiruvlar

2026-11-22, Windows, mahalliy API/PostgreSQL/Redis. In-app browser mavjud bo‘lmagani uchun alohida yangi headless Chromium kontekstida mavjud mahalliy Playwright sinovi ishlatildi. Foydalanuvchining brauzer profili o‘qilmadi.

- 69 ta unit/runtime/asset, 15 ta baza, 19 ta HTTP sinovi: **103/103**.
- Typecheck, lint, format va API/web production build tekshiruvlari.
- Brauzerda 1440×900, namunadagi 1024×572, 375×812 va 320×568 o‘lchamlar.
- Leytenantdan Katta leytenantga o‘tganda PNG manzili ham almashishi; barcha 10 PNG faylning yaroqliligi va asl to‘qqizta fayl bilan baytma-bayt tenglik.
- To‘liq profilni ochish, tahrirlash, ism va avatar saqlanishi, qayta yuklash, uch maydonli parol tasdig‘i, umumiy `Saqlash` orqali ism va parolni saqlash, yangi parol bilan kirish.
- Yakunlanganlar javonida bitta yakunlangan ish; jarayondagi beshta ish faqat umumiy arxivda. Ikki `Hammasi` tugmasi, mobil varaqlash va aniq ishni ochish.
- Admin yuklagan yangi ishning haqiqiy rasmi umumiy arxiv papkasida ham ko‘rinishi.

Tasvirlar: `.cache/qa/game-ui-v11/`, jumladan `initial-safe.png`, `full-profile.png`, `edit-profile.png`, `all-cases.png`, `mobile-all-cases.png`, `small-all-cases.png`, `uploaded-case-in-archive.png`, `full-profile-password.png`.

Tergov xonasi foni o‘zgarmagan. `apps/web/public/scenes/desk.webp` SHA-256:

`150c0049e019be1ab85044278548b48bc1cb7a89e4cbf421782051b044eea583`
