import React, { useState } from 'react';
import { AppLang } from '../types/passport';
import { getTranslation } from '../utils/i18n';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Smartphone,
  Monitor,
  Share2,
  PlusSquare,
  Download,
  X,
  CheckCircle,
  Apple,
} from 'lucide-react';

interface PWAInstallModalProps {
  lang: AppLang;
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  lang,
  isOpen,
  onClose,
}) => {
  const t = getTranslation(lang);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'windows'>('android');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {t.installPwa}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                100% Tekin • Offlayn ishlaydi • Bosh ekranga qo‘shish
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Switcher Tabs */}
        <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 my-4">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'android'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Android</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'ios'
                ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Apple className="w-4 h-4" />
            <span>iPhone / iPad</span>
          </button>

          <button
            onClick={() => setActiveTab('windows')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'windows'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Windows / Mac</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="py-2">
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    Google Chrome brauzerida oching.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    Quyidagi <b>"Ilovani O'rnatish"</b> tugmasini bosing yoki brauzer menyusidagi (3 ta nuqta) <b>"Ilovani o'rnatish"</b> bandini tanlang.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    Grand Turan AI belgisi telefoningiz bosh ekranida paydo bo'ladi.
                  </p>
                </div>
              </div>

              {isInstallable && (
                <button
                  onClick={async () => {
                    await install();
                    onClose();
                  }}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                >
                  <Download className="w-5 h-5" />
                  <span>Hozir O‘rnatish (1-bosishda)</span>
                </button>
              )}
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    Saytni <b>Safari</b> brauzerida oching.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                    Pastki paneldagi <Share2 className="w-4 h-4 text-sky-500 inline" /> <b>"Ulashish" (Share)</b> tugmasini bosing.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                    Ro'yxatdan <PlusSquare className="w-4 h-4 text-amber-500 inline" /> <b>"Bosh ekranga qo‘shish" (Add to Home Screen)</b> ni tanlang va "Qo'shish" tugmasini bosing.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                💡 iOS Safari tizimida PWA ilova to'liq ekran rejimida xuddi App Store ilovasi kabi tez va qulay ishlaydi!
              </div>
            </div>
          )}

          {activeTab === 'windows' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    Google Chrome yoki Microsoft Edge brauzeridan foydalaning.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    Manzil satrining o'ng tomonidagi <b>O'rnatish</b> (kompyuter/ekran belgisi) tugmasini bosing.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    Ilova ish stoli (Desktop) yorlig'i sifatida saqlanadi va alohida darcha bo'lib ochiladi.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
