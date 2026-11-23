# ADR-004 — Oltita fon va yettita marshrut

Holat: qabul qilindi; asl fayllar kutilmoqda.

Topshiriq 7 ta rasm deydi, ammo 6 ta fon nomini belgilaydi. Auth foni ikki marshrutda ishlatiladi. Mavjud dalilga ko‘ra olti sahna va yetti marshrut xaritasi yaratildi; noma’lum yettinchi rasmga vazifa o‘ylab topilmadi.

Asl rasmlar biriktirilmagan. Skript faqat berilgan manbalarni import qiladi, ularni almashtirish uchun internet rasmi yoki generatsiya avtomatik tanlanmaydi. Gradient komponentning rasm yuklanmaslik holatini boshqaradi, yakuniy vizual integratsiya deb hisoblanmaydi.

Responsive WebP uchun rasm dekorativ picture qatlamida ko‘rsatiladi. Bu CSS fon ko‘rinishini saqlaydi va srcset, sizes, eager/lazy yuklashni ta’minlaydi. Yetishmayotgan manbalar import va tekshiruv buyruqlarida aniq xatoga sabab bo‘ladi. Talablar [rasm hujjatida](../assets.md).
