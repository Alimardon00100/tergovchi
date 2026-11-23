# Case opening v2 — 5 qadamli demo

Faqat sun’iy dev/staging ishlaridan foydalaning. Backup va additive migratsiya
tayyor bo‘lsin. Runtime’da `FF_CASE_OPENING_V2=true`, foiz 100; backend reload
qilingan bo‘lsin. Mahalliy demo hisoblar `.local/demo-users.json`da; parollarni
log yoki hujjatga ko‘chirmang. Seed qayta ishlatilganda mavjud ishning holati
reset qilinmaydi; kerak bo‘lsa admin orqali yangi sun’iy ish yarating.

1. Tergovchi bilan `/case-files`ga kiring. `Ko‘rish`da raqam, nom, JK modda,
   ochilgan sana, muddat va sharh borligini tekshiring. Hujjat, dalil va shaxs
   tafsiloti chiqmasin. `Ishni olish` yangi workspace va 24 soatlik lock bersin.
2. Ikkinchi tergovchi bilan shu ishni ko‘ring: olish tugmasi disabled va
   tushuntirishli bo‘lsin; to‘g‘ridan-to‘g‘ri claim API 409 qaytarsin.
   Birinchi tergovchi Hujjatlar tabida faqat mavjud turlarni saralab, PDF yoki
   rasmni ochsin. Dalilda `DALIL` badge bo‘lsin. Gumondor kartasida jins,
   manzil, surat, rol, aloqa va izoh ko‘rinsin; auditor PII maskasini tekshirsin.
3. Kvalifikatsiyada subyektni rol bilan belgilang, ishtirokchilik qatorini
   qo‘shib/takror shaxs warningini tekshiring, obyekt va ikki tomonni to‘ldiring.
   Qasd tanlansa qasd turi majburiy. Izoh o‘zgartirib 3 soniyada serverda
   saqlanishini tekshiring; darhol boshqa tabga o‘tish ham saqlashni bekor qilmasin.
   Offline izoh yozib, aloqani qayta ulang. Lock yo‘qolsa oxirgi saqlangan
   qiymat tiklansin va `Ishni qayta oling` chiqsin.
4. Admin etaloniga mos qolgan bo‘limlarni saqlab, faqat subyektni noto‘g‘ri
   tanlang: submit 50 ball bersin. Natija shundan keyin ko‘rinsin. Keyingi
   urinishda tuzatish bilan best va tarixni tekshiring; maksimum 3 urinish.
   Etalonsiz ishda submit disabled va `Etalon kiritilmagan` bo‘lsin.
5. Tergovchi offline paytda yuborilmagan izoh kiritsin. Runtime flagni
   o‘chirib backend konfiguratsiyasini reload qiling, aloqani ulang va sahifani
   qayta oching. Legacy workspace qoralamani saqlasin. `/board`, profil,
   statistika va eski tergov xonasini smoke tekshiring. V1 API ishlasin,
   v2 esa flag o‘chiq foydalanuvchi uchun 404 qaytarsin.

Avtomatik dalillar: `pnpm test:case-opening:browser`,
`pnpm test:case-opening:browser:legacy`, `pnpm test:case-opening:browser:rollback`.
QA rasmlari va avtomatik accessibility natijasi `.cache/case-opening-v2-qa/`da.
