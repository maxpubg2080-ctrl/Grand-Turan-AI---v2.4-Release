import express, { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

// In AI Studio preview / Cloud Run environment, HMR WebSocket is disabled
process.env.DISABLE_HMR = 'true';

import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import JSZip from 'jszip';
import {
  parseMrzLines,
  stripPatronymic,
  ensureDotDate,
} from './src/utils/mrzParser.ts';
import { generatePrestigeWorkbook, generateFlyKhivaWorkbook, workbookToBuffer } from './src/utils/excelGenerator.ts';
import { PassportRecord, FlightDetails } from './src/types/passport.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const port = process.env.NODE_ENV === 'production' && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const startTime = Date.now();

// In-memory passport store and telemetry
const scannedPassports: PassportRecord[] = [];
let batchCount = 0;
let prestigeExports = 0;
let flykhivaExports = 0;
let botToken = process.env.TELEGRAM_BOT_TOKEN || '';
let deployHookUrl = process.env.RENDER_DEPLOY_HOOK_URL || '';

function getEffectiveGeminiKey(): string {
  const envKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!envKey || envKey === 'MY_GEMINI_API_KEY' || envKey.length < 10) {
    return '';
  }
  return envKey;
}

class AppApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Telegram session state for web simulator and webhook users
interface TelegramUserSession {
  template: 'prestige' | 'flykhiva';
  useApi: boolean;
  passports: PassportRecord[];
}
const telegramSessions = new Map<string | number, TelegramUserSession>();

function getSession(userId: string | number): TelegramUserSession {
  if (!telegramSessions.has(userId)) {
    telegramSessions.set(userId, {
      template: 'prestige',
      useApi: true,
      passports: [],
    });
  }
  return telegramSessions.get(userId)!;
}

// ---------------------------------------------------------------------------
// REAL PASSPORT PARSER (Gemini AI Vision — NEVER fabricates fake data)
// ---------------------------------------------------------------------------
async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const status = err?.status || err?.code;
      const isTransient =
        status === 429 ||
        status === 500 ||
        status === 503 ||
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('RESOURCE_EXHAUSTED');

      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

function cleanJsonResponse(text: string): string {
  const trimmed = (text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

async function parsePassportImage(
  cleanBase64: string,
  mimeType: string,
  useThinking: boolean = false
): Promise<{ record: PassportRecord; engine: string }> {
  const effectiveKey = getEffectiveGeminiKey();
  if (!effectiveKey) {
    throw new AppApiError(
      "GEMINI_API_KEY serverda sozlanmagan. Iltimos, AI Studio Secrets yoki Render Environment Variables bo'limida GEMINI_API_KEY ni kiriting (yoki Offline MRZ matn kiritishdan foydalaning).",
      400
    );
  }

  const client = new GoogleGenAI({
    apiKey: effectiveKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const modelName = 'gemini-4-hydrogen';
  const systemPrompt = `You are a strict, 100% truthful passport data extraction OCR engine.
CRITICAL RULES:
1. Read ONLY the actual text and 2-line MRZ printed on the provided passport image. NEVER guess, invent, or substitute placeholder names or numbers.
2. If the image is NOT a passport or is completely illegible so surname or passport number cannot be read, set errorReason to a brief explanation and leave surname/number empty.
3. NEVER include patronymic / middle name / father's name (otasining ismi, e.g., O'G'LI, QIZI, OGLI, KIZI, -VICH, -OVNA) in givenNames or givenNamesLat. Output strictly the Surname and First Given Name only.
4. Read the 2-line MRZ at the bottom verbatim into rawMrz if visible, and use it to verify spelling, passport series/number, birthDate, gender, and expiryDate.
5. Format dates precisely:
   - birthDate: Uzbek format "YYYY-yil D-oy" (lowercase months: yanvar, fevral, mart, aprel, may, iyun, iyul, avgust, sentabr, oktabr, noyabr, dekabr, e.g. "1992-yil 5-may").
   - issueDate: "DD.MM.YYYY" (leave "" if not printed on document).
   - expiryDate: "DD.MM.YYYY".
6. Extract series (2-3 uppercase letters, e.g. FA, AA, AB) and number (digits, e.g. 5142207) separately.
7. title must be "MR" for male (M), "MRS" for female (F), or "CHD" if explicitly minor/child.`;

  const config: Record<string, any> = {
    systemInstruction: systemPrompt,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        errorReason: { type: Type.STRING },
        surname: { type: Type.STRING },
        givenNames: { type: Type.STRING },
        surnameLat: { type: Type.STRING },
        givenNamesLat: { type: Type.STRING },
        birthDate: { type: Type.STRING },
        title: { type: Type.STRING },
        series: { type: Type.STRING },
        number: { type: Type.STRING },
        issueDate: { type: Type.STRING },
        expiryDate: { type: Type.STRING },
        nationality: { type: Type.STRING },
        gender: { type: Type.STRING },
        country: { type: Type.STRING },
        rawMrz: { type: Type.STRING },
      },
      required: ['surname', 'givenNames', 'series', 'number'],
    },
    thinkingConfig: {
      thinkingLevel: useThinking ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
    },
  };

  let responseText = '';
  try {
    const response = await generateWithRetry(() =>
      client.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: 'Transcribe the exact passport details and MRZ from this image into JSON. Do not include patronymic. Do not invent any data.',
            },
          ],
        },
        config,
      })
    );
    responseText = response.text || '';
  } catch (aiErr: any) {
    const rawMsg = String(aiErr?.message || 'Gemini API xatosi');
    if (rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('403') || rawMsg.includes('401')) {
      throw new AppApiError(
        `Gemini API kaliti noto'g'ri yoki ruxsat yo'q. Settings > Secrets yoki Render Environment Variables bo'limida GEMINI_API_KEY ni tekshiring. (${rawMsg})`,
        403
      );
    }
    if (rawMsg.includes('NOT_FOUND') || rawMsg.includes('404')) {
      throw new AppApiError(`Gemini modeli topilmadi (${modelName}): ${rawMsg}`, 404);
    }
    throw new AppApiError(`Gemini AI tahlil xatosi: ${rawMsg}`, 502);
  }

  let parsedJson: Record<string, any> = {};
  try {
    parsedJson = JSON.parse(cleanJsonResponse(responseText) || '{}');
  } catch {
    throw new AppApiError("Sun'iy intellekt javobi JSON formatida qaytmadi. Rasmni qayta yuklab ko'ring.", 502);
  }

  if (parsedJson.errorReason && (!parsedJson.surname || !parsedJson.number)) {
    throw new AppApiError(`Pasport o'qilmadi: ${parsedJson.errorReason}`, 422);
  }

  const rawMrz = String(parsedJson.rawMrz || '').trim();
  const mrzCheck = rawMrz ? parseMrzLines(rawMrz) : null;

  const surname = String(parsedJson.surname || mrzCheck?.surname || '')
    .toUpperCase()
    .trim();
  const givenNames = stripPatronymic(
    String(parsedJson.givenNames || mrzCheck?.givenNames || '')
  );
  const surnameLat = String(parsedJson.surnameLat || surname)
    .toUpperCase()
    .trim();
  const givenNamesLat = stripPatronymic(
    String(parsedJson.givenNamesLat || givenNames)
  );

  // Extract series and number cleanly without inventing fallback numbers
  let series = String(parsedJson.series || mrzCheck?.series || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);
  let number = String(parsedJson.number || mrzCheck?.number || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  // If Gemini put full "FA1234567" into number and left series empty, split it
  if (!series && /^[A-Z]{1,3}[0-9]{5,9}$/.test(number)) {
    const splitMatch = number.match(/^([A-Z]{1,3})([0-9]{5,9})$/);
    if (splitMatch) {
      series = splitMatch[1];
      number = splitMatch[2];
    }
  } else if (series && number.startsWith(series) && number.length > series.length + 4) {
    number = number.slice(series.length);
  }

  if (!surname || !number) {
    throw new AppApiError(
      "Rasmdan pasport familiyasi yoki raqami aniqlanmadi. Iltimos, aniqroq pasport suratini yuklang.",
      422
    );
  }

  const gender: 'M' | 'F' =
    parsedJson.gender === 'F' || mrzCheck?.gender === 'F' ? 'F' : 'M';
  const title: 'MR' | 'MRS' | 'CHD' =
    parsedJson.title === 'CHD'
      ? 'CHD'
      : parsedJson.title === 'MRS' || gender === 'F'
      ? 'MRS'
      : 'MR';

  const record: PassportRecord = {
    id: `pass_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    surname,
    givenNames: givenNames || '-',
    surnameLat,
    givenNamesLat: givenNamesLat || givenNames || '-',
    birthDate: String(parsedJson.birthDate || mrzCheck?.birthDate || '').trim(),
    title,
    series,
    number,
    issueDate: ensureDotDate(String(parsedJson.issueDate || mrzCheck?.issueDate || '').trim()),
    expiryDate: ensureDotDate(String(parsedJson.expiryDate || mrzCheck?.expiryDate || '').trim()),
    nationality: String(parsedJson.nationality || mrzCheck?.nationality || "O'zbekiston").trim(),
    gender,
    country: String(parsedJson.country || mrzCheck?.country || "O'zbekiston").trim(),
    rawMrz,
    confidence: 0.99,
    engineUsed: modelName,
    parsedAt: new Date().toISOString(),
  };

  return { record, engine: modelName };
}

// ---------------------------------------------------------------------------
// 1. PASSPORT IMAGE PARSER API (Gemini Vision Only — No Fake Fallback)
// ---------------------------------------------------------------------------
app.post('/api/parse', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', useThinking = false, mode = 'ai', mrzText } = req.body;

    if (mode === 'offline') {
      if (typeof mrzText === 'string' && mrzText.trim().length > 0) {
        const record = parseMrzLines(mrzText);
        if (!record) {
          res.status(422).json({
            error: "Kiritilgan MRZ matndan pasport ma'lumotlari ajratib olinmadi. 2 qatorli MRZ kodini (P<UZB...) to'liq kiriting.",
          });
          return;
        }
        scannedPassports.push(record);
        res.json({ success: true, record, engine: 'offline-mrz' });
        return;
      }

      res.status(400).json({
        error:
          "Offline MRZ rejimida rasmni o'qib bo'lmaydi. Sun'iy intellekt (Gemini AI) rejimini tanlang yoki pasport ostidagi 2 qatorli MRZ matnini kiriting.",
      });
      return;
    }

    if (!imageBase64) {
      res.status(400).json({ error: 'Rasm yuborilmadi (Image base64 required)' });
      return;
    }

    const dataUrlMatch = String(imageBase64).match(/^data:([^;]+);base64,(.+)$/s);
    const detectedMime = dataUrlMatch ? dataUrlMatch[1].trim() : String(mimeType);
    const normalizedMime = detectedMime === 'image/jpg' ? 'image/jpeg' : detectedMime;
    const cleanBase64 = (dataUrlMatch ? dataUrlMatch[2] : String(imageBase64)).trim();

    const { record, engine } = await parsePassportImage(cleanBase64, normalizedMime, Boolean(useThinking));

    scannedPassports.push(record);
    res.json({ success: true, record, engine });
  } catch (error: any) {
    const statusCode = error instanceof AppApiError ? error.statusCode : 500;
    console.error('Error parsing passport:', error);
    res.status(statusCode).json({ error: error?.message || 'Pasportni tahlil qilishda xatolik yuz berdi' });
  }
});

// Deterministic MRZ 2-line text parser endpoint
app.post('/api/parse-mrz', (req: Request, res: Response) => {
  const { mrzText } = req.body;
  if (!mrzText || typeof mrzText !== 'string') {
    res.status(400).json({ error: 'MRZ matn kiritilmadi' });
    return;
  }
  const record = parseMrzLines(mrzText);
  if (!record) {
    res.status(422).json({
      error: "MRZ formati noto'g'ri yoki to'liq emas. Pasport ostidagi 2 qatorni (masalan P<UZB...) to'liq kiriting.",
    });
    return;
  }
  scannedPassports.push(record);
  res.json({ success: true, record, engine: 'offline-mrz' });
});

// ---------------------------------------------------------------------------
// 2. EXCEL GENERATION API (.xlsx)
// ---------------------------------------------------------------------------
// Helper to recursively add files into JSZip for full project export
async function addDirectoryToZip(zipFolder: JSZip, currentPath: string, rootPath: string) {
  const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.playwright-cli', '.aistudio', 'dev-dist'].includes(entry.name)) {
        continue;
      }
      const subFolder = zipFolder.folder(entry.name);
      if (subFolder) {
        await addDirectoryToZip(subFolder, fullPath, rootPath);
      }
    } else {
      if (entry.name.endsWith('.zip') || entry.name === 'bun.lock') {
        continue;
      }
      // Exclude large temporary screenshots
      if (entry.name.endsWith('.png') && fullPath.includes('assets/aistudio')) {
        continue;
      }
      const fileData = await fsPromises.readFile(fullPath);
      zipFolder.file(entry.name, fileData);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. EXCEL GENERATION API (.xlsx)
// ---------------------------------------------------------------------------
app.post('/api/excel/:template', async (req: Request, res: Response) => {
  try {
    const template = req.params.template as 'prestige' | 'flykhiva';
    const records: PassportRecord[] = req.body.records || scannedPassports;
    const flightDetails: Partial<FlightDetails> | undefined = req.body.flightDetails;

    if (!records || records.length === 0) {
      res.status(400).json({ error: 'Eksport qilish uchun pasportlar topilmadi' });
      return;
    }

    batchCount++;
    if (template === 'flykhiva') {
      flykhivaExports++;
      const wb = await generateFlyKhivaWorkbook(records, flightDetails);
      const buffer = await workbookToBuffer(wb);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Spisok_Na_Aviabileti_${flightDetails?.route || 'SSH-TAS'}_${Date.now()}.xlsx"`);
      res.send(buffer);
    } else {
      prestigeExports++;
      const wb = await generatePrestigeWorkbook(records);
      const buffer = await workbookToBuffer(wb);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Prestige_TAS_SHARM_${Date.now()}.xlsx"`);
      res.send(buffer);
    }
  } catch (error: any) {
    console.error('Error generating excel:', error);
    res.status(500).json({ error: error.message || 'Excel yaratishda xatolik yuz berdi' });
  }
});

// ---------------------------------------------------------------------------
// 3. ZIP ARCHIVE GENERATION API (Prestige + FlyKhiva + JSON Report)
// ---------------------------------------------------------------------------
app.post('/api/zip', async (req: Request, res: Response) => {
  try {
    const records: PassportRecord[] = req.body.records || scannedPassports;
    const flightDetails: Partial<FlightDetails> | undefined = req.body.flightDetails;
    if (!records || records.length === 0) {
      res.status(400).json({ error: 'ZIP to‘plami uchun pasportlar mavjud emas' });
      return;
    }

    const prestigeWb = await generatePrestigeWorkbook(records);
    const flykhivaWb = await generateFlyKhivaWorkbook(records, flightDetails);

    const prestigeBuffer = await workbookToBuffer(prestigeWb);
    const flykhivaBuffer = await workbookToBuffer(flykhivaWb);

    const zip = new JSZip();
    zip.file('Prestige_TAS_SHARM.xlsx', prestigeBuffer);
    zip.file('Spisok_Na_Aviabileti_FlyKhiva.xlsx', flykhivaBuffer);
    zip.file('Passport_Records_Manifest.json', JSON.stringify(records, null, 2));
    
    let deployDoc = '';
    try {
      deployDoc = await fsPromises.readFile(path.resolve(__dirname, 'README_DEPLOY.md'), 'utf-8');
    } catch {
      deployDoc = 'Grand Turan AI - Dasturchi: Muhammad Amin';
    }
    zip.file('README_DEPLOY.md', deployDoc);

    const zipContent = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      platform: 'DOS',
    });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', zipContent.length);
    res.setHeader('Content-Disposition', `attachment; filename="Grand_Turan_Zayavka_Pack_${Date.now()}.zip"`);
    res.send(zipContent);
  } catch (error: any) {
    console.error('Error creating ZIP:', error);
    res.status(500).json({ error: error.message || 'ZIP yaratishda xatolik' });
  }
});

// ---------------------------------------------------------------------------
// 3.1 FULL PROJECT ZIP (Ready to push to GitHub and deploy on Render/VPS)
// ---------------------------------------------------------------------------
app.get('/api/project-zip', async (req: Request, res: Response) => {
  try {
    const prebuiltZip = path.resolve(__dirname, 'public', 'Grand_Turan_AI_Full_Project_Source.zip');
    if (fs.existsSync(prebuiltZip)) {
      const stat = fs.statSync(prebuiltZip);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', 'attachment; filename="Grand_Turan_AI_Full_Project_Source.zip"');
      res.sendFile(prebuiltZip);
      return;
    }

    const zip = new JSZip();
    await addDirectoryToZip(zip, path.resolve(__dirname), path.resolve(__dirname));
    const zipContent = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      platform: 'DOS',
    });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', zipContent.length);
    res.setHeader('Content-Disposition', 'attachment; filename="Grand_Turan_AI_Full_Project_Source.zip"');
    res.send(zipContent);
  } catch (error: any) {
    console.error('Error creating project ZIP:', error);
    res.status(500).json({ error: error.message || 'Loyiha ZIP yaratishda xatolik' });
  }
});

// ---------------------------------------------------------------------------
// 4. TELEGRAM BOT WEBHOOK & BOT LOGIC
// ---------------------------------------------------------------------------
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    const message = update?.message || update?.edited_message;
    if (!message) {
      res.json({ ok: true });
      return;
    }

    const chatId = message.chat.id;
    const text = message.text ? message.text.trim() : '';
    const session = getSession(chatId);

    // Helper to send message via Telegram Bot API if token is configured
    const sendTelegramReply = async (replyText: string, replyMarkup?: any) => {
      if (!botToken) return;
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: replyText,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          }),
        });
      } catch (err) {
        console.error('Failed to send Telegram message:', err);
      }
    };

    // Command handling
    if (text.startsWith('/start')) {
      const welcome = `⚜️ <b>Grand Turan — AI Pasport & Updater Bot</b>\n\n` +
        `Assalomu alaykum! Tizimga xush kelibsiz.\n` +
        `👨💻 <b>Dasturchi:</b> Muhammad Amin\n\n` +
        `📸 Pasport rasmlarini yuboring (1 tadan 100 tagacha), so'ng:\n` +
        `• /flykhiva — FlyKhiva Zayafka (.xlsx) olish\n` +
        `• /prestige — Zayafka Prestige (.xlsx) olish\n` +
        `• /clear — navbatni tozalash\n\n` +
        `⚙️ Server & Updater buyruqlari:\n` +
        `• /status — Render server, AI va Baza holati\n` +
        `• /redeploy — Render serverni qayta yangilash`;

      await sendTelegramReply(welcome, {
        inline_keyboard: [
          [
            { text: '✈️ FlyKhiva Rejimi', callback_data: 'mode_flykhiva' },
            { text: '🏛 Prestige Rejimi', callback_data: 'mode_prestige' },
          ],
        ],
      });
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/skip')) {
      session.useApi = false;
      await sendTelegramReply(`ℹ️ <b>MRZ matn rejimi yoqildi!</b>\nPasport ostidagi 2 qatorli MRZ matnini (P<UZB...) yuboring yoki AI uchun rasm tashlang.`);
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/flykhiva')) {
      session.template = 'flykhiva';
      if (session.passports.length > 0) {
        await sendTelegramReply(`✈️ <b>FlyKhiva Zayavka tayyorlanmoqda...</b>\nJami: ${session.passports.length} ta yo'lovchi`);
      } else {
        await sendTelegramReply(`✈️ <b>FlyKhiva rejimi tanlandi!</b>\nIltimos, pasport rasmlarini yuboring.`);
      }
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/prestige')) {
      session.template = 'prestige';
      if (session.passports.length > 0) {
        await sendTelegramReply(`🏛 <b>Prestige Zayavka tayyorlanmoqda...</b>\nJami: ${session.passports.length} ta pasport`);
      } else {
        await sendTelegramReply(`🏛 <b>Prestige rejimi tanlandi!</b>\nIltimos, pasport rasmlarini yuboring.`);
      }
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/clear')) {
      session.passports = [];
      await sendTelegramReply(`🧹 <b>Navbat tozalandi!</b> Yangi pasport rasmlarini yuborishingiz mumkin.`);
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/status')) {
      const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
      const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
      const aiReady = Boolean(getEffectiveGeminiKey());
      const msg = `⚙️ <b>Server & Updater Holati:</b>\n\n` +
        `🟢 <b>Server:</b> Faol (Uptime: ${uptimeSec} soniya)\n` +
        `🧠 <b>AI Dvigateli:</b> gemini-4-hydrogen (${aiReady ? 'Faol' : 'GEMINI_API_KEY kiritilmagan'})\n` +
        `💾 <b>Baza:</b> ${scannedPassports.length} ta pasport yozilgan\n` +
        `📊 <b>Xotira:</b> ${memMb} MB\n` +
        `👨💻 <b>Dasturchi:</b> Muhammad Amin\n` +
        `🚀 <b>Render Deploy:</b> ${deployHookUrl ? 'Ulangan' : 'Sozlanmagan'}`;
      await sendTelegramReply(msg);
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/redeploy')) {
      if (deployHookUrl) {
        try {
          await fetch(deployHookUrl, { method: 'POST' });
          await sendTelegramReply(`🚀 <b>Render qayta ishga tushirildi!</b> Deploy hook muvaffaqiyatli jo'natildi.`);
        } catch (e: any) {
          await sendTelegramReply(`⚠️ Deploy hook xatosi: ${e.message}`);
        }
      } else {
        await sendTelegramReply(`⚠️ Deploy hook sozlanmagan. Admin paneldan Render Deploy Hook URL kiriting.`);
      }
      res.json({ ok: true });
      return;
    }

    // Raw MRZ text sent directly to Telegram bot
    if (text.includes('P<')) {
      const mrzRecord = parseMrzLines(text);
      if (mrzRecord) {
        session.passports.push(mrzRecord);
        scannedPassports.push(mrzRecord);
        const reply = `✅ <b>MRZ qabul qilindi (#${session.passports.length}):</b>\n` +
          `👤 <b>F.I.O:</b> ${mrzRecord.surname} ${mrzRecord.givenNames}\n` +
          `📄 <b>Pasport №:</b> ${mrzRecord.series}${mrzRecord.number}\n` +
          `📅 <b>Tug'ilgan:</b> ${mrzRecord.birthDate}\n` +
          `⏳ <b>Amal qilish:</b> ${mrzRecord.expiryDate}\n` +
          `⚡️ <b>Dvigatel:</b> offline-mrz`;
        await sendTelegramReply(reply);
      } else {
        await sendTelegramReply(`⚠️ MRZ matnidan ma'lumot ajratib bo'lmadi. Iltimos 2 qatorni to'liq yuboring.`);
      }
      res.json({ ok: true });
      return;
    }

    // Photo uploaded in Telegram
    if (message.photo && message.photo.length > 0) {
      await sendTelegramReply(`📸 Rasm qabul qilindi, sun'iy intellekt tahlil qilmoqda...`);

      let cleanBase64 = '';
      if (botToken) {
        try {
          const largestPhoto = message.photo[message.photo.length - 1];
          const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${largestPhoto.file_id}`);
          const fileData = await fileRes.json();
          if (fileData.ok && fileData.result?.file_path) {
            const imgRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`);
            const arrayBuffer = await imgRes.arrayBuffer();
            cleanBase64 = Buffer.from(arrayBuffer).toString('base64');
          }
        } catch (fetchErr: any) {
          console.error('Failed to download telegram photo:', fetchErr.message);
        }
      }

      if (!cleanBase64) {
        await sendTelegramReply(`❌ Telegram rasmni yuklab bo'lmadi (TELEGRAM_BOT_TOKEN ni tekshiring).`);
        res.json({ ok: true });
        return;
      }

      try {
        const result = await parsePassportImage(cleanBase64, 'image/jpeg');
        const parsedRecord = result.record;
        const engineName = result.engine;

        session.passports.push(parsedRecord);
        scannedPassports.push(parsedRecord);

        const reply = `✅ <b>Pasport qabul qilindi (#${session.passports.length}):</b>\n` +
          `👤 <b>F.I.O:</b> ${parsedRecord.surname} ${parsedRecord.givenNames}\n` +
          `📄 <b>Pasport №:</b> ${parsedRecord.series}${parsedRecord.number}\n` +
          `📅 <b>Tug'ilgan:</b> ${parsedRecord.birthDate}\n` +
          `⏳ <b>Amal qilish:</b> ${parsedRecord.expiryDate}\n` +
          `⚡️ <b>Dvigatel:</b> ${engineName}\n\n` +
          `<i>Yana rasm yuboring yoki /flykhiva yoki /prestige buyrug'ini bosing.</i>`;

        await sendTelegramReply(reply, {
          inline_keyboard: [
            [
              { text: '📥 FlyKhiva Excel olish', callback_data: 'get_flykhiva' },
              { text: '📥 Prestige Excel olish', callback_data: 'get_prestige' },
            ],
          ],
        });
      } catch (parseErr: any) {
        await sendTelegramReply(`❌ <b>Tahlil xatosi:</b> ${parseErr?.message || "Rasmni o'qib bo'lmadi"}`);
      }
      res.json({ ok: true });
      return;
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.json({ ok: true });
  }
});

// ---------------------------------------------------------------------------
// 5. ADMIN & UPDATER APIs
// ---------------------------------------------------------------------------
app.get('/api/admin/status', (req: Request, res: Response) => {
  const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
  const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

  res.json({
    totalScanned: scannedPassports.length,
    totalBatches: batchCount,
    prestigeCount: prestigeExports,
    flykhivaCount: flykhivaExports,
    uptimeSeconds: uptimeSec,
    nodeVersion: process.version,
    memoryUsageMb: memMb,
    aiEngineStatus: getEffectiveGeminiKey() ? 'active' : 'missing_key',
    telegramWebhookConfigured: Boolean(botToken),
    telegramBotUsername: '@grandturanai_bot',
    renderDeployHookConfigured: Boolean(deployHookUrl),
    githubRepo: 'maxpubg2080-ctrl/Grand-Turan-AI---v2.4-Release',
  });
});

app.post('/api/admin/settings', (req: Request, res: Response) => {
  const { pin, newBotToken, newDeployHookUrl } = req.body;
  if (pin !== '1111' && pin !== '7777') {
    res.status(403).json({ error: "PIN kod noto'g'ri (1111 yoki 7777 talab qilinadi)" });
    return;
  }
  if (newBotToken !== undefined) botToken = newBotToken;
  if (newDeployHookUrl !== undefined) deployHookUrl = newDeployHookUrl;

  res.json({
    success: true,
    message: 'Sozlamalar yangilandi',
    telegramConfigured: Boolean(botToken),
    renderConfigured: Boolean(deployHookUrl),
  });
});

app.post('/api/admin/deploy', async (req: Request, res: Response) => {
  const { pin } = req.body;
  if (pin !== '1111' && pin !== '7777') {
    res.status(403).json({ error: "PIN kod noto'g'ri (1111 yoki 7777 talab qilinadi)" });
    return;
  }
  if (!deployHookUrl) {
    res.status(400).json({ error: 'Render Deploy Hook URL sozlanmagan' });
    return;
  }

  try {
    const hookRes = await fetch(deployHookUrl, { method: 'POST' });
    res.json({
      success: true,
      status: hookRes.status,
      message: 'Render Deploy muvaffaqiyatli ishga tushirildi!',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Deploy hook chaqirishda xatolik' });
  }
});

app.get('/api/admin/records', (req: Request, res: Response) => {
  res.json({ records: scannedPassports });
});

app.delete('/api/admin/records/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = scannedPassports.findIndex((p) => p.id === id);
  if (idx !== -1) {
    scannedPassports.splice(idx, 1);
  }
  res.json({ success: true, count: scannedPassports.length });
});

// ---------------------------------------------------------------------------
// 6. SERVE VITE IN DEV OR STATIC IN PRODUCTION
// ---------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`⚜️ Grand Turan AI Server running on http://0.0.0.0:${port}`);
    console.log(`👨💻 Dasturchi: Muhammad Amin`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
