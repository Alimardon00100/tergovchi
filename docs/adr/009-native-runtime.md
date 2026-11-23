# ADR-009 — Avtomatik mahalliy xizmatlar

Holat: yangilandi, 2026-11-22.

Faqat tayyor xizmatlarni tekshiradigan launcher yangi kompyuterda ishga tushmas edi. Windows x64 uchun LOCAL_SERVICES=managed rejimi qo‘shildi: PostgreSQL 16 va Redis 7 loyiha papkasidagi alohida ma’lumotlar bilan ishga tushadi. Tizimdagi mavjud serverlar va xizmat ro‘yxati o‘zgartirilmaydi.

PostgreSQL native pg_ctl bilan boshqariladi. Jarayon loglari pipe o‘rniga faylga uzatiladi: aks holda Windowsda tayyor server avlod jarayonining ochiq handle’i sabab launcher kutib qolishi mumkin. Redis yashirin, alohida jarayon sifatida boshlanadi. Stop amali Redis SHUTDOWN SAVE va pg_ctl fast stop orqali bajariladi.

Baza va test bazasi yaratiladi; serverning major versiyasi va data_directory qiymati tekshiriladi. .local/services.json port va kriptografik tasodifiy parollarni saqlaydi. .env atomik yangilanadi, avvalgi nusxasi .env.before-local-services da qoladi. Ma’lumotlar persistent; odatiy stop ularni o‘chirmaydi. Xizmat tayyorlash amallari PID/tokenli loyiha qulfi bilan navbatlanadi.

PostgreSQL manbasi: [embedded-postgres](https://github.com/leinelissen/embedded-postgres), 16.16.0-beta.19 platform paketi. Paketdan native bajariluvchi fayllar va PostgreSQL mijozi ishlatiladi; uning avtomatik process-stop mexanizmi serverga biriktirilmaydi.

Redis manbasi: [redis-windows](https://github.com/redis-windows/redis-windows), 7.2.16 Cygwin arxivi. Versiya, aniq hajm va SHA-256 kodda mahkamlangan; zip-slip yo‘llari rad etiladi. Bu mahalliy ishlab chiqish rejimi. Ishlab chiqarish, CI, Linux/macOS yoki mavjud server uchun LOCAL_SERVICES=external tanlanadi.

CI Ubuntu 24.04 da PostgreSQL 16 va Redisni tizim paketlari bilan ishlatadi. Managed rejimdagi host yangilanishlari foydalanuvchining boshqa bazalariga ta’sir qilmaydi.
