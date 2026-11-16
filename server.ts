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
  verifyMrzLine2,
  stripPatronymic,
  ensureDotDate,
  resolvePassengerTitle,
} from './src/utils/mrzParser.ts';
import { generatePrestigeWorkbook, generateFlyKhivaWorkbook, workbookToBuffer } from './src/utils/excelGenerator.ts';
import {
  collectProviderKeys,
  rotateProviderKeys,
  interleaveProviderQueues,
  extractJsonObjectString,
  summarizeProviderErrors,
  selectGeminiVisionModels,
  selectOpenRouterFreeVisionModels,
  selectGroqVisionModels,
  selectSambaNovaVisionModels,
  selectMistralVisionModels,
  GeminiCatalogModel,
  OpenAiCatalogModel,
} from './src/utils/aiProviders.ts';
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

function resolvePublicAppUrl(req?: Request): string {
  const host = req?.get('host') || '';
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `https://${host}`;
  }
  const envUrl = (process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || '').trim();
  if (envUrl.startsWith('https://') && !envUrl.includes('MY_APP_URL')) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'https://grand-turan-ai-v2-4-release.onrender.com';
}

function getGeminiKeys(): string[] {
  return collectProviderKeys(process.env, 'GEMINI');
}

function getEffectiveGeminiKey(): string {
  return getGeminiKeys()[0] || '';
}

function getExternalProviderKeys() {
  const githubKeys = collectProviderKeys(process.env, 'GITHUB');
  const legacyGhToken = (process.env.GITHUB_TOKEN || '').trim();
  if (legacyGhToken.length >= 10 && !githubKeys.includes(legacyGhToken)) {
    githubKeys.push(legacyGhToken);
  }
  return {
    groq: collectProviderKeys(process.env, 'GROQ'),
    github: githubKeys,
    openrouter: collectProviderKeys(process.env, 'OPENROUTER'),
    sambanova: collectProviderKeys(process.env, 'SAMBANOVA'),
    mistral: collectProviderKeys(process.env, 'MISTRAL'),
  };
}

function getActiveEngineLabels(): string[] {
  const labels: string[] = [];
  const geminiKeys = getGeminiKeys();
  if (geminiKeys.length > 0) {
    labels.push(`Gemini (${geminiKeys.length} kalit • Auto-Vision)`);
  }
  const ext = getExternalProviderKeys();
  if (ext.groq.length > 0) labels.push(`Groq Vision (${ext.groq.length} kalit)`);
  if (ext.openrouter.length > 0) labels.push(`OpenRouter :free (${ext.openrouter.length} kalit)`);
  if (ext.sambanova.length > 0) labels.push(`SambaNova Gemma-4 (${ext.sambanova.length} kalit)`);
  if (ext.mistral.length > 0) labels.push(`Mistral Vision (${ext.mistral.length} kalit)`);
  labels.push('Offline MRZ Checksum');
  return labels;
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

// Cooldown tracking for exhausted free-tier (provider:model:keyIndex) slots
const providerCooldowns = new Map<string, number>();

function isSlotOnCooldown(slotId: string): boolean {
  const until = providerCooldowns.get(slotId) || 0;
  return Date.now() < until;
}

function markSlotCooldown(slotId: string, ms: number) {
  providerCooldowns.set(slotId, Date.now() + ms);
}

// 30-minute cached live model discovery per provider/key so deprecated 404 slugs never break OCR
const modelCatalogCache = new Map<string, { models: string[]; expiresAt: number }>();

async function getCachedDiscoveredModels(
  cacheKey: string,
  fetcher: () => Promise<string[]>,
  fallbackModels: string[]
): Promise<string[]> {
  const cached = modelCatalogCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt && cached.models.length > 0) {
    return cached.models;
  }
  try {
    const discovered = await fetcher();
    const resolved = discovered.length > 0 ? discovered : fallbackModels;
    modelCatalogCache.set(cacheKey, {
      models: resolved,
      expiresAt: Date.now() + 30 * 60_000,
    });
    return resolved;
  } catch {
    return fallbackModels;
  }
}

async function fetchJsonWithTimeout(url: string, headers: Record<string, string> = {}, timeoutMs = 2_500): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cleanJsonResponse(text: string): string {
  return extractJsonObjectString(text);
}

const OCR_SYSTEM_PROMPT = `You are a strict, 100% truthful passport data extraction OCR engine.
CRITICAL RULES:
1. Read ONLY the actual text and 2-line MRZ printed on the provided passport image. NEVER guess, invent, or substitute placeholder names or numbers.
2. CHARACTER-BY-CHARACTER ACCURACY: Compare every single letter of Surname, Given Name, Series, Number, Birth Date, and Expiry Date between the visual bio-page AND the bottom 2-line OCR-B MRZ string. Watch carefully for easily confused characters (KH vs X, I vs Y, IY vs I, O vs 0, B vs 8, S vs 5, Z vs 2, U vs V). Use the OCR-B MRZ line at the bottom as your primary spelling reference.
3. If the image is NOT a passport or is completely illegible so surname or passport number cannot be read, set errorReason to a brief explanation and leave surname/number empty.
4. NEVER include patronymic / middle name / father's name (otasining ismi, e.g., O'G'LI, QIZI, OGLI, KIZI, -VICH, -OVNA, ABDULKHAMIDOVICH) in givenNames or givenNamesLat. Output strictly the Surname and First Given Name only.
5. Read the 2-line MRZ at the bottom verbatim into rawMrz (preserve exact 44 characters per line including '<' separators and digits).
6. Format dates precisely:
   - birthDate: Uzbek format "YYYY-yil D-oy" (lowercase months: yanvar, fevral, mart, aprel, may, iyun, iyul, avgust, sentabr, oktabr, noyabr, dekabr, e.g. "1986-yil 7-may").
   - issueDate: "DD.MM.YYYY" (leave "" if not printed on document).
   - expiryDate: "DD.MM.YYYY".
7. Extract series (2-3 uppercase letters, e.g. FA, AA, AB) and number (digits, e.g. 3832280) separately.
8. Return gender as "M" or "F".`;

const OPENAI_VISION_USER_PROMPT = `Transcribe the exact passport details and 2-line MRZ from this image into pure JSON with keys: errorReason, surname, givenNames, surnameLat, givenNamesLat, birthDate, series, number, issueDate, expiryDate, nationality, gender, country, rawMrz. Do not include patronymic. Return JSON only.`;

function buildNormalizedRecord(parsedJson: Record<string, any>, engineName: string): PassportRecord {
  if (parsedJson.errorReason && (!parsedJson.surname || !parsedJson.number)) {
    throw new AppApiError(`Pasport o'qilmadi: ${parsedJson.errorReason}`, 422);
  }

  const rawMrz = String(parsedJson.rawMrz || '').trim();
  const mrzCheck = rawMrz ? parseMrzLines(rawMrz) : null;
  const mrzLine2 = mrzCheck?.rawMrz?.split('\n')[1] || '';
  const mrzChecks = mrzLine2
    ? verifyMrzLine2(mrzLine2)
    : { numberValid: false, dobValid: false, expiryValid: false };
  const mrzLine1 = mrzCheck?.rawMrz?.split('\n')[0] || '';
  const mrzHasCleanNameDelimiter = mrzLine1.includes('<<') && (mrzLine1.split('<<')[1] || '').includes('<');

  // Prefer mathematically checksum-verified MRZ fields when available
  const visualSurname = String(parsedJson.surname || '').toUpperCase().trim();
  const visualGiven = stripPatronymic(String(parsedJson.givenNames || ''));

  const surname =
    mrzChecks.numberValid && mrzHasCleanNameDelimiter && mrzCheck?.surname
      ? mrzCheck.surname
      : visualSurname || mrzCheck?.surname || '';

  const givenNames =
    mrzChecks.numberValid && mrzHasCleanNameDelimiter && mrzCheck?.givenNames
      ? mrzCheck.givenNames
      : visualGiven || mrzCheck?.givenNames || '';

  const surnameLat = String(parsedJson.surnameLat || surname)
    .toUpperCase()
    .trim();
  const givenNamesLat = stripPatronymic(String(parsedJson.givenNamesLat || givenNames));

  let series = (
    mrzChecks.numberValid && mrzCheck?.series
      ? mrzCheck.series
      : String(parsedJson.series || mrzCheck?.series || '')
  )
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);
  let number = (
    mrzChecks.numberValid && mrzCheck?.number
      ? mrzCheck.number
      : String(parsedJson.number || mrzCheck?.number || '')
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

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
    String(parsedJson.gender || '').toUpperCase().startsWith('F') || mrzCheck?.gender === 'F'
      ? 'F'
      : 'M';

  const resolvedBirthDate =
    mrzChecks.dobValid && mrzCheck?.birthDate
      ? mrzCheck.birthDate
      : String(parsedJson.birthDate || mrzCheck?.birthDate || '').trim();

  const resolvedExpiryDate =
    mrzChecks.expiryValid && mrzCheck?.expiryDate
      ? mrzCheck.expiryDate
      : ensureDotDate(String(parsedJson.expiryDate || mrzCheck?.expiryDate || '').trim());

  // Strict aviation age classification (<2 INF, 2-11 CHD, 12+ MR/MRS)
  const title = resolvePassengerTitle(resolvedBirthDate, gender);

  return {
    id: `pass_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    surname,
    givenNames: givenNames || '-',
    surnameLat: mrzChecks.numberValid && mrzHasCleanNameDelimiter ? surname : surnameLat,
    givenNamesLat:
      (mrzChecks.numberValid && mrzHasCleanNameDelimiter ? givenNames : givenNamesLat) ||
      givenNames ||
      '-',
    birthDate: resolvedBirthDate,
    title,
    series,
    number,
    issueDate: ensureDotDate(String(parsedJson.issueDate || mrzCheck?.issueDate || '').trim()),
    expiryDate: resolvedExpiryDate,
    nationality: String(parsedJson.nationality || mrzCheck?.nationality || "O'zbekiston").trim(),
    gender,
    country: String(parsedJson.country || mrzCheck?.country || "O'zbekiston").trim(),
    rawMrz,
    confidence: 0.99,
    engineUsed: engineName,
    parsedAt: new Date().toISOString(),
  };
}

let keyRotationCursor = 0;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        // ignore abort errors
      }
      const err: any = new Error(`${label} timeout (${Math.round(timeoutMs / 1000)}s)`);
      err.isTimeout = true;
      reject(err);
    }, timeoutMs);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function callGeminiModel(
  apiKey: string,
  modelName: string,
  cleanBase64: string,
  mimeType: string,
  useThinking: boolean,
  timeoutMs: number
): Promise<string> {
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      retryOptions: {
        attempts: 1,
      },
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const isGemma = /^gemma-/i.test(modelName);
  const controller = new AbortController();
  const config: Record<string, any> = {
    abortSignal: controller.signal,
  };

  if (!isGemma) {
    config.systemInstruction = OCR_SYSTEM_PROMPT;
    config.responseMimeType = 'application/json';
    config.responseSchema = {
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
    };
  }

  if (modelName === 'gemini-4-hydrogen') {
    config.thinkingConfig = {
      thinkingLevel: useThinking ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
    };
  }

  const promptText = isGemma
    ? `${OCR_SYSTEM_PROMPT}\n\n${OPENAI_VISION_USER_PROMPT}`
    : 'Transcribe the exact passport details and MRZ from this image into JSON. Do not include patronymic. Do not invent any data.';

  const response = await withTimeout(
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
            text: promptText,
          },
        ],
      },
      config,
    }),
    timeoutMs,
    modelName,
    () => controller.abort()
  );

  return response.text || '';
}

async function callOpenAiCompatibleVision(
  endpoint: string,
  apiKey: string,
  model: string,
  cleanBase64: string,
  mimeType: string,
  extraHeaders: Record<string, string> = {},
  timeoutMs: number = 10_000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const combinedPrompt = `${OCR_SYSTEM_PROMPT}\n\n${OPENAI_VISION_USER_PROMPT}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 900,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: combinedPrompt },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${cleanBase64}` },
              },
            ],
          },
        ],
      }),
    });

    const rawText = await res.text().catch(() => '');
    if (!res.ok) {
      const err: any = new Error(`HTTP ${res.status}: ${rawText || res.statusText}`);
      err.status = res.status;
      throw err;
    }

    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      const err: any = new Error(`HTTP ${res.status} JSON o'rniga matn qaytardi: ${rawText.slice(0, 80)}`);
      err.isNonJsonEndpoint = true;
      throw err;
    }
    return String(json?.choices?.[0]?.message?.content || '');
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      const timeoutErr: any = new Error(`${model} timeout (${Math.round(timeoutMs / 1000)}s)`);
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function classifyProviderError(err: any) {
  const msg = String(err?.message || '');
  const status = err?.status || err?.code;
  const isTimeout = Boolean(err?.isTimeout || err?.name === 'AbortError' || /timeout|aborted/i.test(msg));
  const isRateLimit =
    status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('rate_limit');
  const isDailyLimit =
    isRateLimit &&
    (/perday|daily|rpd|limit:\s*20|quota/i.test(msg) && !/perminute|rpm|retry in \d+s/i.test(msg));
  const isNotFound =
    Boolean(err?.isNonJsonEndpoint) || status === 404 || msg.includes('404') || msg.includes('NOT_FOUND');
  const isAuthError =
    status === 401 || status === 403 || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID');
  return { msg, isTimeout, isRateLimit, isDailyLimit, isNotFound, isAuthError };
}

async function parsePassportImage(
  cleanBase64: string,
  mimeType: string,
  useThinking: boolean = false
): Promise<{ record: PassportRecord; engine: string }> {
  const geminiKeys = getGeminiKeys();
  const extKeys = getExternalProviderKeys();

  if (
    geminiKeys.length === 0 &&
    extKeys.groq.length === 0 &&
    extKeys.openrouter.length === 0 &&
    extKeys.sambanova.length === 0 &&
    extKeys.mistral.length === 0
  ) {
    const githubOnlyNotice =
      extKeys.github.length > 0
        ? " Eslatma: GitHub Models (models.github.ai) 2026-yil iyul oyida yopilgan."
        : '';
    throw new AppApiError(
      `Serverda faol AI kaliti sozlanmagan (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, SAMBANOVA_API_KEY yoki MISTRAL_API_KEY kiriting, yoki Offline MRZ matn rejimidan foydalaning).${githubOnlyNotice}`,
      400
    );
  }

  type AttemptSpec = {
    id: string;
    provider: string;
    label: string;
    run: () => Promise<string>;
  };

  const cursor = keyRotationCursor++;
  const attemptTimeoutMs = useThinking ? 14_000 : 9_500;
  const totalCascadeBudgetMs = 38_000;
  const cascadeStart = Date.now();

  // Discover live vision models per provider in parallel (cached 30 min so overhead is 0ms on repeat scans)
  const rotatedGeminiKeys = rotateProviderKeys(
    geminiKeys.map((key, idx) => ({ key, idx })),
    cursor
  );
  const rotatedGroqKeys = rotateProviderKeys(
    extKeys.groq.map((key, idx) => ({ key, idx })),
    cursor
  );
  const rotatedOpenRouterKeys = rotateProviderKeys(
    extKeys.openrouter.map((key, idx) => ({ key, idx })),
    cursor
  );
  const rotatedSambaKeys = rotateProviderKeys(
    extKeys.sambanova.map((key, idx) => ({ key, idx })),
    cursor
  );
  const rotatedMistralKeys = rotateProviderKeys(
    extKeys.mistral.map((key, idx) => ({ key, idx })),
    cursor
  );

  const [geminiModelsPerKey, groqModels, openrouterModels, sambaModels, mistralModels] = await Promise.all([
    Promise.all(
      rotatedGeminiKeys.map(({ key, idx }) =>
        getCachedDiscoveredModels(
          `gemini:${idx}:${useThinking ? 'think' : 'fast'}`,
          async () => {
            const data = await fetchJsonWithTimeout(
              `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
            );
            const list: GeminiCatalogModel[] = Array.isArray(data?.models) ? data.models : [];
            return selectGeminiVisionModels(list, { useThinking, maxModels: 4 });
          },
          ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']
        )
      )
    ),
    rotatedGroqKeys.length > 0
      ? getCachedDiscoveredModels(
          'groq',
          async () => {
            const data = await fetchJsonWithTimeout('https://api.groq.com/openai/v1/models', {
              Authorization: `Bearer ${rotatedGroqKeys[0].key}`,
            });
            const list: OpenAiCatalogModel[] = Array.isArray(data?.data) ? data.data : [];
            return selectGroqVisionModels(list, 3);
          },
          ['qwen/qwen3.8-27b', 'meta-models/muse-spark-open']
        )
      : Promise.resolve([]),
    rotatedOpenRouterKeys.length > 0
      ? getCachedDiscoveredModels(
          'openrouter',
          async () => {
            const data = await fetchJsonWithTimeout('https://openrouter.ai/api/v1/models');
            const list: OpenAiCatalogModel[] = Array.isArray(data?.data) ? data.data : [];
            return selectOpenRouterFreeVisionModels(list, 5);
          },
          [
            'google/gemma-4-31b-it:free',
            'google/gemma-4-26b-a4b-it:free',
            'nvidia/nemotron-3.5-super-vl:free',
            'openrouter/free',
          ]
        )
      : Promise.resolve([]),
    rotatedSambaKeys.length > 0
      ? getCachedDiscoveredModels(
          'sambanova',
          async () => {
            const data = await fetchJsonWithTimeout('https://api.sambanova.ai/v1/models', {
              Authorization: `Bearer ${rotatedSambaKeys[0].key}`,
            });
            const list: OpenAiCatalogModel[] = Array.isArray(data?.data) ? data.data : [];
            return selectSambaNovaVisionModels(list, 3);
          },
          ['gemma-4-31B-it']
        )
      : Promise.resolve([]),
    rotatedMistralKeys.length > 0
      ? getCachedDiscoveredModels(
          'mistral',
          async () => {
            const data = await fetchJsonWithTimeout('https://api.mistral.ai/v1/models', {
              Authorization: `Bearer ${rotatedMistralKeys[0].key}`,
            });
            const list: OpenAiCatalogModel[] = Array.isArray(data?.data) ? data.data : [];
            return selectMistralVisionModels(list, 3);
          },
          ['mistral-small-latest', 'mistral-medium-latest', 'pixtral-12b-2409']
        )
      : Promise.resolve([]),
  ]);

  // Build per-provider rotated queues so parallel & sequential calls spread across all keys
  const geminiQueue: AttemptSpec[] = [];
  const maxGeminiDepth = geminiModelsPerKey.reduce((max, arr) => Math.max(max, arr.length), 0);
  for (let mIdx = 0; mIdx < maxGeminiDepth; mIdx++) {
    for (let kPos = 0; kPos < rotatedGeminiKeys.length; kPos++) {
      const model = geminiModelsPerKey[kPos]?.[mIdx];
      if (!model) continue;
      const { key, idx } = rotatedGeminiKeys[kPos];
      const suffix = geminiKeys.length > 1 ? `#${idx + 1}` : '';
      geminiQueue.push({
        id: `gemini:${model}:${idx}`,
        provider: 'Gemini',
        label: `${model}${suffix}`,
        run: () => callGeminiModel(key, model, cleanBase64, mimeType, useThinking, attemptTimeoutMs),
      });
    }
  }

  const groqQueue: AttemptSpec[] = [];
  for (const model of groqModels) {
    for (const { key, idx } of rotatedGroqKeys) {
      const suffix = extKeys.groq.length > 1 ? `#${idx + 1}` : '';
      groqQueue.push({
        id: `groq:${model}:${idx}`,
        provider: 'Groq',
        label: `groq:${model.split('/').pop()}${suffix}`,
        run: () =>
          callOpenAiCompatibleVision(
            'https://api.groq.com/openai/v1/chat/completions',
            key,
            model,
            cleanBase64,
            mimeType,
            {},
            attemptTimeoutMs
          ),
      });
    }
  }

  const sambanovaQueue: AttemptSpec[] = [];
  for (const model of sambaModels) {
    for (const { key, idx } of rotatedSambaKeys) {
      const suffix = extKeys.sambanova.length > 1 ? `#${idx + 1}` : '';
      sambanovaQueue.push({
        id: `sambanova:${model}:${idx}`,
        provider: 'SambaNova',
        label: `sambanova:${model}${suffix}`,
        run: () =>
          callOpenAiCompatibleVision(
            'https://api.sambanova.ai/v1/chat/completions',
            key,
            model,
            cleanBase64,
            mimeType,
            {},
            attemptTimeoutMs
          ),
      });
    }
  }

  const openrouterQueue: AttemptSpec[] = [];
  for (const model of openrouterModels) {
    for (const { key, idx } of rotatedOpenRouterKeys) {
      const suffix = extKeys.openrouter.length > 1 ? `#${idx + 1}` : '';
      openrouterQueue.push({
        id: `openrouter:${model}:${idx}`,
        provider: 'OpenRouter',
        label: `openrouter:${model.split('/').pop()}${suffix}`,
        run: () =>
          callOpenAiCompatibleVision(
            'https://openrouter.ai/api/v1/chat/completions',
            key,
            model,
            cleanBase64,
            mimeType,
            { 'HTTP-Referer': 'https://grand-turan-ai.onrender.com', 'X-Title': 'Grand Turan AI' },
            attemptTimeoutMs
          ),
      });
    }
  }

  const mistralQueue: AttemptSpec[] = [];
  for (const model of mistralModels) {
    for (const { key, idx } of rotatedMistralKeys) {
      const suffix = extKeys.mistral.length > 1 ? `#${idx + 1}` : '';
      mistralQueue.push({
        id: `mistral:${model}:${idx}`,
        provider: 'Mistral',
        label: `mistral:${model}${suffix}`,
        run: () =>
          callOpenAiCompatibleVision(
            'https://api.mistral.ai/v1/chat/completions',
            key,
            model,
            cleanBase64,
            mimeType,
            {},
            attemptTimeoutMs
          ),
      });
    }
  }

  // Interleave fast providers round-by-round so one slow/blocked provider never stalls the rest
  const attempts = interleaveProviderQueues([
    geminiQueue,
    groqQueue,
    sambanovaQueue,
    openrouterQueue,
    mistralQueue,
  ]);

  let lastErrorMsg = '';
  const failureSamples: Array<{ provider: string; detail: string }> = [];
  const rpmPausedCandidates: AttemptSpec[] = [];
  let sawOnlyAuthErrors = true;
  const triedLabels: string[] = [];

  for (const candidate of attempts) {
    if (isSlotOnCooldown(candidate.id)) {
      continue;
    }
    if (Date.now() - cascadeStart >= totalCascadeBudgetMs) {
      lastErrorMsg = lastErrorMsg || `AI kaskad vaqti tugadi (${Math.round(totalCascadeBudgetMs / 1000)}s)`;
      break;
    }
    triedLabels.push(candidate.label);
    try {
      const responseText = await candidate.run();
      let parsedJson: Record<string, any> = {};
      try {
        parsedJson = JSON.parse(cleanJsonResponse(responseText) || '{}');
      } catch {
        // Non-JSON answer from fallback model; try next candidate
        const detail = 'JSON javob qaytarmadi';
        lastErrorMsg = `${candidate.label}: ${detail}`;
        failureSamples.push({ provider: candidate.provider, detail });
        sawOnlyAuthErrors = false;
        continue;
      }

      // If image itself is NOT a passport / unreadable, return explicit 422 right away (don't burn other quotas)
      const record = buildNormalizedRecord(parsedJson, candidate.label);
      return { record, engine: candidate.label };
    } catch (err: any) {
      if (err instanceof AppApiError && err.statusCode === 422) {
        throw err;
      }
      const { msg, isTimeout, isRateLimit, isDailyLimit, isNotFound, isAuthError } = classifyProviderError(err);
      lastErrorMsg = `${candidate.label}: ${msg}`;
      failureSamples.push({ provider: candidate.provider, detail: msg });

      if (!isAuthError) {
        sawOnlyAuthErrors = false;
      }

      if (isNotFound || isAuthError) {
        // Model unsupported or invalid key -> skip for 30 min
        markSlotCooldown(candidate.id, 30 * 60_000);
      } else if (isDailyLimit) {
        // Daily RPD limit reached -> cooldown for 15 min so next scans jump straight to fallback
        markSlotCooldown(candidate.id, 15 * 60_000);
      } else if (isTimeout) {
        // Timed out endpoint -> skip for 20s so parallel batch files try faster providers
        markSlotCooldown(candidate.id, 20_000);
      } else if (isRateLimit) {
        // Transient per-minute RPM limit -> short 15s cooldown & keep 1 retry candidate
        markSlotCooldown(candidate.id, 15_000);
        rpmPausedCandidates.push(candidate);
      }
    }
  }

  // Short retry only if we still have ample budget remaining
  if (rpmPausedCandidates.length > 0 && Date.now() - cascadeStart < 25_000) {
    await new Promise((r) => setTimeout(r, 2_500));
    const retryTarget = rpmPausedCandidates[0];
    try {
      const responseText = await retryTarget.run();
      const parsedJson = JSON.parse(cleanJsonResponse(responseText) || '{}');
      const record = buildNormalizedRecord(parsedJson, retryTarget.label);
      return { record, engine: retryTarget.label };
    } catch (retryErr: any) {
      if (retryErr instanceof AppApiError && retryErr.statusCode === 422) {
        throw retryErr;
      }
      lastErrorMsg = `${retryTarget.label}: ${retryErr?.message || lastErrorMsg}`;
    }
  }

  if (triedLabels.length === 0) {
    throw new AppApiError(
      "Barcha bepul AI modellarning kunlik limiti vaqtincha tugagan (15 daqiqada qayta tekshiriladi). Ungacha 'MRZ Matn (Offline)' rejimidan foydalaning yoki qo'shimcha kalit qo'shing.",
      429
    );
  }

  const summary = summarizeProviderErrors(failureSamples) || lastErrorMsg;

  if (sawOnlyAuthErrors) {
    throw new AppApiError(
      `AI API kaliti noto'g'ri yoki ruxsat yo'q. Server Environment kalitlarini tekshiring. (${summary})`,
      403
    );
  }

  throw new AppApiError(
    `AI limit yoki tarmoq xatosi (${triedLabels.length} ta urinish): ${summary}`,
    502
  );
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
    const archiveName = 'Grand_Turan_AI_v2.6_MultiVision.zip';
    const prebuiltZip = path.resolve(__dirname, 'public', archiveName);
    if (fs.existsSync(prebuiltZip)) {
      const stat = fs.statSync(prebuiltZip);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);
      res.sendFile(prebuiltZip);
      return;
    }

    const zip = new JSZip();
    const innerFolder = zip.folder('Grand-Turan-AI-v2.6') || zip;
    await addDirectoryToZip(innerFolder, path.resolve(__dirname), path.resolve(__dirname));
    const zipContent = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      platform: 'DOS',
    });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', zipContent.length);
    res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);
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
    const callbackQuery = update?.callback_query;
    const message = update?.message || update?.edited_message || callbackQuery?.message;
    if (!message) {
      res.json({ ok: true });
      return;
    }

    const chatId = message.chat.id;
    const text = callbackQuery ? String(callbackQuery.data || '') : (message.text ? message.text.trim() : '');
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

    const sendTelegramDocument = async (buffer: Buffer, filename: string, caption: string) => {
      if (!botToken) return;
      try {
        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append('caption', caption);
        form.append('parse_mode', 'HTML');
        form.append('document', new Blob([new Uint8Array(buffer)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }), filename);
        await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
          method: 'POST',
          body: form,
        });
      } catch (err) {
        console.error('Failed to send Telegram document:', err);
      }
    };

    if (callbackQuery && botToken) {
      fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQuery.id }),
      }).catch(() => {});
    }

    // Command handling
    if (text.startsWith('/start')) {
      const welcome = `⚜️ <b>Grand Turan — AI Pasport & Updater Bot</b>\n\n` +
        `Assalomu alaykum! Tizimga xush kelibsiz.\n` +
        `👨‍💻 <b>Dasturchi:</b> Muhammad Amin\n\n` +
        `📸 Pasport rasmlarini yuboring (1 tadan 100 tagacha) yoki 2 qatorli MRZ matnini yozing:\n` +
        `• /mrz — MRZ matn yozish qoidalari va misol\n` +
        `• /flykhiva — FlyKhiva Zayafka (.xlsx) olish\n` +
        `• /prestige — Zayafka Prestige (.xlsx) olish\n` +
        `• /clear — navbatni tozalash\n\n` +
        `🏷 <b>Yosh va jins qoidasi:</b> &lt;2 yosh = INF | 2–11 yosh = CHD | 12+ erkak = MR | 12+ ayol = MRS\n\n` +
        `⚙️ Server & Updater buyruqlari:\n` +
        `• /status — Render server, AI va Baza holati\n` +
        `• /redeploy — Render serverni qayta yangilash`;

      const webAppUrl = resolvePublicAppUrl(req);
      await sendTelegramReply(welcome, {
        inline_keyboard: [
          [
            { text: '✈️ FlyKhiva Rejimi', callback_data: 'mode_flykhiva' },
            { text: '🏛 Prestige Rejimi', callback_data: 'mode_prestige' },
          ],
          [{ text: '📝 MRZ Matn Qoidalari (/mrz)', callback_data: 'show_mrz_rules' }],
          [{ text: '🌐 Saytni Bot Ichida Ochish (Web App)', web_app: { url: webAppUrl } }],
        ],
      });
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/mrz') || text === 'show_mrz_rules') {
      const mrzGuide =
        `📝 <b>MRZ Matn Yozish Qoidalari (API kalitsiz 100% bepul):</b>\n\n` +
        `1️⃣ <b>1-qator (F.I.O):</b> <code>P&lt;UZBFAMILIYA&lt;&lt;ISM&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>\n` +
        `   <i>(Faqat Familiya va bitta Ism — otasining ismi yozilmaydi)</i>\n` +
        `2️⃣ <b>2-qator (Pasport va sana):</b>\n` +
        `   <code>SERIYA(2)RAQAM(7)[Check]UZB[YYMMDD Tug'ilgan][Check][M/F][YYMMDD Muddat][Check]</code>\n` +
        `3️⃣ <b>Yosh va Jins (Avtomatik):</b>\n` +
        `   • 2 yoshdan kichik → <b>INF</b>\n` +
        `   • 2 yoshga to'lgan – 11 yosh → <b>CHD</b>\n` +
        `   • 12 yoshga to'lgan va katta: Erkak → <b>MR</b>, Ayol → <b>MRS</b>\n\n` +
        `📋 <b>Tayyor namuna (nusxa olib yuboring):</b>\n` +
        `<pre>P&lt;UZBKARIMOV&lt;&lt;SARDOR&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;\nFA12345678UZB9005142M3301095&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;02</pre>`;
      await sendTelegramReply(mrzGuide);
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/skip')) {
      session.useApi = false;
      await sendTelegramReply(`ℹ️ <b>MRZ matn rejimi yoqildi!</b>\nPasport ostidagi 2 qatorli MRZ matnini (P&lt;UZB...) yuboring yoki qoidani ko'rish uchun /mrz bosing.`);
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/flykhiva') || text === 'mode_flykhiva' || text === 'get_flykhiva') {
      session.template = 'flykhiva';
      if (session.passports.length > 0) {
        const wb = await generateFlyKhivaWorkbook(session.passports);
        const buf = await workbookToBuffer(wb);
        await sendTelegramDocument(
          buf,
          `Spisok_Na_Aviabileti_${Date.now()}.xlsx`,
          `✈️ <b>FlyKhiva Zayavka tayyor!</b>\nJami: ${session.passports.length} ta yo'lovchi`
        );
      } else {
        await sendTelegramReply(`✈️ <b>FlyKhiva rejimi tanlandi!</b>\nIltimos, pasport rasmlarini yuboring.`);
      }
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/prestige') || text === 'mode_prestige' || text === 'get_prestige') {
      session.template = 'prestige';
      if (session.passports.length > 0) {
        const wb = await generatePrestigeWorkbook(session.passports);
        const buf = await workbookToBuffer(wb);
        await sendTelegramDocument(
          buf,
          `Prestige_TAS_SHARM_${Date.now()}.xlsx`,
          `🏛 <b>Prestige Zayavka tayyor!</b>\nJami: ${session.passports.length} ta pasport`
        );
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
      const activeList = getActiveEngineLabels().join(', ');
      const msg = `⚙️ <b>Server & Updater Holati:</b>\n\n` +
        `🟢 <b>Server:</b> Faol (Uptime: ${uptimeSec} soniya)\n` +
        `🧠 <b>AI Dvigatellari:</b> ${activeList}\n` +
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
    const normalizedUpper = text.toUpperCase();
    const looksLikeMrz =
      normalizedUpper.includes('P<') ||
      normalizedUpper.split(/\r?\n/).filter((l: string) => l.trim().length >= 30).length >= 2;

    if (looksLikeMrz) {
      const mrzRecord = parseMrzLines(text);
      if (mrzRecord) {
        session.passports.push(mrzRecord);
        scannedPassports.push(mrzRecord);
        const reply = `✅ <b>MRZ qabul qilindi (#${session.passports.length}):</b>\n` +
          `👤 <b>F.I.O:</b> ${mrzRecord.surname} ${mrzRecord.givenNames}\n` +
          `🏷 <b>Turi/Jinsi:</b> ${mrzRecord.title} (${mrzRecord.gender})\n` +
          `📄 <b>Pasport №:</b> ${mrzRecord.series}${mrzRecord.number}\n` +
          `📅 <b>Tug'ilgan:</b> ${mrzRecord.birthDate || '-'}\n` +
          `⏳ <b>Amal qilish:</b> ${mrzRecord.expiryDate || '-'}\n` +
          `⚡️ <b>Dvigatel:</b> offline-mrz`;
        await sendTelegramReply(reply, {
          inline_keyboard: [
            [
              { text: '📥 FlyKhiva Excel olish', callback_data: 'get_flykhiva' },
              { text: '📥 Prestige Excel olish', callback_data: 'get_prestige' },
            ],
          ],
        });
      } else {
        await sendTelegramReply(`⚠️ MRZ matnidan ma'lumot ajratib bo'lmadi. Qoida va misol uchun /mrz bosing.`);
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
          `🏷 <b>Turi/Jinsi:</b> ${parsedRecord.title} (${parsedRecord.gender})\n` +
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
  const ext = getExternalProviderKeys();
  const hasAnyAi = Boolean(
    getEffectiveGeminiKey() ||
      ext.groq.length > 0 ||
      ext.openrouter.length > 0 ||
      ext.sambanova.length > 0 ||
      ext.mistral.length > 0
  );

  res.json({
    totalScanned: scannedPassports.length,
    totalBatches: batchCount,
    prestigeCount: prestigeExports,
    flykhivaCount: flykhivaExports,
    uptimeSeconds: uptimeSec,
    nodeVersion: process.version,
    memoryUsageMb: memMb,
    aiEngineStatus: hasAnyAi ? 'active' : 'missing_key',
    activeEngines: getActiveEngineLabels(),
    telegramWebhookConfigured: Boolean(botToken),
    telegramBotUsername: '@grandturanai_bot',
    renderDeployHookConfigured: Boolean(deployHookUrl),
    githubRepo: 'maxpubg2080-ctrl/Grand-Turan-AI---v2.4-Release',
  });
});

app.post('/api/admin/settings', async (req: Request, res: Response) => {
  const { pin, newBotToken, newDeployHookUrl, registerWebhook } = req.body;
  if (pin !== '1111' && pin !== '7777') {
    res.status(403).json({ error: "PIN kod noto'g'ri (1111 yoki 7777 talab qilinadi)" });
    return;
  }
  if (typeof newBotToken === 'string' && newBotToken.trim()) {
    botToken = newBotToken.trim();
  }
  if (typeof newDeployHookUrl === 'string' && newDeployHookUrl.trim()) {
    deployHookUrl = newDeployHookUrl.trim();
  }

  let webhookMessage = 'Sozlamalar saqlandi';
  let webhookOk = true;

  if (registerWebhook && botToken) {
    const host = req.get('host') || '';
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const webhookUrl = `${proto}://${host}/api/telegram/webhook`;
    const webAppUrl = resolvePublicAppUrl(req);
    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      const tgData = await tgRes.json();
      if (tgData.ok) {
        // Also configure bottom-left "Open" Web App menu button inside Telegram bot chat
        await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_button: {
              type: 'web_app',
              text: 'Open',
              web_app: { url: webAppUrl },
            },
          }),
        }).catch(() => {});
        webhookMessage = `Telegram Webhook va "Open" Web App tugmasi ulandi: ${webhookUrl}`;
      } else {
        webhookOk = false;
        webhookMessage = `Telegram xatosi: ${tgData.description || "Token noto'g'ri"}`;
      }
    } catch (err: any) {
      webhookOk = false;
      webhookMessage = `Telegram ulanish xatosi: ${err.message}`;
    }
  }

  res.json({
    success: webhookOk,
    message: webhookMessage,
    telegramConfigured: Boolean(botToken),
    renderConfigured: Boolean(deployHookUrl),
  });
});

app.post('/api/admin/deploy', async (req: Request, res: Response) => {
  const { pin, deployHookUrl: suppliedHookUrl } = req.body;
  if (pin !== '1111' && pin !== '7777') {
    res.status(403).json({ error: "PIN kod noto'g'ri (1111 yoki 7777 talab qilinadi)" });
    return;
  }
  if (typeof suppliedHookUrl === 'string' && suppliedHookUrl.trim()) {
    deployHookUrl = suppliedHookUrl.trim();
  }
  if (!deployHookUrl) {
    res.status(400).json({ error: 'Render Deploy Hook URL sozlanmagan' });
    return;
  }

  try {
    const hookRes = await fetch(deployHookUrl, { method: 'POST' });
    if (!hookRes.ok) {
      const errText = await hookRes.text();
      res.status(hookRes.status).json({ error: `Render javobi (${hookRes.status}): ${errText || "Hook URL noto'g'ri"}` });
      return;
    }
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
