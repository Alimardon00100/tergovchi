# ADR-003 — Takroriy va xavfsiz seed

Holat: qabul qilindi.

Seed barcha yozuvlarni bitta SERIALIZABLE tranzaksiya va advisory lock ichida yaratadi. Unvonning tabiiy kaliti — nomi, ishniki — slug, adminniki — normallashtirilgan email.

Qayta bajarish mavjud parol, ish matni, ball, progress yoki admin tahrirlagan unvon chegarasini o‘zgartirmaydi. Mavjud oddiy yoki bloklangan hisobni admin qilishga urinish rad etiladi. Parolni almashtirish seedning vazifasi emas.

Yangi admin paroli Argon2id bilan 19 MiB xotira, ikki iteratsiya va bitta oqimda hashlanadi. Ochiq parol, hash va ulanish manzili seed logiga yozilmaydi. Muvaffaqiyat logi faqat hisob identifikatori va yozuvlar sonini chiqaradi.

Olti demo ish badiiy misol bo‘lib, har bir EASY/MEDIUM/HARD darajasida ikkitadan ishni o‘z ichiga oladi. Asl rasm va to‘liq interaktiv dalillar bu seedga berilmagan; mavjud bo‘lmagan material yaratilgan deb ko‘rsatilmaydi.
