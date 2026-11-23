# Jinoyat ishi — ishga tushirish va demo

Asosiy papkadagi yoki `detective-board` ichidagi `run.bat`ni oching. Qo‘shimcha servis o‘rnatish talab qilinmaydi. Launcher yangi migratsiya, 3 ta sun’iy ish va 6 ta demo hisobni tayyorlaydi. Eski foydalanuvchilar va o‘yin saqlanadi.

Manzil: **http://127.0.0.1:3000/case-files**. Port band bo‘lsa launcher chiqargan manzildan foydalaning. Doskadagi **Jinoyat ishlari reyestri** qog‘ozini bosish ham shu sahifani ochadi. Tergov xonasi fon fayli o‘zgartirilmagan.

Demo hisoblar: `.local/demo-users.json`. Faylda tergovchi, ikkinchi tergovchi, rahbar, prokuror, administrator va auditorning avtomatik yaratilgan parollari bor. Parollar log va hujjatga yozilmaydi; bu fayl Gitga kirmaydi. Seed mavjud hisobning paroli yoki o‘zgartirilgan ish holatini qayta yozmaydi. Amaldagi haqiqiy admin hisobingiz ham ishlaydi.

## Demo oqimi

1. Demo tergovchi bilan kiring, reyestrdagi `1-2026-001` ishini **Ko‘rish** orqali oching. Preview faqat sharh va dastlabki umumiy ma’lumotni ko‘rsatadi.
2. **Ishni olish** tugmasini bosing. Umumiy, Hujjatlar, Ishtirokchilar, Kvalifikatsiya va Natija varaqlari ochiladi. Birinchi PDFni ochish ishni tergov holatiga o‘tkazadi.
3. Birinchi ish uchun: subyekt Jamshid O‘quvchi / Ijrochi; ishtirokchilik bo‘sh; obyekt Mulk; harakat Harakat; oqibat Moddiy zarar; sababiy bog‘lanish Mavjud; aybdorlik Qasddan / To‘g‘ri qasd; motiv G‘araz; maqsad Boyish. Bular faqat sun’iy demo etalonidir.
4. Autosave holatini kuzating. Aloqani uzib izoh yozing, qayta ulang — qoralama yuboriladi. Barcha bo‘limlar to‘liq va etalon tayyor bo‘lganda **Tekshirish** yoqiladi. To‘liq mos javob 100 ball.
5. Subyekt rolini Yordamchiga o‘zgartirib, qolganini saqlasangiz 50 ball chiqadi. Yana tekshirish yangi urinish hisoblanadi. Ko‘pi bilan uchta; eng yaxshi natija saqlanadi.
6. Rahbar hisobida ishni ochib **Yopishni tasdiqlash**ni bosing. Ish CLOSED bo‘ladi. Rahbar, shuningdek, sabab kiritib ishni qayta biriktiradi yoki to‘xtatadi/tiklaydi.
7. Auditor hisobida ishtirokchilar PINFL/manzili yashirilganini va kvalifikatsiya yozish varag‘i yo‘qligini tekshiring. Natijadan PDF/DOCX oling, audit jurnalini oching.
8. Administrator hisobida **Boshqaruv**dan etalonni, foydalanuvchi rolini ko‘ring yoki yangi ish yarating. Yangi ishga avval ishtirokchi va hujjat qo‘shing, so‘ng besh bo‘limning etalonini saqlang. Vaznlar hozir qat’iy.
9. `1-2026-002` ikki epizodli ish: birinchi vazn 1, ikkinchi 3. Har epizod alohida to‘ldiriladi. Ikkinchi epizod subyekti Aziz Namuna / Ijrochi. `1-2026-003` etalonsiz ish — submit bloklanishini ko‘rsatadi.
10. Til tugmasidan O‘zbekcha / Ўзбекча / Русскийni va qog‘ozning yorug‘/to‘q ko‘rinishini tanlang. Fon saqlanadi.

## Komandalar

Repo ildizida launcher tayyorlagan `pnpm` PATHda bo‘lishi kerak. PowerShell uchun:

```powershell
$env:PATH="$PWD\.tools\node_modules\.bin;$env:PATH"
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:db
pnpm test:http
pnpm test:case-module
pnpm test:case-module:coverage
$env:PLAYWRIGHT_BROWSERS_PATH="$PWD\.cache\playwright"
pnpm test:case-module:browser
pnpm test:case-module:exports
pnpm openapi:case-module
pnpm backup:case-module
```

Brauzer sinovidan oldin `.\run.bat --no-pause --no-browser` bilan serverni oching. Birinchi Playwright tayyorlash: `pnpm exec playwright install chromium`. Eski o‘yin regressiyasi: `pnpm test:browser`. Brauzer testlari o‘zining `qa-*` foydalanuvchilari/ishlarini yaratib, faqat shu IDlarni tozalaydi. DB integratsiya sinovlari `_test` bazasidagi tasodifiy `phase0_*` sxemalarda bajariladi; asosiy bazada ishlamaydi.

## Kontrakt va tekshiruv dalillari

- [Arxitektura, C4, ERD va ruxsatlar](architecture.md)
- [OpenAPI 3.1](openapi.json), generator: `scripts/generate-case-openapi.mjs`
- Scoring testlari: `apps/api/tests/case-scoring.test.ts`; coverage faqat sof scoring yadrosini o‘lchaydi.
- API integratsiyasi: `apps/api/tests/case-module.integration.test.ts`.
- Brauzer E2E: `tests/case-module.browser.mjs`.
- Sinov natijasi va skrinshotlar: `.cache/case-module-qa/`; asosiy fayllar `browser-result.json`, `accessibility.json`, `performance.json`, `auditor-report.pdf`, `auditor-report.docx`.
- DOCX uslubi: `standard_business_brief` (Calibri11, sarlavha16, Letter, 1 inch chetlar); jadval va ro‘yxat yo‘q. PDFda Noto Sans shriftlari fayl ichiga joylanadi. Ikkala eksportda ham maxfiy etalonlar chiqarilmaydi.

API muvaffaqiyat javobi `{success:true,data,requestId}`, xato `{success:false,error:{code,message},requestId}`. Hujjat fayli va eksport binary qaytadi. Bearer olish uchun `/api/v1/auth/login`; refresh cookie bilan `/api/v1/auth/refresh`; sessiyani bekor qilish `/api/v1/auth/logout`. Tafsilotlar OpenAPI’da.

`DATABASE_URL`, `TEST_DATABASE_URL`, mavjud seed admin sozlamalari oldingi `.env`dan olinadi. Yangi majburiy env yo‘q. HTTPS o‘rnatilganda `COOKIE_SECURE=true` belgilang. PII/JWT kalitini tasodifan almashtirmang. Nusxalar `.local/backups/*.case-backup`; avtomatik nusxa server ishlaganda bajariladi, 30 kun saqlanadi. Nusxa formati va ishlab chiqarishdagi cheklovlar arxitektura hujjatida ko‘rsatilgan.

Yakuniy sinov natijalari: [verification.md](verification.md).
