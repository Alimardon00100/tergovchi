# ADR-010 — Brauzer ilovasi va HTTP server

Holat: qabul qilindi, 2026-11-22. NestJS 11 / Fastify 5 ga o‘tish foydalanuvchi tomonidan tasdiqlandi; avvalgi NestJS 10 talabi shu qaror bilan yangilanadi. Yangilashdan keyingi pnpm audit natijasi: 0 topilma.

React 18, Vite, React Router, TanStack Query, Zustand, Radix Dialog/Popover, Framer Motion, Recharts va React Hook Form/Zod ishlatiladi. Query holati serverdan keladi; Zustand faqat UI afzalliklarini saqlaydi. JWT brauzer storage’iga yozilmaydi. Inter va Cinzel shriftlari hamda WebP rasmlar lokal xizmat qilinadi.

NestJS 11 / Fastify 5 bir portda API va statik React fayllarini beradi. API bo‘lmagan HTML navigatsiyasi SPAga qaytadi; noma’lum API va yo‘q fayllar 404 beradi. Javoblar success/data/requestId yoki success/error/requestId shaklida. Zod kiritmalarni tekshiradi; administrator roli har bir tegishli server amalida tekshiriladi.

Argon2id parol xeshi, 15 daqiqalik access JWT, 7 kunlik aylantiriladigan opaque refresh token qo‘llanadi. Cookie HttpOnly/SameSite=Strict; secure atributi HTTPS muhitida COOKIE_SECURE=true orqali yoqiladi. Refresh token bazada SHA-256 xesh ko‘rinishida saqlanadi. Qayta ishlatish aniqlansa token oilasi bekor qilinadi; logout eski access JWTni ham rad ettiradi. Foydalanuvchi roli/ban holati bazadan tekshiriladi. Origin tekshiruvi, CSP va per-process so‘rov cheklovi mavjud: odatda 120/min, auth marshrutlarida 20/min. Bu mahalliy bitta jarayon uchun; taqsimlangan limit va ishlab chiqarish infratuzilmasi bu ish doirasiga kirmaydi.

Ish ochish SERIALIZABLE tranzaksiya, foydalanuvchi satri qulfi, idempotency kaliti va noyob bazaviy cheklovlar bilan bajariladi. Prisma P2034 va raw query P2010 ichidagi 40001/40P01 holatlari uch martagacha qayta uriniladi. Ball, progress, unvon va audit bir tranzaksiyada o‘zgaradi. Qayta ochish ball bermaydi; takror yakunlash yangi audit yozmaydi. Dalil mazmuni ish boshlanmaguncha API javobida null bo‘ladi.

Boshlang‘ich ishlar tahrirlanmaydi; bo‘sh dalil papkalariga 3 tadan o‘quv matni qo‘shiladi. Maxsus asl fonlar berilmaganligi sabab mahalliy WebP stock tasvirlari ishlatiladi. Original rasmlarni import qilish mexanizmi saqlangan; ularning ko‘rinishi tekshirilgan deb hisoblanmaydi.
