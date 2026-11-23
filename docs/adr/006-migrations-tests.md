# ADR-006 — Migratsiyalar va haqiqiy baza sinovlari

Holat: qabul qilindi.

`db push` o‘rniga versiyalangan `migrate deploy` ishlatiladi. Sabab: Prisma sxemasi CHECK cheklovlari va triggerlarni to‘liq ifodalamaydi. Boshlang‘ich DDL Prisma 5 dan olinadi, ikkinchi migratsiya SQL invariantlarni qo‘shadi. Mavjud migratsiya o‘zgartirilmaydi; yangi o‘zgarish alohida migratsiya bo‘ladi.

Umumiy domen testlari bazasiz ishlaydi. Integratsiya testlari haqiqiy PostgreSQL 16 da bajariladi, mock DB yoki SQLite natijasi PostgreSQL natijasi deb ko‘rsatilmaydi. Test bazasi nomi `_test` bilan tugashi shart. Har ishga tushirish tasodifiy `phase0_` sxemasini yaratadi, migratsiya qiladi, sinaydi va faqat shu sxemani olib tashlaydi.

Seed qayta bajarilishi, Argon2id verifikatsiyasi, email unikaligi, rank mosligi, nol override, takroriy progress/ledger va deferred rank cheklovlari shu qatlamda tekshiriladi. FAZA 1/2 endpoint testlari faqat tegishli HTTP servislar yaratilgach qo‘shiladi.

Migratsiya tarixining tamoyili: [Prisma Migrate hujjati](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/baselining). Amaldagi CLI buyruqlari repozitoriydagi qulflangan Prisma 5.22.0 bilan tekshiriladi.
