# ADR-011 — Interaktiv detektiv sahnalari

Holat: qabul qilindi, 2026-11-22. Foydalanuvchining v7 topshirig‘i ADR-010 dagi vizual dashboard yo‘nalishini almashtiradi. Server, sessiya va ball mexanizmlari saqlanadi; mahsulot UI butun ekranli point-and-click sahnalariga o‘tadi.

Sidebar/navbar o‘rniga kork doskadagi qadalgan polaroidlar ishlatiladi. Xona va asosiy doskada sahifa scroll qilmaydi; kichik ekranda papkalar varaqlanadi. Matnli dalil va uzun shakllar faqat o‘z qog‘ozi ichida aylanishi mumkin. Sahna qog‘ozlari mutlaq foizli koordinatalar va burchaklar bilan joylashtiriladi. Sahna almashishi Framer Motion layoutId bilan bog‘lanadi; reduced-motion ham hurmat qilinadi.

Rasmlar CSS background-image orqali sahna qatlami sifatida qo‘llanadi. Asl rasmlar berilmagani uchun beshta yangi fon imagegen’da yaratildi. Inter/Cinzel va Recharts chiqarildi; Special Elite/Playfair Display va qog‘ozdagi SVG grafik qo‘shildi. Qizil ip uchlari haqiqiy mix markazlarini kuzatadi.

[Fazalar va cheklovlar](../game-ui-v7.md), [rasm promptlari va metadata](../game-assets.md).
