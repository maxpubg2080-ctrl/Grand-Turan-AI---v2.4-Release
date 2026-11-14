import React, { useState, useRef, useEffect } from 'react';
import { PassportRecord, TelegramChatBubble, AppLang } from '../types/passport';
import { getTranslation } from '../utils/i18n';
import {
  Send,
  Bot,
  User,
  FileSpreadsheet,
  Archive,
  Download,
  Trash2,
  CheckCircle,
  Sparkles,
  Plane,
  Building2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { downloadProjectSourceZip } from '../utils/downloadProject';

interface TelegramChatStreamProps {
  lang: AppLang;
  passports: PassportRecord[];
  onExportExcel: (template: 'prestige' | 'flykhiva') => void;
  onExportZip: () => void;
  onClear: () => void;
}

export const TelegramChatStream: React.FC<TelegramChatStreamProps> = ({
  lang,
  passports,
  onExportExcel,
  onExportZip,
  onClear,
}) => {
  const t = getTranslation(lang);
  const [inputVal, setInputVal] = useState('');
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const announcedIdsRef = useRef<Set<string>>(new Set(passports.map((p) => p.id)));

  const [messages, setMessages] = useState<TelegramChatBubble[]>([
    {
      id: 'm1',
      sender: 'bot',
      text:
        `⚜️ <b>Grand Turan — AI Pasport & Updater Bot</b> (@grandturanai_bot)\n\n` +
        `Assalomu alaykum! Tizimga xush kelibsiz.\n` +
        `👨💻 <b>Dasturchi:</b> Muhammad Amin\n\n` +
        `📸 Pasport rasmlarini yuboring (1 tadan 100 tagacha), so'ng:\n` +
        `• <b>/flykhiva</b> — FlyKhiva Zayafka (.xlsx) olish\n` +
        `• <b>/prestige</b> — Zayafka Prestige (.xlsx) olish\n` +
        `• <b>/clear</b> — navbatni tozalash\n\n` +
        `⚙️ Server & Updater buyruqlari:\n` +
        `• <b>/status</b> — Render server, AI va Baza holati\n` +
        `• <b>/redeploy</b> — Render serverni qayta yangilash`,
      time: '12:00',
    },
  ]);

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // When passports change, announce all newly added passports to chat stream
  useEffect(() => {
    if (passports.length === 0) {
      announcedIdsRef.current.clear();
      return;
    }

    const newlyAdded = passports.filter((p) => !announcedIdsRef.current.has(p.id));
    if (newlyAdded.length === 0) return;

    const newBubbles: TelegramChatBubble[] = newlyAdded.map((p, idx) => {
      announcedIdsRef.current.add(p.id);
      const indexInList = passports.findIndex((item) => item.id === p.id) + 1;
      return {
        id: `bot_pass_${p.id}_${idx}`,
        sender: 'bot',
        text:
          `✅ <b>Pasport qabul qilindi (#${indexInList}):</b>\n` +
          `👤 <b>F.I.O:</b> ${p.surname} ${p.givenNames}\n` +
          `📄 <b>Pasport №:</b> ${p.series}${p.number}\n` +
          `📅 <b>Tug'ilgan:</b> ${p.birthDate || '-'}\n` +
          `⏳ <b>Amal qilish:</b> ${p.expiryDate || '-'}\n` +
          `⚡️ <b>Dvigatel:</b> ${p.engineUsed || 'gemini-4-hydrogen'}\n\n` +
          `<i>Faylni olish uchun quyidagi tugmalarni bosing:</i>`,
        time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
        passportPreview: p,
      };
    });

    setMessages((prev) => [...prev, ...newBubbles]);
  }, [passports]);

  const handleCommand = (cmd: string) => {
    const time = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
    const userMsg: TelegramChatBubble = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: cmd,
      time,
    };

    let botResponse: TelegramChatBubble;

    if (cmd === '/start') {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text:
          `⚜️ <b>Grand Turan AI Bot qayta ishga tushirildi!</b>\n` +
          `Iltimos, pasport rasmlarini yuboring yoki /skip bosing.`,
        time,
      };
    } else if (cmd === '/skip') {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text:
          `⚡️ <b>Apisiz rejim tanlandi!</b>\n` +
          `Endi pasportlar lokal MRZ algoritmi orqali API kalitsiz tahlil qilinadi. Rasmlarni yuklang!`,
        time,
      };
    } else if (cmd === '/flykhiva') {
      if (passports.length === 0) {
        botResponse = {
          id: `b_${Date.now()}`,
          sender: 'bot',
          text: `⚠️ <b>Hozircha pasportlar yuklanmagan!</b>\nAvval rasmlarni yuboring, so'ng /flykhiva bosing.`,
          time,
        };
      } else {
        onExportExcel('flykhiva');
        botResponse = {
          id: `b_${Date.now()}`,
          sender: 'bot',
          text: `✈️ <b>FlyKhiva Zayavka (.xlsx) muvaffaqiyatli tayyorlandi!</b>\nFaylni quyidagi ilova orqali yuklab olishingiz mumkin.`,
          time,
          fileAttachment: {
            name: `FlyKhiva_Zayavka_${passports.length}_passengers.xlsx`,
            type: 'xlsx',
            size: `${(passports.length * 4.2 + 15).toFixed(1)} KB`,
            downloadUrl: '#',
            recordsCount: passports.length,
          },
        };
        try {
          confetti({ particleCount: 40, spread: 60 });
        } catch {}
      }
    } else if (cmd === '/prestige') {
      if (passports.length === 0) {
        botResponse = {
          id: `b_${Date.now()}`,
          sender: 'bot',
          text: `⚠️ <b>Hozircha pasportlar yuklanmagan!</b>\nAvval rasmlarni yuboring, so'ng /prestige bosing.`,
          time,
        };
      } else {
        onExportExcel('prestige');
        botResponse = {
          id: `b_${Date.now()}`,
          sender: 'bot',
          text: `🏛 <b>Prestige Zayavka (.xlsx) muvaffaqiyatli tayyorlandi!</b>\n2-qatordan boshlab barcha ustunlar (A..R) aniq tartibda shakllantirildi.`,
          time,
          fileAttachment: {
            name: `Prestige_Zayavka_${passports.length}_records.xlsx`,
            type: 'xlsx',
            size: `${(passports.length * 4.8 + 18).toFixed(1)} KB`,
            downloadUrl: '#',
            recordsCount: passports.length,
          },
        };
        try {
          confetti({ particleCount: 40, spread: 60 });
        } catch {}
      }
    } else if (cmd === '/clear') {
      onClear();
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text: `🧹 <b>Navbat tozalandi!</b> Yangi pasportlarni yuklashingiz mumkin.`,
        time,
      };
    } else if (cmd === '/status') {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text:
          `⚙️ <b>Grand Turan AI Server Holati:</b>\n\n` +
          `🟢 <b>Server:</b> Onlayn (Vite + Express)\n` +
          `🧠 <b>AI Model:</b> gemini-4-hydrogen + Deterministic MRZ\n` +
          `📋 <b>Hozirgi navbat:</b> ${passports.length} ta pasport\n` +
          `👨💻 <b>Dasturchi:</b> Muhammad Amin\n` +
          `🤖 <b>Telegram:</b> @grandturanai_bot webhook tayyor`,
        time,
      };
    } else if (cmd === '/redeploy') {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text: `🚀 <b>Redeploy so'rovi yuborildi!</b> Render Deploy Hook tekshirilmoqda.`,
        time,
      };
    } else if (cmd === '/zip') {
      onExportZip();
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text: `📦 <b>Barcha zayavkalar ZIP arxivi tayyorlandi!</b>\nPrestige + FlyKhiva + Manifest JSON bitta to'plamda.`,
        time,
        fileAttachment: {
          name: `Grand_Turan_Zayavka_Pack.zip`,
          type: 'zip',
          size: `${(passports.length * 8 + 32).toFixed(1)} KB`,
          downloadUrl: '#',
          recordsCount: passports.length,
        },
      };
    } else if (cmd === '/project') {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text:
          `📦 <b>Grand Turan AI — To'liq Loyiha KODI (.zip)!</b>\n\n` +
          `Loyiha GitHub-ga joylash va Render serverga yuklash uchun 100% tayyor.\n` +
          `• <b>Dockerfile:</b> konteynerlashtirish tayyor\n` +
          `• <b>render.yaml:</b> Render 1-bosishda deploy\n` +
          `• <b>README_DEPLOY.md:</b> to'liq o'zbekcha qo'llanma\n\n` +
          `Quyidagi tugma orqali to'liq arxivni yuklab oling:`,
        time,
        fileAttachment: {
          name: `Grand_Turan_AI_Full_Project_Source.zip`,
          type: 'zip',
          size: `185 KB`,
          downloadUrl: '/api/project-zip',
          recordsCount: passports.length,
        },
      };
    } else {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text:
          `Qabul qilindi: "<i>${cmd}</i>"\n` +
          `Mavjud buyruqlar: /flykhiva, /prestige, /zip, /project, /clear, /status, /redeploy`,
        time,
      };
    }

    setMessages((prev) => [...prev, userMsg, botResponse]);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const text = inputVal.trim();
    setInputVal('');
    handleCommand(text);
  };

  return (
    <div className="w-full rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/5 overflow-hidden flex flex-col h-[580px]">
      {/* Bot Chat Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-lg shadow-inner">
            ⚜️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight">
                Grand Turan AI Bot
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                @grandturanai_bot
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              bot • Pasport tahlili va Excel generatori
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            Webhook Faol
          </span>
        </div>
      </div>

      {/* Quick Command Action Ribbon */}
      <div className="px-3 py-2 bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
        <button
          onClick={() => handleCommand('/start')}
          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:text-amber-600 shadow-xs whitespace-nowrap transition-colors"
        >
          /start
        </button>
        <button
          onClick={() => handleCommand('/skip')}
          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:text-amber-600 shadow-xs whitespace-nowrap transition-colors"
        >
          /skip (Apisiz)
        </button>
        <button
          onClick={() => handleCommand('/flykhiva')}
          className="px-2.5 py-1 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 shadow-xs whitespace-nowrap transition-colors flex items-center gap-1"
        >
          <Plane className="w-3 h-3" />
          /flykhiva
        </button>
        <button
          onClick={() => handleCommand('/prestige')}
          className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-xs whitespace-nowrap transition-colors flex items-center gap-1"
        >
          <Building2 className="w-3 h-3" />
          /prestige
        </button>
        <button
          onClick={() => handleCommand('/zip')}
          className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 shadow-xs whitespace-nowrap transition-colors flex items-center gap-1"
        >
          <Archive className="w-3 h-3" />
          /zip
        </button>
        <button
          onClick={() => handleCommand('/project')}
          className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 shadow-xs whitespace-nowrap transition-colors flex items-center gap-1"
        >
          <Download className="w-3 h-3" />
          /project
        </button>
        <button
          onClick={() => handleCommand('/status')}
          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:text-amber-600 shadow-xs whitespace-nowrap transition-colors"
        >
          /status
        </button>
        <button
          onClick={() => handleCommand('/clear')}
          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 shadow-xs whitespace-nowrap transition-colors"
        >
          /clear
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 dark:bg-slate-950/60">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${
              m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                m.sender === 'user'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-800 text-amber-400 border border-amber-500/30'
              }`}
            >
              {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble Content */}
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm text-xs sm:text-sm leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-amber-500 text-white rounded-tr-xs'
                  : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-xs'
              }`}
            >
              <div
                className="whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: m.text }}
              />

              {/* Passport preview card inside chat */}
              {m.passportPreview && (
                <div className="mt-2.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center justify-between font-mono font-bold text-amber-600 dark:text-amber-400">
                    <span>{m.passportPreview.series} {m.passportPreview.number}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                      {m.passportPreview.title}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                    {m.passportPreview.surname} {m.passportPreview.givenNames}
                  </div>
                </div>
              )}

              {/* File Attachment Bubble inside chat (User requested: "fayl bo'lib tushadi", "shuchat deb maschat da bo'lsin yuklashni") */}
              {m.fileAttachment && (
                <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white border border-indigo-500/30 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                      {m.fileAttachment.type === 'xlsx' ? (
                        <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <Archive className="w-6 h-6 text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {m.fileAttachment.name}
                      </p>
                      <p className="text-[10px] text-slate-300">
                        {m.fileAttachment.size} • {m.fileAttachment.recordsCount} ta yoʻlovchi
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400 font-medium">
                      ✓ Yuklab olishga tayyor
                    </span>
                    <button
                      onClick={() => {
                        if (
                          m.fileAttachment?.downloadUrl === '/api/project-zip' ||
                          m.fileAttachment?.name?.toLowerCase().includes('project_source')
                        ) {
                          downloadProjectSourceZip();
                        } else if (m.fileAttachment?.type === 'zip') {
                          onExportZip();
                        } else if (m.fileAttachment?.name.includes('FlyKhiva')) {
                          onExportExcel('flykhiva');
                        } else {
                          onExportExcel('prestige');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-transform active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Yuklab olish
                    </button>
                  </div>
                </div>
              )}

              <div
                className={`text-[10px] text-right mt-1 font-mono ${
                  m.sender === 'user' ? 'text-amber-100' : 'text-slate-400'
                }`}
              >
                {m.time}
              </div>
            </div>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={t.chatSendPrompt}
          className="flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          className="p-2 sm:px-4 sm:py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Yuborish</span>
        </button>
      </form>
    </div>
  );
};
