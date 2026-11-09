/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PassportRecord, AppTheme, AppLang, FlightDetails } from './types/passport';
import { getTranslation } from './utils/i18n';
import { Header } from './components/Header';
import { CosmicBackground } from './components/CosmicBackground';
import { PassportScanner } from './components/PassportScanner';
import { PassportTable } from './components/PassportTable';
import { TelegramChatStream } from './components/TelegramChatStream';
import { AdminModal } from './components/AdminModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { Footer } from './components/Footer';
import {
  FileSpreadsheet,
  Bot,
  Sparkles,
  Zap,
  Download,
  WifiOff,
  Plane,
  Building2,
  Archive,
} from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('gt_theme') as AppTheme) || 'fazo';
  });
  const [lang, setLang] = useState<AppLang>(() => {
    return (localStorage.getItem('gt_lang') as AppLang) || 'uz';
  });

  const [passports, setPassports] = useState<PassportRecord[]>(() => {
    try {
      const saved = localStorage.getItem('gt_passports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'both' | 'table' | 'chat'>('both');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showPWAModal, setShowPWAModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const [flightDetails, setFlightDetails] = useState<FlightDetails>({
    flightDate: '07.11.2026',
    flightNumber: '2U 5508',
    departureTime: '23:50',
    route: 'SSH-TAS',
  });

  const t = getTranslation(lang);

  // Sync theme to document root
  useEffect(() => {
    localStorage.setItem('gt_theme', theme);
    const root = document.documentElement;
    if (theme === 'qunduzgi') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [theme]);

  // Sync language
  useEffect(() => {
    localStorage.setItem('gt_lang', lang);
  }, [lang]);

  // Sync passports
  useEffect(() => {
    try {
      localStorage.setItem('gt_passports', JSON.stringify(passports));
    } catch {
      // ignore
    }
  }, [passports]);

  // Network listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAddPassports = (newRecords: PassportRecord[]) => {
    setPassports((prev) => [...prev, ...newRecords]);
  };

  const handleUpdatePassport = (updated: PassportRecord) => {
    setPassports((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDeletePassport = (id: string) => {
    setPassports((prev) => prev.filter((p) => p.id !== id));
  };

  const handleClearPassports = () => {
    setPassports([]);
  };

  // Export Excel (.xlsx)
  const handleExportExcel = async (template: 'prestige' | 'flykhiva') => {
    if (passports.length === 0) return;
    try {
      const res = await fetch(`/api/excel/${template}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: passports, flightDetails }),
      });
      if (!res.ok) throw new Error('Eksport xatosi');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        template === 'flykhiva'
          ? `Spisok_Na_Aviabileti_${flightDetails.route}_${passports.length}_passengers.xlsx`
          : `Prestige_TAS_SHARM_${passports.length}_records.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExportNotice(
        template === 'flykhiva'
          ? '✈️ Avia biletlar ro\'yxati (.xlsx) muvaffaqiyatli yuklab olindi!'
          : '🏛 Prestige TAS SHARM (.xlsx) muvaffaqiyatli yuklab olindi!'
      );
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Export ZIP (.zip)
  const handleExportZip = async () => {
    if (passports.length === 0) {
      setExportNotice("⚠️ Pasportlar ro'yxati bo'sh. Avval pasport yuklang yoki namunaviy pasport qo'shing!");
      setTimeout(() => setExportNotice(null), 4000);
      return;
    }
    try {
      const res = await fetch('/api/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: passports, flightDetails }),
      });
      if (!res.ok) throw new Error('ZIP xatosi');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Grand_Turan_Zayavka_Pack_${passports.length}_passports.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExportNotice('📦 Barcha fayllar ZIP arxivda muvaffaqiyatli yuklab olindi!');
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div
      className={`min-h-screen relative flex flex-col font-sans transition-colors duration-500 ${
        theme === 'qunduzgi'
          ? 'bg-slate-50 text-slate-900'
          : theme === 'fazo'
          ? 'bg-[#060b14] text-slate-100'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Animated Space Cosmic Canvas for 'fazo' theme */}
      <CosmicBackground active={theme === 'fazo'} />

      {/* Offline Mode Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-2 z-50">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Offlayn rejim faol — Pasportlar lokal MRZ xotirasi bilan o'qiladi.</span>
        </div>
      )}

      {/* Download Alert Toast */}
      {exportNotice && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 p-4 rounded-2xl bg-emerald-600 text-white shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-4">
          <Download className="w-5 h-5 text-amber-300" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Header */}
      <Header
        theme={theme}
        setTheme={setTheme}
        lang={lang}
        setLang={setLang}
        isAdminUnlocked={isAdminUnlocked}
        onOpenAdmin={() => {
          setIsAdminUnlocked(true);
          setShowAdminModal(true);
        }}
        onOpenPWA={() => setShowPWAModal(true)}
      />

      {/* Hero Banner with Quick Stats & Navigation */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
        {/* Top Hero Card */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-indigo-500/10 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <span>⚜️ 100% Rasmiy Shablonda</span>
                <span>•</span>
                <span>TAS SHARM & Avia Biletlar</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Pasportlarni Sun'iy Intellekt va MRZ bilan Excelga aylantiring
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                1 tadan 100 tagacha pasport suratlarini bir vaqtda yuklang. Faqat Familiya va Ism kerak, otasining ismi olib tashlangan holda TAS SHARM va Avia Biletlar (SSH-TAS) shabloniga to'liq 100% mos .xlsx formatiga eksport qilinadi.
              </p>
            </div>

            {/* Quick Actions & Counter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="px-5 py-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                  Yuklangan pasportlar
                </span>
                <span className="text-2xl font-black text-amber-500">
                  {passports.length} <span className="text-xs font-normal text-slate-400">ta</span>
                </span>
              </div>

              {passports.length > 0 && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleExportExcel('prestige')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white shadow-md transition-all active:scale-95"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>TAS SHARM (.xlsx)</span>
                  </button>
                  <button
                    onClick={() => handleExportExcel('flykhiva')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md transition-all active:scale-95"
                  >
                    <Plane className="w-3.5 h-3.5" />
                    <span>Avia Biletlar (.xlsx)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Passport Scanner Drag & Drop Component */}
        <PassportScanner
          lang={lang}
          onAddPassports={handleAddPassports}
          onClear={handleClearPassports}
          recordsCount={passports.length}
        />

        {/* View Layout Switcher (Both / Table / Bot Chat) */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('both')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'both'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Hammasi birga
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'table'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Jadval ({passports.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-white dark:bg-slate-700 text-sky-500 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Telegram Bot</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Dasturchi: <b className="text-slate-800 dark:text-slate-200">Muhammad Amin</b></span>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'both' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 cols: Table */}
            <div className="lg:col-span-7">
              <PassportTable
                lang={lang}
                passports={passports}
                onUpdatePassport={handleUpdatePassport}
                onDeletePassport={handleDeletePassport}
                onExportExcel={handleExportExcel}
                onExportZip={handleExportZip}
                flightDetails={flightDetails}
                setFlightDetails={setFlightDetails}
              />
            </div>
            {/* Right 5 cols: Telegram Chat Stream */}
            <div className="lg:col-span-5">
              <TelegramChatStream
                lang={lang}
                passports={passports}
                onExportExcel={handleExportExcel}
                onExportZip={handleExportZip}
                onClear={handleClearPassports}
              />
            </div>
          </div>
        ) : activeTab === 'table' ? (
          <PassportTable
            lang={lang}
            passports={passports}
            onUpdatePassport={handleUpdatePassport}
            onDeletePassport={handleDeletePassport}
            onExportExcel={handleExportExcel}
            onExportZip={handleExportZip}
            flightDetails={flightDetails}
            setFlightDetails={setFlightDetails}
          />
        ) : (
          <div className="max-w-2xl mx-auto">
            <TelegramChatStream
              lang={lang}
              passports={passports}
              onExportExcel={handleExportExcel}
              onExportZip={handleExportZip}
              onClear={handleClearPassports}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer
        lang={lang}
        onOpenAdmin={() => {
          setIsAdminUnlocked(true);
          setShowAdminModal(true);
        }}
        onOpenPWA={() => setShowPWAModal(true)}
      />

      {/* Admin Panel Modal */}
      <AdminModal
        lang={lang}
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        passports={passports}
        onDeleteRecord={handleDeletePassport}
        isUnlocked={isAdminUnlocked}
      />

      {/* PWA Free Screen Install Guide Modal */}
      <PWAInstallModal
        lang={lang}
        isOpen={showPWAModal}
        onClose={() => setShowPWAModal(false)}
      />
    </div>
  );
}
