// Fictional training material. Add only to seed cases with no existing evidence.
export const SEED_EVIDENCE: Readonly<
  Record<string, readonly { title: string; content: string }[]>
> = {
  'songgi-maktub': [
    {
      title: 'Tugallanmagan maktub',
      content:
        'Stoldagi maktubda: “Soat to‘qqizda eski ustaxonada uchrashamiz”, deb yozilgan. Qog‘oz chetida ko‘k siyoh izi bor, ammo imzo qo‘yilmagan.',
    },
    {
      title: 'Pochta qaydi',
      content:
        'Konvert kecha soat 18:40 da topshirilgan. Qabul qiluvchi uni ertalab olganini aytmoqda. Ushbu ikki vaqt orasidagi voqealarni tiklang.',
    },
    {
      title: 'Qo‘shnining ko‘rsatmasi',
      content:
        'Qo‘shni soat 20:55 da ko‘k kurtkali odamni ustaxona yonida ko‘rgan. U odamning yuzini aniq ko‘rmagan. Taxminni tasdiqlangan dalildan ajrating.',
    },
  ],
  'bekatdagi-jomadon': [
    {
      title: 'Saqlash katagi cheki',
      content:
        'Jomadon ichidan 17-raqamli saqlash katagi cheki topildi. Chekdagi vaqt 14:10. To‘lov naqd pulda qilingan.',
    },
    {
      title: 'Navbatchining qaydi',
      content:
        'Navbatchi 14:25 da jomadon egasi platforma tomonga ketganini yozgan. Shu vaqtda shimoliy chiqish ta’mir sabab yopiq edi.',
    },
    {
      title: 'Yo‘l chiptasi',
      content:
        'Ichki cho‘ntakdagi chipta 15:00 dagi poyezdga tegishli. Chipta tekshirilmagan. Egasi bekatdan qanday chiqqan bo‘lishi mumkinligini dalillar bilan baholang.',
    },
  ],
  'muzeydagi-soya': [
    {
      title: 'Signalizatsiya jurnali',
      content:
        'Sharqiy zal sensori 22:14 da o‘chgan, 22:21 da qayta yoqilgan. Boshqa zallarda uzilish qayd etilmagan.',
    },
    {
      title: 'Kalitlar daftari',
      content:
        'Zal kaliti restavratorga 21:50 da berilgan va 22:30 da qaytarilgan. Daftardagi qaytarish imzosi boshqa siyoh bilan yozilgan.',
    },
    {
      title: 'Vitrinadagi iz',
      content:
        'Vitrinaning ichki chetida oq mato tolasi topilgan. Muzey xodimlari oq qo‘lqop ishlatadi; bu belgi yolg‘iz o‘zi biror shaxsni aybdor deb belgilamaydi.',
    },
  ],
  'yarim-tundagi-qongiroq': [
    {
      title: 'Qo‘ng‘iroq vaqti',
      content:
        'Aloqa jurnali 00:03 da 41 soniyalik qo‘ng‘iroqni qayd etgan. Qabul qiluvchi suhbat ikki daqiqa davom etganini eslaydi.',
    },
    {
      title: 'Fon tovushi',
      content:
        'Yozuvda uch marta qisqa signal eshitiladi. Yaqindagi yuk terminalida aynan shunday signal tunda ishlatiladi. Bu faqat tekshirilishi kerak bo‘lgan yo‘nalish.',
    },
    {
      title: 'Kirish nazorati',
      content:
        'Terminalga tegishli xizmat kartasi 23:58 da ishlatilgan. Chiqish qaydi 00:17. Kartani kim olib yurganini alohida tasdiqlash kerak.',
    },
  ],
  'yopiq-xona-siri': [
    {
      title: 'Eshik holati',
      content:
        'Xona ichkaridan qulflangan. Qulfda buzish izi yo‘q. Deraza dastasi ochiq holatda, rom esa ichkaridan yopishtirilgan.',
    },
    {
      title: 'Elektr hisoblagich',
      content:
        'Soat 19:42 da qisqa elektr uzilishi bo‘lgan. Stol soati 19:42 da to‘xtagan, ammo devordagi batareyali soat ishlashda davom etgan.',
    },
    {
      title: 'Xizmat yo‘lagi rejasi',
      content:
        'Eski rejada xona yonidan tor xizmat yo‘lagi o‘tishi ko‘rsatilgan. So‘nggi ta’mir hujjatida uning yopilgani qayd etilmagan. Joyni ko‘zdan kechirish zarur.',
    },
  ],
  'qizil-ip': [
    {
      title: 'Uchta manzil',
      content:
        'Uch hodisaning manzillari bir xil yetkazib berish yo‘nalishiga tushadi. Voqealar turli kunlarda, lekin har safar soat 16:00 dan keyin sodir bo‘lgan.',
    },
    {
      title: 'Ombor ro‘yxati',
      content:
        'Har uch manzil uchun buyurtmada bir xil partiya raqami uchraydi: QI-27. Partiyaga kirgan boshqa jo‘natmalarni ham tekshirish kerak.',
    },
    {
      title: 'Yo‘nalishdagi o‘zgarish',
      content:
        'Kurerning yo‘l varaqasiga har uch kuni qo‘lda qo‘shimcha bekat kiritilgan. Yozuv muallifi noma’lum. Hujjatning asl nusxasi va tahrir vaqtini solishtiring.',
    },
  ],
};
