import React, { useState, useRef } from 'react';
import { PassportRecord, AppLang } from '../types/passport';
import { getTranslation } from '../utils/i18n';
import {
  UploadCloud,
  Camera,
  Sparkles,
  Zap,
  Trash2,
  FileCheck,
  BrainCircuit,
  Loader2,
  AlertTriangle,
  X,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PassportScannerProps {
  lang: AppLang;
  onAddPassports: (records: PassportRecord[]) => void;
  onClear: () => void;
  recordsCount: number;
}

export const PassportScanner: React.FC<PassportScannerProps> = ({
  lang,
  onAddPassports,
  onClear,
  recordsCount,
}) => {
  const t = getTranslation(lang);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [dragActive, setDragActive] = useState(false);
  const [engineMode, setEngineMode] = useState<'ai' | 'offline'>('ai');
  const [useThinking, setUseThinking] = useState(false);
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const [mrzInput, setMrzInput] = useState('');

  // Helper to read file as Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    setScanErrors([]);
    setIsProcessing(true);
    setProgress({ current: 0, total: validFiles.length });

    const newRecords: PassportRecord[] = [];
    const errors: string[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setProgress({ current: i + 1, total: validFiles.length });

      try {
        const base64 = await fileToBase64(file);
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
            mode: engineMode,
            useThinking,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.record) {
          errors.push(`${file.name}: ${data.error || "Rasmni o'qib bo'lmadi"}`);
          continue;
        }

        data.record.sourceFileName = file.name;
        newRecords.push(data.record);
      } catch (err: any) {
        console.error('Failed to parse file:', file.name, err);
        errors.push(`${file.name}: ${err?.message || "Server bilan bog'lanishda xatolik"}`);
      }
    }

    if (errors.length > 0) {
      setScanErrors(errors);
    }

    if (newRecords.length > 0) {
      onAddPassports(newRecords);
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
        });
      } catch {
        // ignore
      }
    }

    setIsProcessing(false);
  };

  const handleParseMrzText = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = mrzInput.trim();
    if (!trimmed) return;

    setScanErrors([]);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/parse-mrz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mrzText: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.record) {
        setScanErrors([data.error || "MRZ matndan ma'lumot ajratib olinmadi."]);
      } else {
        onAddPassports([data.record]);
        setMrzInput('');
        try {
          confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setScanErrors([err?.message || 'MRZ tahlil xatosi']);
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick sample passport generator (for instant testing without needing real passport scans)
  const handleLoadSample = () => {
    setScanErrors([]);
    const sampleNames = [
      { sur: 'KARIMOV', name: 'SARDOR', gen: 'M', ser: 'FA', num: '1234567', dob: '1990-yil 14-may', exp: '09.01.2033' },
      { sur: 'TOSHMATOVA', name: 'DILNOZA', gen: 'F', ser: 'AA', num: '9876543', dob: '1995-yil 22-avgust', exp: '15.08.2034' },
      { sur: 'ALIEV', name: 'AZIZ', gen: 'M', ser: 'AB', num: '5566778', dob: '1988-yil 03-noyabr', exp: '20.11.2032' },
      { sur: 'RAXIMOVA', name: 'ZARINA', gen: 'F', ser: 'FA', num: '4433221', dob: '2001-yil 11-yanvar', exp: '05.02.2031' },
    ];

    const pick = sampleNames[Math.floor(Math.random() * sampleNames.length)];
    const sampleRecord: PassportRecord = {
      id: `sample_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceFileName: `sample_passport_${pick.ser}${pick.num}.jpg`,
      surname: pick.sur,
      givenNames: pick.name,
      surnameLat: pick.sur,
      givenNamesLat: pick.name,
      birthDate: pick.dob,
      title: pick.gen === 'M' ? 'MR' : 'MRS',
      series: pick.ser,
      number: pick.num,
      issueDate: '10.01.2023',
      expiryDate: pick.exp,
      nationality: "O'zbekiston",
      gender: pick.gen as 'M' | 'F',
      country: "O'zbekiston",
      rawMrz: `P<UZB${pick.sur}<<${pick.name}<<<<<<<<<<<<<<<<<<<\n${pick.ser}${pick.num}8UZB9005142${pick.gen}3301095<<<<<<<<<<<<<<02`,
      confidence: 0.99,
      engineUsed: 'demo-sample',
      parsedAt: new Date().toISOString(),
    };

    onAddPassports([sampleRecord]);
    try {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-full rounded-2xl p-4 sm:p-6 transition-all duration-300 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/5">
      {/* Engine & Settings Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-amber-500">📸</span>
            {t.scannerTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.scannerSubtitle}
          </p>
        </div>

        {/* Engine Switcher (AI vs Offline MRZ Text) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setEngineMode('ai');
                setScanErrors([]);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                engineMode === 'ai'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.modeAiVision}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEngineMode('offline');
                setScanErrors([]);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                engineMode === 'offline'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{t.modeOfflineMrz}</span>
            </button>
          </div>

          {/* Thinking Mode toggle */}
          {engineMode === 'ai' && (
            <button
              type="button"
              onClick={() => setUseThinking(!useThinking)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                useThinking
                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/40'
                  : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Yuqori aniqlikdagi tahlil (Thinking Mode)"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.thinkingMode}</span>
            </button>
          )}

          {recordsCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.clearQueue}</span>
            </button>
          )}
        </div>
      </div>

      {/* Explicit Error Banner (Never hides errors or invents fake records) */}
      {scanErrors.length > 0 && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Pasportni o‘qishda xatolik yuz berdi:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {scanErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScanErrors([])}
            aria-label="Xatolikni yopish"
            className="p-1 rounded-lg hover:bg-rose-200/50 dark:hover:bg-rose-900/50 text-rose-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {engineMode === 'offline' ? (
        /* Offline Deterministic 2-Line MRZ Text Input */
        <form
          onSubmit={handleParseMrzText}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                Pasport ostidagi 2 qatorli MRZ kodini kiriting
              </span>
            </div>
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              {t.demoButton}
            </button>
          </div>
          <textarea
            rows={3}
            value={mrzInput}
            onChange={(e) => setMrzInput(e.target.value)}
            placeholder={`P<UZBKARIMOV<<SARDOR<<<<<<<<<<<<<<<<<<<<<<<<\nFA12345678UZB9005142M3301095<<<<<<<<<<<<<<02`}
            className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              MRZ kodi asosida familiya, ism (otasining ismisiz), seriya, raqam, tug‘ilgan sana va amal qilish muddati 100% aniq ajratiladi.
            </p>
            <button
              type="submit"
              disabled={isProcessing || !mrzInput.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white shadow-sm transition-all cursor-pointer"
            >
              {isProcessing ? 'Tahlil qilinmoqda...' : 'MRZ ni Tahlil Qilish'}
            </button>
          </div>
        </form>
      ) : (
        /* Drag & Drop Upload Zone for AI Vision */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          className={`relative rounded-xl border-2 border-dashed p-6 sm:p-8 text-center transition-all ${
            dragActive
              ? 'border-amber-500 bg-amber-500/5 scale-[1.005]'
              : 'border-slate-300 dark:border-slate-700 hover:border-amber-500/50 bg-slate-50/50 dark:bg-slate-800/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const picked = Array.from(e.target.files);
                e.target.value = '';
                handleFiles(picked);
              }
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const picked = Array.from(e.target.files);
                e.target.value = '';
                handleFiles(picked);
              }
            }}
          />

          {isProcessing ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Pasportlar sun'iy intellekt orqali o'qilmoqda... ({progress.current}/{progress.total})
              </div>
              <div className="w-64 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                  style={{
                    width: `${(progress.current / Math.max(1, progress.total)) * 100}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-inner">
                <UploadCloud className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Pasport suratlarini bu yerga tashlang yoki tanlang
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bir vaqtning o‘zida 1 tadan 100 tagacha pasport yuklash mumkin
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{t.uploadButton}</span>
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{t.cameraButton}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{t.demoButton}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
