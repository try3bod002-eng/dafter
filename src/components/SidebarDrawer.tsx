'use client';

import React, { useState } from 'react';
import { OccasionItem, LedgerEntry } from '@/types/ledger';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  occasions: OccasionItem[];
  selectedOccasion: string;
  onSelectOccasion: (name: string) => void;
  onAddOccasion: (name: string) => void;
  onDeleteOccasion: (id: string) => void;
  entries: LedgerEntry[];
  onOpenManualModal: () => void;
  onExportJson: () => void;
  onImportJson: (imported: LedgerEntry[]) => void;
}

export default function SidebarDrawer({
  isOpen,
  onClose,
  occasions,
  selectedOccasion,
  onSelectOccasion,
  onAddOccasion,
  onDeleteOccasion,
  entries,
  onOpenManualModal,
  onExportJson,
  onImportJson,
}: SidebarDrawerProps) {
  const [newOccasionName, setNewOccasionName] = useState('');
  const [isAddingOccasion, setIsAddingOccasion] = useState(false);

  if (!isOpen) return null;

  const handleCreateOccasion = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOccasionName.trim();
    if (!trimmed) return;
    onAddOccasion(trimmed);
    setNewOccasionName('');
    setIsAddingOccasion(false);
  };

  // Helper to calculate stats per occasion
  const getOccasionStats = (occName: string) => {
    const occEntries = entries.filter(
      (e) => (e.occasion || 'عام') === occName || (occName === 'عام' && !e.occasion)
    );
    const count = occEntries.length;
    const total = occEntries.reduce((sum, e) => sum + (e.receivedAmount ?? e.amount ?? 0), 0);
    return { count, total };
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          if (confirm(`هل أنت متأكد من استيراد ${parsed.length} قيد؟ سيتم استبدال البيانات الحالية.`)) {
            onImportJson(parsed);
            onClose();
          }
        } else {
          alert('الملف غير متوافق! تأكد من اختيار ملف دفتر صحيح.');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة الملف!');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Drawer Panel (slides in from right in RTL) */}
      <div className="fixed inset-y-0 right-0 max-w-xs sm:max-w-sm w-full bg-[#0d1321] border-l border-[#1f293d] shadow-2xl flex flex-col z-50 text-white animate-slideInRight">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#1f293d] flex items-center justify-between bg-[#111827]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-lg shadow-md shadow-sky-500/20">
              📖
            </div>
            <div>
              <h2 className="text-sm font-black text-white leading-tight">دفتر النقطة والواجب</h2>
              <p className="text-[11px] text-[#94a3b8] font-bold">إدارة المناسبات والبيانات</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
            title="إغلاق القائمة"
          >
            ✕
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Quick Action: Add New Entry */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenManualModal();
            }}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-sky-500/25 transition-all cursor-pointer active:scale-95"
          >
            <span>➕</span>
            <span>تسجيل قيد / نقطة جديدة</span>
          </button>

          {/* Section 1: Occasions / Collections */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-black text-sky-400 tracking-wide flex items-center gap-1.5">
                <span>📁</span>
                <span>المناسبات والكوليكشنات ({occasions.length})</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAddingOccasion(!isAddingOccasion)}
                className="text-[11px] font-bold text-[#38bdf8] hover:text-sky-300 flex items-center gap-1 cursor-pointer"
              >
                <span>➕</span>
                <span>مناسبة جديدة</span>
              </button>
            </div>

            {/* Quick Add Occasion Input */}
            {isAddingOccasion && (
              <form onSubmit={handleCreateOccasion} className="mb-3 p-2.5 rounded-xl bg-[#162032] border border-sky-500/30 space-y-2">
                <input
                  type="text"
                  value={newOccasionName}
                  onChange={(e) => setNewOccasionName(e.target.value)}
                  placeholder="اسم المناسبة (مثال: فرح أحمد، سبوع نور...)"
                  autoFocus
                  className="w-full bg-[#0d1321] border border-[#1f293d] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-sky-400 font-bold"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingOccasion(false);
                      setNewOccasionName('');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!newOccasionName.trim()}
                    className="px-3 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[11px] font-black text-black cursor-pointer shadow"
                  >
                    حفظ المناسبة
                  </button>
                </div>
              </form>
            )}

            {/* "All Occasions" Button */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  onSelectOccasion('all');
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedOccasion === 'all'
                    ? 'bg-sky-500/15 border border-sky-400 text-sky-300 font-black'
                    : 'bg-[#111827] border border-[#1f293d] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🌟</span>
                  <span>جميع المناسبات (الكل)</span>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-[#1f293d] text-[10px] text-slate-300 font-black">
                  {entries.length} قيد
                </span>
              </button>

              {/* Occasions List */}
              {occasions.map((occ) => {
                const stats = getOccasionStats(occ.name);
                const isSelected = selectedOccasion === occ.name;
                return (
                  <div
                    key={occ.id}
                    className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-sky-500/15 border border-sky-400 text-sky-300 font-black'
                        : 'bg-[#111827] border border-[#1f293d] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectOccasion(occ.name);
                        onClose();
                      }}
                      className="flex-1 text-right flex items-center justify-between pl-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🎉</span>
                        <span className="truncate max-w-[140px]">{occ.name}</span>
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] text-sky-400 font-black">
                          {stats.total.toLocaleString()} ج
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {stats.count} قيد
                        </div>
                      </div>
                    </button>

                    {/* Delete Occasion if empty or user insists */}
                    {occasions.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`هل تريد بالتأكيد حذف مناسبة "${occ.name}"؟`)) {
                            onDeleteOccasion(occ.id);
                          }
                        }}
                        className="opacity-40 group-hover:opacity-100 hover:text-rose-400 px-1 py-0.5 rounded transition-all cursor-pointer text-xs"
                        title="حذف المناسبة"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Backup & Data Management */}
          <div>
            <span className="text-xs font-black text-amber-400 tracking-wide flex items-center gap-1.5 mb-2.5">
              <span>💾</span>
              <span>النسخ الاحتياطي والبيانات</span>
            </span>

            <div className="space-y-2">
              {/* Export JSON */}
              <button
                type="button"
                onClick={onExportJson}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#111827] border border-[#1f293d] hover:border-amber-400/40 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>📥</span>
                  <span>تصدير نسخة احتياطية (نسخ/حفظ)</span>
                </div>
                <span className="text-[10px] text-amber-400 font-bold">JSON</span>
              </button>

              {/* Import JSON File */}
              <label className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#111827] border border-[#1f293d] hover:border-amber-400/40 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer">
                <div className="flex items-center gap-2">
                  <span>📤</span>
                  <span>استيراد واسترجاع ملف دفتر</span>
                </div>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <span className="text-[10px] text-slate-400 font-bold">استعراض</span>
              </label>
            </div>
          </div>

          {/* Section 3: App Overview */}
          <div className="p-3 rounded-xl bg-[#111827]/70 border border-[#1f293d] text-center space-y-1.5">
            <div className="text-xs font-bold text-slate-400">إجمالي النقطة المسجلة بالدفتر</div>
            <div className="text-base font-black text-emerald-400">
              {entries.reduce((sum, e) => sum + (e.receivedAmount ?? e.amount ?? 0), 0).toLocaleString()} جنيه
            </div>
            <div className="text-[10px] text-slate-500">
              {entries.length} شخص مسجلين في {occasions.length} مناسبات
            </div>
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-[#1f293d] bg-[#0b101c] text-center text-[10px] text-slate-500 font-bold">
          دفتر النقطة والواجب • حفظ محلي آمن 100%
        </div>
      </div>
    </div>
  );
}
