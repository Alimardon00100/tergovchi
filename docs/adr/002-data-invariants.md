# ADR-002 — Ball, unvon va ish holati

Holat: qabul qilindi. Oldingi v3 Prisma sxemasi berilmagani uchun bu model qayta aniqlangan.

Sakkiz model: User, RankConfig, Case, CaseEvidence, UserCaseProgress, PointTransaction, RefreshToken, AuditLog. Ishning nashr holati va foydalanuvchining tergov holati alohida. Ochilmagan ish uchun progress yozuvi yo‘q.

PostgreSQL cheklovlari manfiy ballni, qiyinchilikka mos kelmagan asosiy ballni va vaqtga mos kelmagan yopilish holatini rad etadi. User triggeri emailni normallashtiradi va unvonni balldan hisoblaydi; foydalanuvchi tomonidan yuborilgan rank qiymatiga ishonilmaydi. RankConfig uchun kechiktirilgan constraint trigger tranzaksiya oxirida o‘nta tartibli unvon va nol boshlang‘ich chegarani talab qiladi. Chegara o‘zgarsa mavjud foydalanuvchilar qayta hisoblanadi.

`customPoints ?? basePoints` qo‘llanadi: nol ham haqiqiy override. Progressdagi `awardedPoints` va ledgerdagi amount ochilgan paytdagi ballni saqlaydi. Keyingi narx o‘zgarishi avvalgi ballni qayta yozmaydi.

`(userId, caseId)` progressda unikal. Ledgerda `(userId, idempotencyKey)` va `(userId, caseId, type)` unikal. Shuning uchun CASE_OPEN yozuvini boshqa kalit bilan takrorlash ham mumkin emas. Referensli ishlar o‘chirilmaydi, arxivlanadi.

FAZA 2 servisida progress, ledger, jami ball va audit bitta SERIALIZABLE tranzaksiyada yozilishi, serializatsiya to‘qnashuvi cheklangan qayta urinish bilan boshqarilishi kerak. Rank konfiguratsiyasini yozish `72413001` kalitida exclusive advisory lock oladi; ball amallari shu kalitning shared lock varianti va tegishli User qatoridagi lockdan foydalanadi. Shunda turli foydalanuvchilarning ball amallari bir-birini global navbatda kutmaydi. Bazadagi cheklovlar servis tranzaksiyasining o‘rnini bosmaydi; ochish endpointi ushbu fazada hali mavjud emas.
