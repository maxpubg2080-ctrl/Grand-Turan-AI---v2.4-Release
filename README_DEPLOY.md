# Grand Turan AI — Pasport & Excel Studio (Version 2.4 Release)

## 📦 Source ZIP (Yuklab olish)
- **ZIP fayli** loyihaning barcha manba kodini, PWA ikonlarini, va konfiguratsiyalarini o'z ichiga oladi.
- **Yuklab olish**: [http://0.0.0.0:3000/public/Grand_Turan_AI_Full_Project_Source.zip](http://0.0.0.0:3000/public/Grand_Turan_AI_Full_Project_Source.zip) (Preview-da `/api/project-zip` yoki `/public/Grand_Turan_AI_Full_Project_Source.zip` orqali).
- **Dasturchi**: Muhammad Amin

## 🚀 Render.com va GitHub O'rnatish (Auto-Updater)

### 1. GitHub-ga ko'chirish
- Branch: `arena/263fa9c5-grand-turan-ai-v2-4-release` (shuningdek `main` ga merge qiling).
- Repozitoriyani GitHub-ga ko'chiring.

### 2. Render.com-ga ulanish
1. Render.com-ga kiring va **New + -> Web Service** tanlang.
2. GitHub repositoriyasini tanlang.
3. **Branch**: `arena/263fa9c5-grand-turan-ai-v2-4-release` (yaqin orada `main` ga o'tish mumkin).
4. **Build Command**: `npm install && npm run build`
5. **Start Command**: `npx tsx server.ts` (yaqin orada `NODE_OPTIONS="--experimental-specifier-resolution=node"` qo'shilgan holda).
6. **Environment Variables (Muhim!)**:
   - `TELEGRAM_BOT_TOKEN`: `@grandturanai_bot` tokeni.
   - `RENDER_DEPLOY_HOOK_URL`: Render Deploy Hook URL (Auto-Updater uchun).
   - `GEMINI_API_KEY`: Gemini 3.8 Flash Vision API kaliti (opsional, offline MRZ ham ishlaydi).
   - `PORT`: 3000 (Render avtomatik tayinlaydi).

### 3. Auto-Updater (Deploy Hook)
- Render.com-da **Deploy Hook URL** olish uchun **Settings -> Deploy Hooks** ga kiring.
- Bu URL-ni Telegram bot `/redeploy` buyrug'i uchun yoki Admin panel (`PIN 1111/7777`) orqali kiriting.
- Endi `/redeploy` buyrug'i yoki GitHub push-i bilan server avtomatik yangilanadi.

## 📄 PDF Muammo (Yechish)
**Muammo**: Faqat Excel chiqayapti, PDF chiqmayapti.
**Sabab**: Loyihada hozircha `exceljs` (Excel uchun) mavjud, lekin `pdfmake` yoki `jspdf` kabi PDF generatorlari o'z ichiga olmagan.
**Yechim (Endi qo'shildi)**:
- Server (`server.ts`) `/api/excel/:template` orqali Excel chiqaradi.
- Agar PDF kerak bo'lsa, Excel faylni PDF-ga aylantirish uchun `exceljs` + `pdf-lib` yoki server tarafida `libreoffice` / `puppeteer` qo'shilishi kerak.
- **Hozirgi holat**: Excel (Prestige Row 2 va FlyKhiva Row 8) muvaffaqiyatli chiqayapti. PDF uchun endi `src/utils/excelGenerator.ts` da yangi funksiya qo'shiladi (Keyingi qadamda).

## 🛠️ Excel Layout (Tashab berilgan)
- **Prestige (Row 2)**: Familiya, Ism, Familiya(lat), Ism(lat), Tug'.sana, MR/MRS, Seriya, №, Berilgan, Muddati, Fuqarolik, Jins, Davlat. (C, F, M, P, Q, S, T, U o'chirildi).
- **FlyKhiva (Row 8)**: №, Familiya,ism, Tug'.sana, № pasporta, Klass(Y), Grazhd(UZB), Srok. (C, F, M, P, Q, S, T, U o'chirildi).

## 👨‍💻 Dasturchi
**Muhammad Amin** (Admin Panel, Bot, UI da ko'rinadi).

## ⚙️ Server Status
- **Port**: 3000 (Preview: `https://3000-ivzygtysq41so2bltql2k.e2b.app`)
- **WebSocket**: 24678
- **Telegram Bot**: `/start`, `/skip`, `/flykhiva`, `/prestige`, `/clear`, `/status`, `/redeploy` buyruqlari ishlaydi.
- **AI**: Gemini 3.8 Flash Vision + Offline MRZ.

## ⚠️ Qanday qilib PDF yaratish mumkin? (Keyingi qadam)
Agar PDF kerak bo'lsa, serverga `pdfmake` qo'shilib, Excel-ni PDF-ga aylantirish funksiyasi yoziladi. Endi faqat Excel chiqariladi (Talab qilingan Row 2 va Row 8 formatida).

---
**ZIP fayli hozir `/public/Grand_Turan_AI_Full_Project_Source.zip` joyida mavjud.**
**Preview**: [https://3000-ivzygtysq41so2bltql2k.e2b.app](https://3000-ivzygtysq41so2bltql2k.e2b.app) (200 OK)
