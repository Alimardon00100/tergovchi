# Brauzer ilovasi tekshiruvi

Joriy profil tekshiruvi: [v11 metall seyf va modallar](profile-safe-v11.md). Avvalgi v9 tekshiruvi: [seyf, rasmlar va yakuniy natijalar](game-ui-v9.md). Quyidagisi avvalgi interfeys hisoboti. Yangi v7 o‘yin sahnalari va joriy dalillar [game-ui-v7.md](game-ui-v7.md) da.

2026-11-22, Windows x64, Node.js 26.7, PostgreSQL 16.16, Redis 7.2.16. Ilova BAT orqali haqiqiy bazada ishga tushirildi. Brauzer pluginida mavjud brauzer aniqlanmagach, alohida yangi headless Chromium kontekstida mahalliy Playwright sinovi qo‘llandi. Foydalanuvchining brauzer profili ishlatilmadi.

Desktop 1440×1000 va mobil 375×812 ekranlar ko‘rib chiqildi. Avtomatik oqim: registratsiya → doska → qiyinchilik/qidiruv filtrlari → ish boshlash → 3 dalil → reload orqali saqlanish → yakunlash → Hukm zali → qolgan ishlar → 200 ball va Katta leytenant → statistika → profilni saqlash → mobil menyu → chiqish/qayta kirish. Brauzer xatosi qayd etilmadi; mobil sahifada gorizontal overflow yo‘q. Sinov hisobi va unga tegishli yozuvlar yakunda o‘chirildi.

HTTP sinovlari ajratilgan test sxemasida ishlaydi: cookie atributlari, validatsiya, origin va rol cheklovi, profil, workspace, parallel ochishdagi bitta ball tranzaksiyasi, idempotent yakunlash, refresh rotation/replay, logout va admin yaratish. Bazaga tegishli poydevor invariantlari alohida test:db bilan tekshiriladi.

Yakuniy avtomatik natija: 66 ta unit/runtime/asset sinovi, 15 ta PostgreSQL integratsiya sinovi va 9 ta HTTP sinovi — jami 90 ta o‘tdi. Brauzer oqimiga administratorning yangi ish yaratishi ham kiritildi; sinov ishi yakunda olib tashlandi. Typecheck, ESLint, Prettier va production build o‘tdi. Paketlar auditida 0 topilma.

Ko‘rinishlar `.cache/qa/` da: login.png, desktop.png, case.png, statistics.png, mobile.png, admin.png. Ular sinov ma’lumotlaridan yaratilgan. Asl talabdagi rasmlar, 5000 foydalanuvchi yuk testi, Lighthouse ko‘rsatkichlari, S3/CDN va ishlab chiqarishga deploy bu tekshiruvda tasdiqlanmagan.
