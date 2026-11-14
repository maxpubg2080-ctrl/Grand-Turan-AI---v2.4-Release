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
  Plane,
  Building2,
  FileText,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { downloadProjectSourceZip } from '../utils/downloadProject';
import { parseMrzLines, resolvePassengerTitle } from '../utils/mrzParser';

interface TelegramChatStreamProps {
  lang: AppLang;
  passports: PassportRecord[];
  onAddPassports?: (records: PassportRecord[]) => void;
  onExportExcel: (template: 'prestige' | 'flykhiva') => void;
  onExportZip: () => void;
  onClear: () => void;
}

interface ExtendedChatBubble extends TelegramChatBubble {
  mrzExampleText?: string;
}

const MRZ_SAMPLE_EXAMPLE =
  'P<UZBKARIMOV<<SARDOR<<<<<<<<<<<<<<<<<<<<<<<<\nFA12345678UZB9005142M3301095<<<<<<<<<<<<<<02';

export const TelegramChatStream: React.FC<TelegramChatStreamProps> = ({
  lang,
  passports,
  onAddPassports,
  onExportExcel,
  onExportZip,
  onClear,
}) => {
  const t = getTranslation(lang);
  const [inputVal, setInputVal] = useState('');
  const [copiedExample, setCopiedExample] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const announcedIdsRef = useRef<Set<string>>(new Set(passports.map((p) => p.id)));

  const [messages, setMessages] = useState<ExtendedChatBubble[]>([
    {
      id: 'm1',
      sender: 'bot',
      text:
        `⚜️ <b>Grand Turan — AI Pasport & Updater Bot</b> (@grandturanai_bot)\n\n` +
        `Assalomu alaykum! Tizimga xush kelibsiz.\n` +
        `👨‍💻 <b>Dasturchi:</b> Muhammad Amin\n\n` +
        `📸 Pasport rasmlarini yuboring (1 tadan 100 tagacha) yoki 2 qatorli MRZ matn kiriting:\n` +
        `• <b>/mrz</b> — MRZ matn yozish qoidalari va misol\n` +
        `• <b>/flykhiva</b> — FlyKhiva Zayafka (.xlsx) olish\n` +
        `• <b>/prestige</b> — Zayafka Prestige (.xlsx) olish\n` +
        `• <b>/clear</b> — navbatni tozalash\n\n` +
        `🏷 <b>Yosh va jins qoidasi:</b> &lt;2 yosh = INF | 2–11 yosh = CHD | 12+ erkak = MR | 12+ ayol = MRS\n\n` +
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

    const newBubbles: ExtendedChatBubble[] = newlyAdded.map((p, idx) => {
      announcedIdsRef.current.add(p.id);
      const indexInList = passports.findIndex((item) => item.id === p.id) + 1;
      const effectiveTitle = p.birthDate ? resolvePassengerTitle(p.birthDate, p.gender) : p.title;
      return {
        id: `bot_pass_${p.id}_${idx}`,
        sender: 'bot',
        text:
          `✅ <b>Pasport qabul qilindi (#${indexInList}):</b>\n` +
          `👤 <b>F.I.O:</b> ${p.surname} ${p.givenNames}\n` +
          `🏷 <b>Turi/Jinsi:</b> ${effectiveTitle} (${p.gender})\n` +
          `📄 <b>Pasport №:</b> ${p.series}${p.number}\n` +
          `📅 <b>Tug'ilgan:</b> ${p.birthDate || '-'}\n` +
          `⏳ <b>Amal qilish:</b> ${p.expiryDate || '-'}\n` +
          `⚡️ <b>Dvigatel:</b> ${p.engineUsed || 'gemini-4-hydrogen'}\n\n` +
          `<i>Faylni olish uchun yuqoridagi /flykhiva yoki /prestige tugmalarini bosing:</i>`,
        time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
        passportPreview: { ...p, title: effectiveTitle },
      };
    });

    setMessages((prev) => [...prev, ...newBubbles]);
  }, [passports]);

  const handleCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim();
    const lowerCmd = trimmedCmd.toLowerCase();
    const time = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ExtendedChatBubble = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: trimmedCmd,
      time,
    };

    // Detect pasted 2-line MRZ code directly in chat
    const upperCmd = trimmedCmd.toUpperCase();
    const looksLikeMrz =
      !trimmedCmd.startsWith('/') &&
      (upperCmd.includes('P<') ||
        upperCmd.split(/\r?\n/).filter((l) => l.trim().length >= 30).length >= 2);

    if (looksLikeMrz) {
      const parsed = parseMrzLines(trimmedCmd);
      if (parsed) {
        if (onAddPassports) {
          setMessages((prev) => [...prev, userMsg]);
          onAddPassports([parsed]);
          try {
            confetti({ particleCount: 30, spread: 50, origin: { y: 0.75 } });
          } catch {}
          return;
        }
        const effectiveTitle = parsed.birthDate
          ? resolvePassengerTitle(parsed.birthDate, parsed.gender)
          : parsed.title;
        const botParsed: ExtendedChatBubble = {
          id: `b_${Date.now()}`,
          sender: 'bot',
          text:
            `✅ <b>MRZ matndan pasport o'qildi:</b>\n` +
            `👤 <b>F.I.O:</b> ${parsed.surname} ${parsed.givenNames}\n` +
            `🏷 <b>Turi/Jinsi:</b> ${effectiveTitle} (${parsed.gender})\n` +
            `📄 <b>Pasport №:</b> ${parsed.series}${parsed.number}\n` +
            `📅 <b>Tug'ilgan:</b> ${parsed.birthDate || '-'}\n` +
            `⚡️ <b>Dvigatel:</b> offline-mrz`,
          time,
          passportPreview: { ...parsed, title: effectiveTitle },
        };
        setMessages((prev) => [...prev, userMsg, botParsed]);
        return;
      }

      const botErr: ExtendedChatBubble = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text:
          `⚠️ <b>MRZ matnidan ma'lumot ajratib bo'lmadi.</b>\n` +
          `2 qatorni ham to'liq yozing (1-qator <code>P&lt;UZBFAMILIYA&lt;&lt;ISM...</code>, 2-qator pasport seriyasi/raqami va sanalar). Qoida va misol uchun <b>/mrz</b> bosing.`,
        time,
      };
      setMessages((prev) => [...prev, userMsg, botErr]);
      return;
    }

    let botResponse: ExtendedChatBubble;

    if (lowerCmd === '/start') {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text:
          `⚜️ <b>Grand Turan AI Bot qayta ishga tushirildi!</b>\n` +
          `Pasport rasmlarini yuklang, 2 qatorli MRZ matn yuboring yoki qoidalarni ko'rish uchun <b>/mrz</b> bosing.\n` +
          `🏷 <b>Qoida:</b> &lt;2 yosh = INF | 2–11 = CHD | 12+ erkak = MR | 12+ ayol = MRS`,
        time,
      };
    } else if (lowerCmd === '/mrz') {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text:
          `📝 <b>MRZ Matn Yozish Qoidalari (API kalitsiz 100% bepul):</b>\n\n` +
          `1️⃣ <b>1-qator (F.I.O):</b> <code>P&lt;UZBFAMILIYA&lt;&lt;ISM&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>\n` +
          `   <i>(Faqat Familiya va bitta Ism — otasining ismi yozilmaydi)</i>\n` +
          `2️⃣ <b>2-qator (Pasport va sana):</b>\n` +
          `   <code>SERIYA(2)RAQAM(7)[Check]UZB[YYMMDD Tug'ilgan][Check][M/F][YYMMDD Muddat][Check]</code>\n` +
          `3️⃣ <b>Yosh va Jins qoidasi:</b>\n` +
          `   • 2 yoshdan kichik → <b>INF</b>\n` +
          `   • 2 yoshga to'lgan – 11 yosh → <b>CHD</b>\n` +
          `   • 12 yoshga to'lgan va katta: Erkak → <b>MR</b>, Ayol → <b>MRS</b>`,
        time,
        mrzExampleText: MRZ_SAMPLE_EXAMPLE,
      };
    } else if (lowerCmd === '/skip') {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text:
          `⚡️ <b>Apisiz (MRZ) rejim tanlandi!</b>\n` +
          `Endi shu chatga to'g'ridan-to'g'ri 2 qatorli MRZ matn yozib yuborishingiz mumkin. Qoidalar va tayyor namuna uchun <b>/mrz</b> bosing.`,
        time,
      };
    } else if (lowerCmd === '/flykhiva') {
      if (passports.length === 0) {
        botResponse = {
          id: `b_${Date.now()}`,
          sender: 'bot',
          text: `⚠️ <b>Hozircha pasportlar yuklanmagan!</b>\nAvval rasmlarni yuboring yoki MRZ matn kiriting, so'ng /flykhiva bosing.`,
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
    } else if (lowerCmd === '/prestige') {
      if (passports.length === 0) {
        botResponse = {
          id: `b_${Date.now()}`,
          sender: 'bot',
          text: `⚠️ <b>Hozircha pasportlar yuklanmagan!</b>\nAvval rasmlarni yuboring yoki MRZ matn kiriting, so'ng /prestige bosing.`,
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
    } else if (lowerCmd === '/clear') {
      onClear();
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text: `🧹 <b>Navbat tozalandi!</b> Yangi pasportlarni yuklashingiz mumkin.`,
        time,
      };
    } else if (lowerCmd === '/status') {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text:
          `⚙️ <b>Grand Turan AI Server Holati:</b>\n\n` +
          `🟢 <b>Server:</b> Onlayn (Vite + Express)\n` +
          `🧠 <b>AI Kaskad:</b> Gemini (4 model) + Groq + OpenRouter + Mistral + Offline MRZ\n` +
          `📋 <b>Hozirgi navbat:</b> ${passports.length} ta pasport\n` +
          `👨‍💻 <b>Dasturchi:</b> Muhammad Amin\n` +
          `🤖 <b>Telegram:</b> @grandturanai_bot webhook tayyor`,
        time,
      };
    } else if (lowerCmd === '/redeploy') {
      botResponse = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text: `🚀 <b>Redeploy so'rovi yuborildi!</b> Render Deploy Hook tekshirilmoqda.`,
        time,
      };
    } else if (lowerCmd === '/zip') {
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
    } else if (lowerCmd === '/project') {
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
          `Qabul qilindi: "<i>${trimmedCmd}</i>"\n` +
          `Mavjud buyruqlar: <b>/mrz</b>, /flykhiva, /prestige, /zip, /project, /clear, /status, /redeploy\n` +
          `Yoki to'g'ridan-to'g'ri 2 qatorli MRZ matn yuboring.`,
        time,
      };
    }

    setMessages((prev) => [...prev, userMsg, botResponse]);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;
    const text = inputVal.trim();
    setInputVal('');
    handleCommand(text);
  };

  return (
    <div className="w-full rounded-2xl bg-white/95 dark:bg-slate-900/80 dark:backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/60 shadow-xl shadow-slate-900/5 dark:shadow-black/30 overflow-hidden flex flex-col h-[590px]">
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
              bot • Pasport tahlili, MRZ va Excel generatori
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
      <div className="px-3 py-2 bg-slate-100/90 dark:bg-slate-800/75 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
        <button
          type="button"
          onClick={() => handleCommand('/start')}
          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:text-amber-600 shadow-xs whitespace-nowrap transition-colors cursor-pointer"
        >
          /start
        </button>
        <button
          type="button"
          onClick={() => handleCommand('/mrz')}
          className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
        >
          <FileText className="w-3 h-3" />
          /mrz (Qoida)
        </button>
        <button
          type="button"
          onClick={() => handleCommand('/skip')}
          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:text-amber-600 shadow-xs whitespace-nowrap transition-colors cursor-pointer"
        >
          /skip (Apisiz)
        </button>
        <button
          type="button"
          onClick={() => handleCommand('/flykhiva')}
          className="px-2.5 py-1 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 shadow-xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Plane className="w-3 h-3" />
          /flykhiva
        </button>
        <button
          type="button"
          onClick={() => handleCommand('/prestige')}
          className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Building2 className="w-3 h-3" />
          /prestige
        </button>
        <button
          type="button"
          onClick={() => handleCommand('/zip')}
          className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 shadow-xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Archive className="w-3 h-3" />
          /zip
        </button>
        <button
          type="button"
          onClick={() => handleCommand('/project')}
          className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 shadow-xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Download className="w-3 h-3" />
          /project
        </button>
        <button
          type="button"
          onClick={() => handleCommand('/status')}
          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:text-amber-600 shadow-xs whitespace-nowrap transition-colors cursor-pointer"
        >
          /status
        </button>
        <button
          type="button"
          onClick={() => handleCommand('/clear')}
          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 shadow-xs whitespace-nowrap transition-colors cursor-pointer"
        >
          /clear
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70 dark:bg-slate-950/50">
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
              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm text-xs sm:text-sm leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-amber-500 text-white rounded-tr-xs'
                  : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-xs'
              }`}
            >
              <div
                className="whitespace-pre-line break-words"
                dangerouslySetInnerHTML={{ __html: m.text }}
              />

              {/* Copyable / testable MRZ example box */}
              {m.mrzExampleText && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-slate-900 text-amber-300 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans">
                    <span className="font-semibold text-slate-300">Tayyor 2 qatorli MRZ misol:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(m.mrzExampleText!);
                        setCopiedExample(true);
                        setTimeout(() => setCopiedExample(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                    >
                      {copiedExample ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedExample ? 'Nusxalandi' : 'Nusxa'}</span>
                    </button>
                  </div>
                  <pre
                    translate="no"
                    className="notranslate font-mono text-[10px] leading-relaxed overflow-x-auto select-all text-amber-300"
                  >
                    {m.mrzExampleText}
                  </pre>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInputVal(m.mrzExampleText!);
                        inputRef.current?.focus();
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 transition-colors cursor-pointer"
                    >
                      Matn maydoniga joylash
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCommand(m.mrzExampleText!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Namuna bilan sinash
                    </button>
                  </div>
                </div>
              )}

              {/* Passport preview card inside chat */}
              {m.passportPreview && (
                <div translate="no" className="notranslate mt-2.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center justify-between font-mono font-bold text-amber-600 dark:text-amber-400">
                    <span>{m.passportPreview.series} {m.passportPreview.number}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {m.passportPreview.title}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                    {m.passportPreview.surname} {m.passportPreview.givenNames}
                  </div>
                </div>
              )}

              {/* File Attachment Bubble inside chat */}
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
                      type="button"
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
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-transform active:scale-95 cursor-pointer"
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

      {/* Multi-line Input bar (supports Enter to send & Shift+Enter or pasting 2-line MRZ) */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700/60 flex items-end gap-2"
      >
        <textarea
          ref={inputRef}
          rows={2}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t.chatSendPrompt}
          className="flex-1 px-3.5 py-2 text-xs font-mono sm:text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none leading-snug"
        />
        <button
          type="submit"
          className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Yuborish</span>
        </button>
      </form>
    </div>
  );
};
