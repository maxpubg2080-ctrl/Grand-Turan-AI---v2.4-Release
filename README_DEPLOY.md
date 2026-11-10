# ⚜️ Grand Turan AI — Serverga Joylash, GitHub va Auto-Updater Qo'llanmasi
**Dasturchi:** Muhammad Amin

Ushbu loyiha **Sayt (Web SPA + PWA)** hamda **Telegram Bot (@grandturanai_bot)** tizimini bitta kuchli Node.js / Express backendda birlashtirgan.

---

## 🚀 1-QADAM: Loyihani GitHub-ga Yuklash

Kompyuteringizda terminal (yoki VS Code) oching va yuklab olingan loyiha papkasiga kiring:

```bash
# 1. Git-ni ishga tushirish
git init

# 2. Barcha fayllarni qo'shish
git add .

# 3. Birinchi commit-ni yaratish
git commit -m "Grand Turan AI - v2.4 Pasport & Excel Studio"

# 4. Asosiy tarmoqni 'main' deb belgilash
git branch -M main

# 5. GitHub-da yangi (bo'sh) repository yarating (masalan: grand-turan-ai) va uning linkini ulang:
git remote add origin https://github.com/SIZNING_GITHUB_USERNAME/grand-turan-ai.git

# 6. Kodlarni GitHub-ga yuklash:
git push -u origin main
```

---

## 🌐 2-QADAM: Render.com da Bepul Serverga Joylash (Deploy)

Render.com — bu bepul va juda tez ishlaydigan bulutli server xizmati.

1. [https://render.com](https://render.com) saytiga kiring va **GitHub orqali ro'yxatdan o'ting**.
2. **"New +"** tugmasini bosing va **"Web Service"** ni tanlang.
3. Yangi ochilgan sahifada GitHub-dagi **`grand-turan-ai`** repositoriyangizni tanlang (**Connect**).
4. Quyidagi parametrlarni kiriting:
   - **Name:** `grand-turan-ai`
   - **Region:** `Frankfurt (EU)` (yoki Singapur)
   - **Branch:** `main`
   - **Root Directory:** *(bo'sh qoldiring)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

5. **"Environment Variables" (Atrof-muhit o'zgaruvchilari)** bo'limiga quyidagilarni kiriting:
   - `NODE_ENV` = `production`
   - `PORT` = `3000`
   - `GEMINI_API_KEY` = *Sizning Google AI Studio kalitingiz*
   - `TELEGRAM_BOT_TOKEN` = *BotFather bergan Telegram bot tokeni*
   - `RENDER_DEPLOY_HOOK_URL` = *(Quyidagi 3-qadamda olasiz)*

6. **"Create Web Service"** tugmasini bosing! 2-3 daqiqada saytingiz jonli ishga tushadi (masalan: `https://grand-turan-ai.onrender.com`).

---

## 🔄 3-QADAM: Auto-Updater (Deploy Hook) Sozlash

Serveringizni GitHub-ga yangi kod yuklaganda yoki bot orqali `/redeploy` buyrug'i berilganda avtomatik yangilash:

1. Render panelida loyihangizga kiring -> **Settings** bo'limini oching.
2. Pastroqqa tushib **"Deploy Hook"** bo'limini toping va **"Create Deploy Hook"** tugmasini bosing.
3. Hosil bo'lgan URL manzilini nusxalang (masalan: `https://api.render.com/deploy/srv-xxxxxx?key=yyyyyy`).
4. Bu URL manzilini:
   - Renderdagi **Environment Variables** bo'limiga `RENDER_DEPLOY_HOOK_URL` nomi bilan saqlang.
   - Saytning **Admin Paneliga (Kod: 1111 yoki 7777)** kirib, "Render Deploy Hook URL" katagiga qo'ying va saqlang.
5. Endi Telegram botingizda `/redeploy` yozsangiz yoki Admin paneldan "Qayta ishga tushirish" tugmasini bossangiz, server avtomatik qayta yig'ilib, oxirgi kod bilan ishlaydi!

---

## 🤖 4-QADAM: Telegram Bot Webhook-ni Ulash

Botingiz Render serveringizga kelgan xabarlarni tezkor qabul qilishi uchun Webhook o'rnatiladi:

1. `@BotFather` ga kirib, yangi bot oching yoki mavjud bot tokenini oling.
2. Saytning **Admin Paneliga (Kod: 1111 / 7777)** kiring va **"Bot Token"** katagiga tokeningizni kiriting va **"Webhook Ulash"** tugmasini bosing.
3. Yoki brauzerda quyidagi manzilni oching:
   ```
   https://api.telegram.org/bot<SIZNING_BOT_TOKENINGIZ>/setWebhook?url=https://SIZNING_RENDER_URLINGIZ.onrender.com/api/telegram/webhook
   ```
4. Ekranda `{"ok":true,"result":true,"description":"Webhook was set"}` yozuvi chiqsa, botingiz 100% ulandi!

---

## 🐳 5-QADAM: Docker yoki VPS (Ubuntu) orqali Ishga Tushirish (Ixtiyoriy)

Agar o'zingizning shaxsiy VPS serveringiz (Ubuntu) bo'lsa:

```bash
# Docker orqali:
docker build -t grand-turan-ai .
docker run -d -p 3000:3000 --name grand-turan -e GEMINI_API_KEY="kalit" -e TELEGRAM_BOT_TOKEN="token" grand-turan-ai

# Yoki to'g'ridan-to'g'ri PM2 orqali:
npm install
npm run build
npm install -g pm2
pm2 start server.ts --name grand-turan --interpreter tsx
pm2 save
pm2 startup
```

---
© 2026 Grand Turan AI. Dasturchi: Muhammad Amin.
