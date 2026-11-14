import React, { useState } from 'react';
import { PassportRecord, AppLang, FlightDetails } from '../types/passport';
import { getTranslation } from '../utils/i18n';
import {
  FileSpreadsheet,
  Download,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  Sparkles,
  Zap,
  Archive,
  Eye,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { downloadProjectSourceZip } from '../utils/downloadProject';
import { resolvePassengerTitle } from '../utils/mrzParser';

interface PassportTableProps {
  lang: AppLang;
  passports: PassportRecord[];
  onUpdatePassport: (updated: PassportRecord) => void;
  onDeletePassport: (id: string) => void;
  onExportExcel: (template: 'prestige' | 'flykhiva') => void;
  onExportZip: () => void;
  flightDetails: FlightDetails;
  setFlightDetails: (fd: FlightDetails) => void;
}

export const PassportTable: React.FC<PassportTableProps> = ({
  lang,
  passports,
  onUpdatePassport,
  onDeletePassport,
  onExportExcel,
  onExportZip,
  flightDetails,
  setFlightDetails,
}) => {
  const t = getTranslation(lang);
  const [search, setSearch] = useState('');
  const [editingRecord, setEditingRecord] = useState<PassportRecord | null>(null);

  const filtered = passports.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.surname.toLowerCase().includes(q) ||
      p.givenNames.toLowerCase().includes(q) ||
      `${p.series}${p.number}`.toLowerCase().includes(q)
    );
  });

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    onUpdatePassport(editingRecord);
    setEditingRecord(null);
  };

  if (passports.length === 0) {
    return (
      <div className="w-full rounded-2xl p-8 sm:p-12 text-center bg-white/95 dark:bg-slate-900/75 dark:backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/60 shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <FileSpreadsheet className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
          {t.noPassports}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Pasport suratlarini yuqoridagi maydonga yuklang yoki tezkor namuna orqali sinab ko'ring.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-white/95 dark:bg-slate-900/75 dark:backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/60 shadow-xl shadow-slate-900/5 dark:shadow-black/30 overflow-hidden">
      {/* Top action header */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {t.tableTitle}
            </h3>
            <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {passports.length} ta
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Zayavka yaratishdan oldin har bir pasport maʼlumotlarini tekshirishingiz yoki tahrirlashingiz mumkin.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onExportExcel('prestige')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white shadow-md shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Prestige Zayavka (Row 1 headers, Row 2+ data)"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-300" />
            <span>{t.btnPrestige}</span>
          </button>

          <button
            onClick={() => onExportExcel('flykhiva')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-600 to-cyan-700 hover:from-sky-700 hover:to-cyan-800 text-white shadow-md shadow-sky-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Avia biletlar ro'yxati (SSH - TAS 07.11.2026.xlsx formatida)"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>Avia Biletlar (.xlsx)</span>
          </button>

          <button
            onClick={onExportZip}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Prestige + Avia Biletlar + JSON to'plami (.zip)"
          >
            <Archive className="w-4 h-4" />
            <span className="hidden sm:inline">Excel ZIP</span>
            <span className="sm:hidden">ZIP</span>
          </button>

          <button
            onClick={() => downloadProjectSourceZip()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="Loyiha to'liq kodini yuklab olish (.zip) — GitHub va Server uchun"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Loyiha ZIP (GitHub)</span>
            <span className="sm:hidden">Loyiha</span>
          </button>
        </div>
      </div>

      {/* Flight Details Bar for Avia biletlar (Image 8 SSH - TAS 07.11.2026.xlsx) */}
      <div className="px-4 sm:px-6 py-2.5 bg-sky-500/5 dark:bg-sky-950/20 border-b border-sky-100 dark:border-sky-900/40 flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
        <span className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1">
          ✈️ Reys sozlamalari (Avia bilet):
        </span>
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 dark:text-slate-400">Sana:</label>
          <input
            type="text"
            value={flightDetails.flightDate}
            onChange={(e) => setFlightDetails({ ...flightDetails, flightDate: e.target.value })}
            placeholder="07.11.2026"
            className="w-24 px-2 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 dark:text-slate-400">Reys №:</label>
          <input
            type="text"
            value={flightDetails.flightNumber}
            onChange={(e) => setFlightDetails({ ...flightDetails, flightNumber: e.target.value })}
            placeholder="2U 5508"
            className="w-20 px-2 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 dark:text-slate-400">Vaqt:</label>
          <input
            type="text"
            value={flightDetails.departureTime}
            onChange={(e) => setFlightDetails({ ...flightDetails, departureTime: e.target.value })}
            placeholder="23:50"
            className="w-16 px-2 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 dark:text-slate-400">Marshrut:</label>
          <input
            type="text"
            value={flightDetails.route}
            onChange={(e) => setFlightDetails({ ...flightDetails, route: e.target.value })}
            placeholder="SSH-TAS"
            className="w-24 px-2 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono font-bold"
          />
        </div>
      </div>

      {/* Search Input */}
      <div className="px-4 sm:px-6 py-3 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ism, familiya yoki pasport raqami bo'yicha qidirish..."
          className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Tozalash
          </button>
        )}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3">№</th>
              <th className="px-4 py-3">{t.colSurname}</th>
              <th className="px-4 py-3">{t.colName}</th>
              <th className="px-4 py-3">{t.colDocNum}</th>
              <th className="px-4 py-3">{t.colDob}</th>
              <th className="px-4 py-3">{t.colGender}</th>
              <th className="px-4 py-3">{t.colExpiry}</th>
              <th className="px-4 py-3">{t.colNat}</th>
              <th className="px-4 py-3">{t.colStatus}</th>
              <th className="px-4 py-3 text-right">{t.colActions}</th>
            </tr>
          </thead>
          <tbody translate="no" className="notranslate divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
            {filtered.map((record, index) => (
              <tr
                key={record.id}
                className="hover:bg-amber-500/5 transition-colors"
              >
                <td className="px-4 py-3 font-semibold text-slate-400">
                  {index + 1}
                </td>
                <td className="px-4 py-3 font-black text-slate-900 dark:text-white">
                  {record.surname}
                </td>
                <td className="px-4 py-3 font-bold">
                  {record.givenNames}
                </td>
                <td className="px-4 py-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                  {record.series} {record.number}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {record.birthDate}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {(() => {
                    const effectiveTitle = record.birthDate
                      ? resolvePassengerTitle(record.birthDate, record.gender)
                      : record.title;
                    const badgeClass =
                      effectiveTitle === 'INF'
                        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                        : effectiveTitle === 'CHD'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : record.gender === 'M'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
                    return (
                      <span translate="no" className={`notranslate inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${badgeClass}`}>
                        {effectiveTitle} ({record.gender})
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                  {record.expiryDate}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  {record.nationality}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tayyor
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditingRecord({ ...record })}
                      aria-label="Tahrirlash"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                      title="Tahrirlash"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeletePassport(record.id)}
                      aria-label="O'chirish"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {t.editModalTitle}
            </h4>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Familiya
                  </label>
                  <input
                    type="text"
                    value={editingRecord.surname}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        surname: e.target.value.toUpperCase(),
                        surnameLat: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Ism
                  </label>
                  <input
                    type="text"
                    value={editingRecord.givenNames}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        givenNames: e.target.value.toUpperCase(),
                        givenNamesLat: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Seria (masalan FA)
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={editingRecord.series}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, series: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    № Raqami
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={editingRecord.number}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, number: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tugʻilgan sana
                  </label>
                  <input
                    type="text"
                    value={editingRecord.birthDate}
                    onChange={(e) => {
                      const nextBirth = e.target.value;
                      setEditingRecord({
                        ...editingRecord,
                        birthDate: nextBirth,
                        title: nextBirth
                          ? resolvePassengerTitle(nextBirth, editingRecord.gender)
                          : editingRecord.title,
                      });
                    }}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Amal qilish muddati
                  </label>
                  <input
                    type="text"
                    value={editingRecord.expiryDate}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, expiryDate: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Jinsi & MR/MRS/CHD/INF
                  </label>
                  <select
                    value={`${editingRecord.gender}-${editingRecord.title}`}
                    onChange={(e) => {
                      const [g, titleVal] = e.target.value.split('-');
                      setEditingRecord({
                        ...editingRecord,
                        gender: g as 'M' | 'F',
                        title: titleVal as 'MR' | 'MRS' | 'CHD' | 'INF',
                      });
                    }}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="M-MR">Erkak (MR, 12+ yosh)</option>
                    <option value="F-MRS">Ayol (MRS, 12+ yosh)</option>
                    <option value="M-CHD">Bola O'g'il (CHD, 2-11 yosh)</option>
                    <option value="F-CHD">Bola Qiz (CHD, 2-11 yosh)</option>
                    <option value="M-INF">Chaqaloq O'g'il (INF, &lt;2 yosh)</option>
                    <option value="F-INF">Chaqaloq Qiz (INF, &lt;2 yosh)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Fuqarolik
                  </label>
                  <input
                    type="text"
                    value={editingRecord.nationality}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, nationality: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                >
                  {t.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
