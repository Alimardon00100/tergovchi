Feature: Jinoyat ishi
  Scenario: Preview dalillarni bermaydi
    Given tergovchi ishlar reyestrida
    When Ko‘rish tugmasini bosadi
    Then faqat umumiy ma’lumot ko‘rinadi
    And hujjatlar va shaxsiy dalillar ko‘rinmaydi

  Scenario: Bir vaqtda olish
    Given ish hali biriktirilmagan
    When ikki tergovchi bir vaqtda ishni oladi
    Then bittasi 201 oladi
    And ikkinchisi 409 oladi

  Scenario: Subyekt xato, qolganlar to‘g‘ri
    Given shaxs-rol juftligi etalonga mos emas
    And qolgan to‘rtta bo‘lim to‘g‘ri
    When Tekshirish bosiladi
    Then jami 50 ball saqlanadi

  Scenario: Etalonsiz ish
    Given ish etaloni kiritilmagan
    When tergovchi tekshirishga urinadi
    Then API 422 qaytaradi
    And urinishlar soni o‘zgarmaydi

  Scenario: Oflayn qoralama
    Given tergovchi qoralamani tahrirlamoqda
    When aloqa uziladi va izoh yoziladi
    Then qoralama shu qurilmada saqlanadi
    When ulanish tiklanadi
    Then qoralama serverga yuboriladi
    And versiya to‘qnashuvi bo‘lsa ogohlantirish chiqadi

  Scenario: Rahbar tasdig‘i
    Given ish baholangan
    When bo‘linma rahbari yopishni tasdiqlaydi
    Then ish CLOSED bo‘ladi
    And qayta tahrirlash taqiqlanadi
