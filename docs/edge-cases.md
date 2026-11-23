# Chekka holatlar xaritasi

Quyidagi ro‘yxat topshiriqda sanalgan 22 holatni saqlaydi. Baza cheklovining mavjudligi HTTP endpoint yoki brauzer oqimi sinovdan o‘tganini anglatmaydi.

| Holat                        | Hozirgi qamrov                                             | Mahsulot oqimi                          |
| ---------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| Ishni qayta ochish           | Progress va CASE_OPEN ledger unikaligi integratsiya sinovi | FAZA 2 idempotent endpoint              |
| Bir necha unvonni sakrash    | Domen testi                                                | FAZA 2 rank-up interfeysi               |
| customPoints, shu jumladan 0 | Domen va baza sinovi                                       | FAZA 2/4                                |
| Rasm yuklanmasligi           | Rasmsiz render testi, onError gradient holati              | Asl rasmlar bilan brauzer sinovi ochiq  |
| Refresh token rotation       | Family/digest/rotation modeli                              | FAZA 1                                  |
| Parallel ish ochish          | Ikkilamchi ledger uchun DB cheklovi                        | FAZA 2 parallel HTTP testi              |
| Admin o‘zini o‘chirmasligi   | Hali tegishli servis yo‘q                                  | FAZA 4                                  |
| Manfiy ball                  | Domen va DB cheklovi                                       | FAZA 2/4                                |
| Bo‘sh xona                   | Hali tegishli ekran yo‘q                                   | FAZA 2/3                                |
| Mobil doska                  | Hali tegishli ekran yo‘q                                   | FAZA 2, 375 px tekshiruvi               |
| Reduced motion               | Umumiy CSS qoidasi                                         | Animatsiyalar bilan FAZA 1/2 tekshiruvi |
| DB ishlamasligi              | Start/verify nonzero chiqish yo‘li                         | HTTP xato javobi FAZA 1                 |
| Redis ishlamasligi           | Verify timeout va nonzero chiqish yo‘li                    | Auth/cache siyosati FAZA 1/2            |
| Katta rasm                   | Importdagi 25 MB / 40 MP / 600 KB chegaralar               | Asl fayllar bilan tekshiruv ochiq       |
| Email mavjudligi             | Normallashtirilgan DB unique integratsiya testi            | FAZA 1 javob kontrakti                  |
| Rate limit                   | Hali HTTP server yo‘q                                      | FAZA 1                                  |
| Noto‘g‘ri JWT                | Hali HTTP server yo‘q                                      | FAZA 1                                  |
| Rank config o‘zgarishi       | Domen va DB qayta hisoblash sinovi                         | FAZA 4 admin tranzaksiyasi              |
| Ikki brauzer tab             | Hali auth store yo‘q                                       | FAZA 1/2                                |
| Noto‘g‘ri slug               | Zod va PostgreSQL regex cheklovi                           | FAZA 2 route/404                        |
| Avatarni o‘chirish           | Nullable avatarKey modeli                                  | FAZA 1/4                                |
| CLOSED ishni qayta yopish    | Status/vaqt cheklovi                                       | FAZA 2 idempotent close                 |

Qo‘shimcha regressiyalar: PostgreSQL integerdan katta ball, takroriy unvon, noto‘g‘ri unvon tartibi, kiruvchi rank massivi tartibi, marshal progressi, mass assignment, ochiq javobdagi passwordHash, sahifalash chegarasi, millisekund aniqligi turlicha vaqtlar, seed orqali oddiy hisobni admin qilish va seedning parol/ish matnini qayta yozishi.
