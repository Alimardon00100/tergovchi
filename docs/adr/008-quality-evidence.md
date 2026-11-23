# ADR-008 — Sifatni tekshiruv dalillari bilan baholash

Holat: qabul qilindi.

Rubrikadagi yuqori ball o‘z-o‘zidan dalil emas. Hisobotda bajarilgan buyruq, haqiqiy natija va tekshirilmagan bandlar alohida ko‘rsatiladi. Yo‘q rasmlar, qurilmagan ekranlar, o‘lchanmagan LCP/API p95 yoki bajarilmagan deploy yashil deb belgilanmaydi.

FAZA 0 uchun avtomatik darvozalar: strict typecheck, lint, domen/komponent testlari, PostgreSQL integratsiyasi, modul buildi, Prisma validate, format va dependency audit. CI ayni tekshiruvlarni takrorlaydi. Test coverage foizi o‘lchanmasdan 80% deb e’lon qilinmaydi.

Barcha 12 mezon faza hisobotida baholanadi. Hozirgi fazaga tegishli bo‘lmagan mezonlar N/A, yetishmayotgan tashqi materialga bog‘liq mezonlar esa ochiq sifatida qayd etiladi. To‘liq mahsulot uchun 120 ballik yakuniy baho bu fazada chiqarilmaydi.
