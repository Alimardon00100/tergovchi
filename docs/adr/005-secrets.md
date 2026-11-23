# ADR-005 — Lokal muhit va maxfiy qiymatlar

Holat: ADR-009 bilan yangilandi, 2026-11-22.

Tayyor admin paroli repozitoriyga kiritilmaydi. env:init tasodifiy admin paroli va muhit shablonini yaratadi. Mavjud .env exclusive-create bilan saqlanadi va Gitdan chiqarilgan.

Managed rejimda lokal hisob, PostgreSQL va Redis parollari runtime tomonidan yaratiladi. Ular .local/services.json va .env da saqlanadi; stdout va jarayon argumentlariga chiqarilmaydi. initdb paroli qisqa muddatli pwfile orqali uzatiladi va amal tugashi bilan fayl olib tashlanadi. Redis CLI autentifikatsiyasi muhit orqali beriladi.

External rejimda hisob va parollar operator tomonidan boshqariladi. Xizmat URLlari uning haqiqiy sozlamalariga moslanadi. Mahalliy server yaratish boshqa tizim xizmatining parolini o‘zgartirmaydi.

.env, .env.before-local-services va .local Gitga kiritilmaydi. Windowsda fayllar NTFS huquqlariga bo‘ysunadi; POSIX 0600 Windows uchun alohida kafolat emas. Ishlab chiqarishda secret omboridan foydalaniladi.
