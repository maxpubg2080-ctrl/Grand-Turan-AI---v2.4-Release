import React, { useState, useEffect } from 'react';
import { AdminSystemStats, PassportRecord, AppLang } from '../types/passport';
import { getTranslation } from '../utils/i18n';
import {
  Shield,
  Activity,
  Bot,
  RefreshCw,
  GitBranch,
  Server,
  Database,
  Trash2,
  CheckCircle2,
  X,
  ExternalLink,
  Cpu,
  KeyRound,
  Radio,
  Download,
  Copy,
  Check,
  Terminal,
  Cloud,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { downloadProjectSourceZip } from '../utils/downloadProject';

interface AdminModalProps {
  lang: AppLang;
  isOpen: boolean;
  onClose: () => void;
  passports: PassportRecord[];
  onDeleteRecord: (id: string) => void;
  isUnlocked?: boolean;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  lang,
  isOpen,
  onClose,
  passports,
  onDeleteRecord,
  isUnlocked: initialUnlocked = false,
}) => {
  const t = getTranslation(lang);
  const [pinCode, setPinCode] = useState('');
  const [unlockedLocal, setUnlockedLocal] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState<'control' | 'deploy'>('control');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isUnlocked = unlockedLocal || initialUnlocked;

  useEffect(() => {
    if (initialUnlocked) {
      setUnlockedLocal(true);
    }
  }, [initialUnlocked, isOpen]);

  const [stats, setStats] = useState<AdminSystemStats | null>(null);
  const [botToken, setBotToken] = useState('');
  const [deployHookUrl, setDeployHookUrl] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const webhookEndpoint =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/telegram/webhook`
      : 'https://<RENDER_HOST>/api/telegram/webhook';

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/status');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    }
  };

  useEffect(() => {
    if (isOpen && isUnlocked) {
      fetchStats();
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isUnlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode === '1111' || pinCode === '7777') {
      setUnlockedLocal(true);
      setPinError(false);
      fetchStats();
    } else {
      setPinError(true);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSaveSettings = async (e?: React.FormEvent, withWebhook = true) => {
    if (e) e.preventDefault();
    const setTargetStatus = withWebhook ? setWebhookStatus : setDeployStatus;
    if (withWebhook && !botToken.trim() && !stats?.telegramWebhookConfigured) {
      setWebhookStatus({ ok: false, text: "Avval @BotFather tokenini kiriting" });
      return;
    }
    if (!withWebhook && !deployHookUrl.trim()) {
      setDeployStatus({ ok: false, text: "⚠️ Avval Render Deploy Hook URL kiriting" });
      return;
    }
    setSavingSettings(true);
    setTargetStatus(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pinCode || '1111',
          newBotToken: botToken,
          newDeployHookUrl: deployHookUrl,
          registerWebhook: withWebhook,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTargetStatus({
          ok: true,
          text: withWebhook
            ? `✓ ${data.message || 'Webhook muvaffaqiyatli ulandi!'}`
            : '✓ Hook saqlandi (/redeploy tayyor)',
        });
        fetchStats();
      } else {
        setTargetStatus({
          ok: false,
          text: `⚠️ ${data.message || data.error || 'Sozlamani saqlashda xatolik'}`,
        });
      }
    } catch (err: any) {
      setTargetStatus({ ok: false, text: `❌ ${err.message}` });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTriggerDeploy = async () => {
    setDeploying(true);
    setDeployStatus(null);
    try {
      const res = await fetch('/api/admin/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pinCode || '1111',
          deployHookUrl: deployHookUrl.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeployStatus({ ok: true, text: `✅ ${data.message || 'Render qayta ishga tushirildi!'}` });
        fetchStats();
      } else {
        setDeployStatus({ ok: false, text: `⚠️ ${data.error || 'Deploy Hook xatosi'}` });
      }
    } catch (err: any) {
      setDeployStatus({ ok: false, text: `❌ ${err.message}` });
    } finally {
      setDeploying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-7 text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30 font-black text-lg">
              ⚜️
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Grand Turan AI — Admin & Updater Studio
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dasturchi: Muhammad Amin • PIN: 1111 / 7777
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Admin panelni yopish"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lock Screen if not unlocked */}
        {!isUnlocked ? (
          <div className="py-12 max-w-sm mx-auto text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <KeyRound className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Admin panelga kirish
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Iltimos, tasdiqlash uchun xavfsizlik kodini kiriting (1111 yoki 7777)
            </p>

            <form onSubmit={handleUnlock} className="space-y-3">
              <input
                type="password"
                placeholder="1111 yoki 7777"
                maxLength={6}
                value={pinCode}
                onChange={(e) => {
                  setPinCode(e.target.value);
                  setPinError(false);
                }}
                autoFocus
                className="w-full text-center tracking-widest text-lg font-mono px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {pinError && (
                <p className="text-xs text-rose-500 font-semibold">
                  Noto'g'ri kod! Iltimos 1111 yoki 7777 kiriting.
                </p>
              )}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition-all hover:scale-[1.01]"
              >
                Tizimni ochish
              </button>
            </form>
          </div>
        ) : (
          /* Unlocked Admin Dashboard */
          <div className="py-4 space-y-5">
            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <button
                onClick={() => setActiveTab('control')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'control'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Server className="w-4 h-4" />
                <span>Boshqaruv & Updater</span>
              </button>
              <button
                onClick={() => setActiveTab('deploy')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'deploy'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                <span>GitHub & Server Deploy Qo'llanmasi</span>
              </button>
            </div>

            {activeTab === 'control' ? (
              <div className="space-y-5">
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Jami tahlil
                    </span>
                    <p className="text-xl sm:text-2xl font-black text-amber-500 mt-1">
                      {stats?.totalScanned ?? passports.length}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Paketlar
                    </span>
                    <p className="text-xl sm:text-2xl font-black text-sky-500 mt-1">
                      {stats?.totalBatches ?? 0}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Prestige / FlyKhiva
                    </span>
                    <p className="text-xl sm:text-2xl font-black text-emerald-500 mt-1">
                      {stats?.prestigeCount ?? 0} / {stats?.flykhivaCount ?? 0}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Server Uptime
                    </span>
                    <p className="text-xl sm:text-2xl font-black text-indigo-500 mt-1">
                      {stats?.uptimeSeconds ?? 0}s
                    </p>
                  </div>
                </div>

                {/* Render & GitHub Updater Section */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-amber-500" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Render Deploy & Webhook Sozlamalari
                      </h3>
                    </div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      Jonli aloqa
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Render Deploy Hook */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="render-deploy-hook-input" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Render Deploy Hook (Updater)
                        </label>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            stats?.renderDeployHookConfigured
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          {stats?.renderDeployHookConfigured ? '● Ulangan' : 'Auto-Redeploy'}
                        </span>
                      </div>
                      <input
                        id="render-deploy-hook-input"
                        type="url"
                        placeholder="https://api.render.com/deploy/srv-..."
                        value={deployHookUrl}
                        onChange={(e) => {
                          setDeployHookUrl(e.target.value);
                          setDeployStatus(null);
                        }}
                        className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveSettings(undefined, false)}
                          disabled={savingSettings}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 transition-all cursor-pointer disabled:opacity-50"
                        >
                          Saqlash
                        </button>
                        <button
                          type="button"
                          onClick={handleTriggerDeploy}
                          disabled={deploying}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${deploying ? 'animate-spin' : ''}`} />
                          <span>Qayta yangilash (/redeploy)</span>
                        </button>
                      </div>
                      {deployStatus && (
                        <p
                          role="status"
                          className={`text-[11px] font-semibold break-words ${
                            deployStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {deployStatus.text}
                        </p>
                      )}
                    </div>

                    {/* Telegram Bot Webhook Config */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="telegram-bot-token-input" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Telegram Bot Token
                        </label>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            stats?.telegramWebhookConfigured
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-sky-500/10 text-sky-600'
                          }`}
                        >
                          {stats?.telegramWebhookConfigured ? '● Bot Faol' : '@grandturanai_bot'}
                        </span>
                      </div>
                      <input
                        id="telegram-bot-token-input"
                        type="text"
                        placeholder="7123456789:AAH..."
                        value={botToken}
                        onChange={(e) => {
                          setBotToken(e.target.value);
                          setWebhookStatus(null);
                        }}
                        className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate" title={webhookEndpoint}>
                        Endpoint: {webhookEndpoint}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveSettings(undefined, true)}
                          disabled={savingSettings}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Bot className={`w-3.5 h-3.5 ${savingSettings ? 'animate-pulse' : ''}`} />
                          <span>{savingSettings ? 'Ulanmoqda...' : 'Webhook Ulash'}</span>
                        </button>
                      </div>
                      {webhookStatus && (
                        <p
                          role="status"
                          className={`text-[11px] font-semibold break-all ${
                            webhookStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {webhookStatus.text}
                        </p>
                      )}
                    </div>

                    {/* Server-side AI Status (Configured via Environment Secrets) */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Cpu className="w-4 h-4 text-amber-500" />
                          Gemini AI Vision Dvigateli (gemini-4-hydrogen)
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            stats?.aiEngineStatus === 'active'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {stats?.aiEngineStatus === 'active'
                            ? '● Server Kaliti Faol'
                            : '○ GEMINI_API_KEY Sozlanmagan'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Xavfsizlik talablariga muvofiq <code className="font-mono">GEMINI_API_KEY</code> faqat server muhitida (AI Studio <b>Settings &gt; Secrets</b> yoki Render <b>Environment Variables</b>) saqlanadi.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Direct Project ZIP download banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900 to-purple-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-indigo-500/30 shadow-lg">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-1.5 text-amber-300">
                      <Download className="w-4 h-4" />
                      Loyiha To'liq Manba Kodini Yuklab Olish (.zip)
                    </h4>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      Server fayllari, Dockerfile, render.yaml, frontend, Telegram bot va barcha skriptlar bitta to'plamda.
                    </p>
                  </div>
                  <button
                    onClick={() => downloadProjectSourceZip()}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all hover:scale-105 active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    📦 Loyiha ZIP Yuklash
                  </button>
                </div>

                {/* System Diagnostics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Node Versiyasi</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {stats?.nodeVersion || 'v22.23.2'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Xotira sarfi</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {stats?.memoryUsageMb || 45} MB
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Dasturchi</span>
                    <span className="font-bold text-amber-500">
                      Muhammad Amin
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Deployment & GitHub Step-by-Step Guide Tab */
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                      🚀 Loyihani GitHub-ga joylash va Render serverga ulash qo'llanmasi
                    </h3>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                      Ushbu 4 ta qadam orqali sayt va Telegram botingiz 24/7 rejimida serverda ishlaydi.
                    </p>
                  </div>
                  <button
                    onClick={() => downloadProjectSourceZip()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ZIP-ni olish</span>
                  </button>
                </div>

                {/* Step 1: GitHub */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">
                        1
                      </span>
                      GitHub-ga yuklash buyruqlari
                    </h4>
                    <button
                      onClick={() =>
                        handleCopy(
                          `git add .\ngit commit -m "Fix AI vision extraction and dark theme"\ngit branch -M main\ngit push -u origin main`,
                          'git'
                        )
                      }
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-white transition-all"
                    >
                      {copiedKey === 'git' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'git' ? 'Nusxalandi' : 'Nusxa olish'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
{`git remote set-url origin https://github.com/maxpubg2080-ctrl/Grand-Turan-AI---v2.4-Release.git
git add .
git commit -m "Fix AI vision extraction and dark theme"
git branch -M main
git push -u origin main`}
                  </pre>
                </div>

                {/* Step 2: Render.com Deploy */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">
                      2
                    </span>
                    Render.com da bepul Web Service sozlash
                  </h4>
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 pl-7">
                    <p>1. <b>render.com</b> ga kiring va GitHub orqali kiring.</p>
                    <p>2. <b>New +</b> -&gt; <b>Web Service</b> -&gt; GitHub-dagi <b>grand-turan-ai</b> ni tanlang.</p>
                    <p>3. Sozlamalarni quyidagicha to'ldiring:</p>
                    <ul className="list-disc pl-5 space-y-1 font-mono text-[11px]">
                      <li>Build Command: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">npm install --legacy-peer-deps && npm run build</code></li>
                      <li>Start Command: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">npm start</code></li>
                      <li>Instance: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">Free</code></li>
                    </ul>
                  </div>
                </div>

                {/* Step 3: Environment Variables */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">
                      3
                    </span>
                    Environment Variables (Atrof-muhit o'zgaruvchilari)
                  </h4>
                  <div className="pl-7 space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Render boshqaruv panelida <b>Environment Variables</b> bo'limiga quyidagilarni kiriting:
                    </p>
                    <div className="font-mono text-[11px] p-2.5 rounded-lg bg-slate-900 text-slate-200 space-y-1">
                      <div>PORT = 3000</div>
                      <div>NODE_ENV = production</div>
                      <div>GEMINI_API_KEY = &lt;Sizning AI Studio kalitingiz&gt;</div>
                      <div>TELEGRAM_BOT_TOKEN = &lt;BotFather tokeni&gt;</div>
                      <div>RENDER_DEPLOY_HOOK_URL = &lt;Settings -&gt; Deploy Hook URL&gt;</div>
                    </div>
                  </div>
                </div>

                {/* Step 4: Webhook and Auto-Updater */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">
                      4
                    </span>
                    Telegram Webhook va Auto-Updater ulash
                  </h4>
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pl-7">
                    <p>
                      Render Deploy Hook URL manzilini yuqoridagi <b>Boshqaruv & Updater</b> katagiga kiriting va saqlang. Endi botda <code className="font-bold text-amber-500">/redeploy</code> buyrug'ini yozsangiz, Render serveringiz avtomatik qayta yangilanadi!
                    </p>
                    <p>
                      Telegram webhook-ni ulash uchun brauzerda quyidagi manzilni oching:
                    </p>
                    <div className="p-2.5 rounded-lg bg-slate-900 text-amber-300 font-mono text-[10px] break-all">
                      https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url=https://&lt;RENDER_HOST&gt;/api/telegram/webhook
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
