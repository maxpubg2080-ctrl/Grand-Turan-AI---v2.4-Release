export interface PassportRecord {
  id: string;
  sourceFileName?: string;
  surname: string;          // A: Familiya
  givenNames: string;       // B: Ism
  patronymic?: string;      // Otasining ismi (if available)
  surnameLat: string;       // D: Familiya (lat.)
  givenNamesLat: string;    // E: Ism (lat.)
  birthDate: string;        // G: Tugʻ. sana (e.g. "1990-yil 14-may" or "14.05.1990")
  title: 'MR' | 'MRS' | 'CHD'; // H: MR/MRS/CHD
  series: string;           // I: Seria (e.g. "FA", "AA")
  number: string;           // J: № (e.g. "1234567")
  issueDate: string;        // K: Berilgan (e.g. "10.01.2023")
  expiryDate: string;       // L: Muddati (e.g. "09.01.2033")
  nationality: string;      // N: Fuqarolik (e.g. "O'zbekiston" or "UZB")
  gender: 'M' | 'F';        // O: Jins ("M" or "F")
  country: string;          // R: Davlat (e.g. "O'zbekiston")
  rawMrz?: string;
  confidence?: number;
  engineUsed?: 'gemini-3.8-flash' | 'offline-mrz';
  parsedAt: string;
}

export interface FlightDetails {
  flightDate: string;     // e.g. "07.11.2026"
  flightNumber: string;   // e.g. "2U 5508"
  departureTime: string;  // e.g. "23:50"
  route: string;          // e.g. "SSH-TAS"
}

export type ExcelTemplateType = 'prestige' | 'flykhiva';
export type AppTheme = 'qunduzgi' | 'tungi' | 'fazo';
export type AppLang = 'uz' | 'ru' | 'en';

export interface TelegramChatBubble {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  fileAttachment?: {
    name: string;
    type: 'xlsx' | 'zip';
    size: string;
    downloadUrl: string;
    recordsCount: number;
  };
  passportPreview?: PassportRecord;
}

export interface AdminSystemStats {
  totalScanned: number;
  totalBatches: number;
  prestigeCount: number;
  flykhivaCount: number;
  uptimeSeconds: number;
  nodeVersion: string;
  memoryUsageMb: number;
  aiEngineStatus: 'active' | 'degraded' | 'offline';
  telegramWebhookConfigured: boolean;
  telegramBotUsername: string;
  renderDeployHookConfigured: boolean;
  githubRepo: string;
}
