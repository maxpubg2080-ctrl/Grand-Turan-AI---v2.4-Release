import React from 'react';
import { AppLang } from '../types/passport';
import { getTranslation } from '../utils/i18n';
import { ShieldCheck, Heart, Bot, FileSpreadsheet, Download } from 'lucide-react';

interface FooterProps {
  lang: AppLang;
  onOpenAdmin: () => void;
  onOpenPWA: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  lang,
  onOpenAdmin,
  onOpenPWA,
}) => {
  const t = getTranslation(lang);

  return (
    <footer className="w-full mt-12 py-8 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs text-slate-600 dark:text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand and Developer Attribution */}
        <div className="flex items-center gap-3">
          <div className="text-xl">⚜️</div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              Grand Turan AI — Pasport & Excel Zayavka Tizimi
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
              <span>{t.developer}</span>
            </p>
          </div>
        </div>

        {/* Links and Capabilities */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
          <button
            onClick={onOpenPWA}
            className="hover:text-amber-500 transition-colors flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PWA O‘rnatish</span>
          </button>
          <span>•</span>
          <a
            href="https://t.me/grandturanai_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sky-500 transition-colors flex items-center gap-1"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>@grandturanai_bot</span>
          </a>
          <span>•</span>
          <button
            onClick={onOpenAdmin}
            className="hover:text-amber-500 transition-colors flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin (1111 / 7777)</span>
          </button>
        </div>

        {/* Copyright */}
        <div className="text-[11px] text-slate-400 text-center md:text-right">
          © {new Date().getFullYear()} Grand Turan AI. Barcha huquqlar himoyalangan.
        </div>
      </div>
    </footer>
  );
};
