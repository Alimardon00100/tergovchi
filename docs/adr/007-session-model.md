# ADR-007 — Refresh sessiya modeli

Holat: ma’lumotlar modeli uchun qabul qilindi; auth servisi FAZA 1.

RefreshToken jadvalida tokenning o‘zi emas, 64 belgili digest saqlanadi. Family identifikatori, amal muddati, bekor qilish va almashtirilgan token havolasi rotation va qayta ishlatishni aniqlash uchun yetarli model beradi. Almashtirilgan token revocation vaqtiga ega bo‘lishi shart.

Userning ochiq Zod sxemasida passwordHash, tokenHash va sessiya maydonlari yo‘q. Ro‘yxatdan o‘tish sxemasi strict va rolni qabul qilmaydi. Modelning mavjudligi login, JWT imzosi, CSRF yoki rotation algoritmi ishlayotganini anglatmaydi: ular FAZA 1 da integration test bilan topshiriladi.

Topshiriqdagi 15 daqiqalik access va 7 kunlik refresh muddatlari o‘sha servisning konfiguratsiyasiga kiritiladi. Role va rank autentifikatsiyalangan server ma’lumotidan olinadi.
