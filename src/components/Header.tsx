import React, { useState } from 'react';
import { AppTheme, AppLang } from '../types/passport';
import { getTranslation } from '../utils/i18n';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Shield,
  Sun,
  Moon,
  Sparkles,
  Download,
  KeyRound,
  CheckCircle2,
  Globe,
  Radio,
} from 'lucide-react';
import { downloadProjectSourceZip } from '../utils/downloadProject';

interface HeaderProps {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  lang: AppLang;
  setLang: (l: AppLang) => void;
  isAdminUnlocked: boolean;
  onOpenAdmin: () => void;
  onOpenPWA: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  setTheme,
  lang,
  setLang,
  isAdminUnlocked,
  onOpenAdmin,
  onOpenPWA,
}) => {
  const t = getTranslation(lang);
  const { isInstallable, isIOS, isInstalled } = usePWAInstall();
  const [pinInput, setPinInput] = useState('');
  const [showQuickPin, setShowQuickPin] = useState(false);
  const [pinError, setPinError] = useState(false);

  const handleQuickUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1111' || pinInput === '7777') {
      setShowQuickPin(false);
      setPinInput('');
      setPinError(false);
      onOpenAdmin();
    } else {
      setPinError(true);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md border-b transition-colors duration-300 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 shadow-lg shadow-amber-500/20 text-white font-black text-xl border border-amber-300/40">
            ⚜️
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Grand Turan <span className="text-amber-500 font-extrabold">AI</span>
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {t.headerBadge}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{t.developer}</span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Radio className="w-3 h-3 animate-pulse" /> Online
              </span>
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* PWA Install Button */}
          {!isInstalled && (
            <button
              onClick={onOpenPWA}
              aria-label={t.installPwa}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              title={t.installPwa}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.installPwa}</span>
              <span className="sm:hidden">PWA</span>
            </button>
          )}

          {/* Download Project Source ZIP Button */}
          <button
            onClick={() => downloadProjectSourceZip()}
            className="hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="Loyiha to'liq kodini yuklab olish (.zip) — GitHub va Server uchun"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Loyiha ZIP</span>
          </button>

          {/* Theme Selector (3 themes: Qunduzgi, Tungi, Fazo) */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setTheme('qunduzgi')}
              aria-label={t.themeDay}
              title={t.themeDay}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                theme === 'qunduzgi'
                  ? 'bg-white text-amber-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('tungi')}
              aria-label={t.themeNight}
              title={t.themeNight}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                theme === 'tungi'
                  ? 'bg-slate-700 text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('fazo')}
              aria-label={t.themeSpace}
              title={t.themeSpace}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                theme === 'fazo'
                  ? 'bg-gradient-to-r from-indigo-900 to-purple-900 text-amber-300 shadow-xs ring-1 ring-amber-400/50'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>

          {/* Language Selector (UZ, RU, EN) */}
          <div className="relative flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
            {(['uz', 'ru', 'en'] as AppLang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-label={`Til: ${l.toUpperCase()}`}
                className={`px-2 py-1 text-xs font-bold rounded-lg uppercase transition-all ${
                  lang === l
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Admin Unlock Button */}
          {isAdminUnlocked ? (
            <button
              onClick={onOpenAdmin}
              aria-label={t.unlockAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowQuickPin(!showQuickPin)}
                aria-label={t.adminPinPrompt}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">1111 / 7777</span>
              </button>

              {showQuickPin && (
                <div className="absolute right-0 mt-2 w-64 p-3 rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 z-50 animate-in fade-in slide-in-from-top-2">
                  <form onSubmit={handleQuickUnlock} className="space-y-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {t.adminPinPrompt}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="password"
                        maxLength={8}
                        placeholder="1111 / 7777"
                        value={pinInput}
                        onChange={(e) => {
                          setPinInput(e.target.value);
                          setPinError(false);
                        }}
                        autoFocus
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        OK
                      </button>
                    </div>
                    {pinError && (
                      <p className="text-[11px] text-rose-500 font-medium">
                        Kod noto'g'ri! (1111 yoki 7777)
                      </p>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
