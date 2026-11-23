# Vizual resurslar

Joriy v7 o‘yin sahnalarining yangi fonlari va promptlari [game-assets.md](game-assets.md) da. Quyida avvalgi stock resurslar va asl fonlarni import qilish mexanizmi hujjatlashtirilgan.

## Hozirgi brauzer interfeysi

Brauzer ilovasi `apps/web/public/photos/` ichidagi mahalliy WebP tasvirlardan foydalanadi. `scripts/prepare-photos.mjs` manbalarni yuklab, o‘lchamini kamaytiradi va metadata’siz WebP yaratadi. Ushbu stock tasvirlar detektiv o‘quv ishlarini bezaydi; ular dalil yoki asl topshiriq rasmlari emas.

| Fayl         | Unsplash manbasi                                                                 |
| ------------ | -------------------------------------------------------------------------------- |
| hero.webp    | [Shahar](https://images.unsplash.com/photo-1519501025264-65ba15a82390)           |
| letter.webp  | [Maktub](https://images.unsplash.com/photo-1455390582262-044cdead277a)           |
| station.webp | [Poyezd](https://images.unsplash.com/photo-1474487548417-781cb71495f3)           |
| museum.webp  | [San’at](https://images.unsplash.com/photo-1561214115-f2f134cc4912)              |
| city.webp    | [Shahar manzarasi](https://images.unsplash.com/photo-1477959858617-67f85cf4f1df) |
| archive.webp | [Kutubxona](https://images.unsplash.com/photo-1507842217343-583bb7270b66)        |

## Asl fonlarni import qilish

Asl rasmlar biriktirilmagan. Ularning mavjudligi va ekranlardagi ko‘rinishi tekshirilgan deb belgilanmaydi. Hujjatdagi 7 ta rasm va 6 ta fon o‘rtasidagi tafovut ADR-004 da qayd etilgan.

| Manba fayli            | Marshrut              | Qatlam va harakat                                          |
| ---------------------- | --------------------- | ---------------------------------------------------------- |
| `bg-auth.jpg`          | `/login`, `/register` | Qorong‘i overlay, shisha forma; sahifa animatsiyasi FAZA 1 |
| `bg-board-main.jpg`    | `/board`              | Qorong‘i overlay; mixlar, SVG qizil ip va parallax FAZA 2  |
| `bg-investigation.jpg` | `/investigation-room` | Qorong‘i overlay; papkalar, chiroq va parallax FAZA 2      |
| `bg-control.jpg`       | `/control-room`       | Qorong‘i overlay; jadval va grafik FAZA 3                  |
| `bg-defense.jpg`       | `/defense-room`       | Qorong‘i overlay; yog‘och va kitob atmosferasi FAZA 3      |
| `bg-judgment.jpg`      | `/judgment-hall`      | Qorong‘i overlay; sud zali kompozitsiyasi FAZA 3           |

`.jpg` o‘rniga `.jpeg`, `.png` yoki `.webp` ham qabul qilinadi. Har bir nom uchun aynan bitta fayl bo‘lishi kerak. 7-rasmning alohida vazifasi berilmagan, shuning uchun uydirma manba yoki sun’iy takroriy fayl yaratilmaydi.

```powershell
pnpm --filter @detective/shared build
pnpm assets:import C:\path\to\original-images
pnpm assets:check
```

Import cheklovlari: statik rasm, kamida 640×360 px, 25 MB va 40 megapikseldan kichik. EXIF orientatsiyasi qo‘llanadi, metama’lumotlar chiqarilmaydi, tasvir kattalashtirilmaydi. 640/1280/1920 px kengliklarda WebP yaratiladi; bir xil o‘lcham qayta yozilmaydi. Har bir hosila 600 KB dan oshmasligi kerak.

Manifest `apps/web/public/assets/backgrounds/manifest.json` da, WebP fayllari yonida yoziladi. `assets:check` haqiqiy faylning format, kenglik, balandlik va bayt hajmini manifest bilan solishtiradi. Import qilingan resurslar `.gitignore` da; asl fayllar tasdiqlangach saqlash/CDN siyosati tanlanadi.

`SceneBackground` semantik jihatdan dekorativ `<picture>` va `srcset` ishlatadi. Ustuvor sahna rasmi eager, qolganlari lazy yuklanadi. Bu CSS `background-image` talabining texnik moslashtirilishi: rasm fon qatlamida qoladi, brauzer esa o‘lchamni o‘zi tanlaydi. Rasm yetishmasa yoki yuklanmasa, belgilangan qorong‘i gradient qoladi. Broken-image belgisi chiqmaydi.

Tokenlar `packages/ui/src/tokens.css` da. Qora overlay yuqorida 65%, pastda 85%; matn uchun alohida yuqori kontrastli panel bor. `prefers-reduced-motion` animatsiya va transitionlarni o‘chiradi. Haqiqiy fonlar qo‘shilgach kontrast va ekran ko‘rinishlari yana tekshiriladi. FAZA 2 dagi JavaScript parallax ham shu media-so‘rovni hurmat qilishi kerak.

## v9 qo‘shimchalari

Yangi metall seyf, dekorativ pistolet va uchta boshqa xona rasmi, ularning generatsiya promptlari va hash qiymatlari [game-assets-v9.md](game-assets-v9.md) da. Tergov xonasining `desk.webp` fayli saqlandi. `public/illustrations/detective-silhouette.svg` hamda `public/ranks/*.svg` o‘yin uchun kodda chizilgan tasvirlardir. Foydalanuvchi yuklagan avatar va ish surati public katalogga kiritilmaydi: ular `.local/uploads/` da saqlanib, sessiya tekshirilgan media endpoint orqali uzatiladi.
