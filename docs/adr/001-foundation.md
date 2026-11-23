# ADR-001 — Monorepo va faza chegarasi

Holat: qabul qilindi.

Talab bo‘yicha ish FAZA 0 dan boshlanadi, fazalar alohida topshiriladi. pnpm workspace va Turborepo `apps/api`, `apps/web`, `packages/shared`, `packages/ui`, `packages/config` ni boshqaradi. Mavjud tashqi Python namunasi o‘zgartirilmaydi.

Frontend React 18, backend ma’lumotlar qatlami Prisma 5, infratuzilma PostgreSQL 16 va Redis 7. HTTP server, Vite SPA, NestJS 10/Fastify va auth interfeysi FAZA 1 mahsulot doirasiga kiradi. FAZA 0 paketlarida ishlamaydigan `dev` buyruqlari va soxta endpointlar yo‘q.

Mahalliy ishga tushirish va CI uchun Node.js 22.13+ tanlangan; 24.x va 26.x ham qo‘llanadi. Qulflangan lockfile aynan bir xil bog‘liqliklar bilan o‘rnatishni ta’minlaydi. Zod versiyasi topshiriqda chegaralanmagan; auditdan so‘ng 4.6.6 tanlandi. Lint/test/rasm vositalari ham audit tavsiyalariga ko‘ra yangilandi. Xizmatlarga bevosita ulanish ADR-009 da belgilangan.

Natija: hozirgi modul buildi tayyor; u to‘liq mahsulot buildi deb taqdim etilmaydi. Saytni joylashtirish FAZA 5 da bajariladi.
