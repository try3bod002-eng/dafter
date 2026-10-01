'use client';

import React from 'react';

interface HeaderProps {
  totalCount: number;
  onOpenManualModal: () => void;
  onExportJson: () => void;
}

export default function Header({ totalCount, onOpenManualModal, onExportJson }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#090d16]/95 backdrop-blur-md border-b border-[#1f293d] px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0284c7] to-[#38bdf8] flex items-center justify-center text-white text-xl shadow-md shadow-[#38bdf8]/20">
            📖
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white leading-tight">
              دفتر النقطة والواجب
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>قاعدة البيانات متصلة ومحفوظة</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenManualModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e293b] text-white hover:bg-[#334155] text-xs sm:text-sm font-bold border border-[#1f293d] transition-colors cursor-pointer"
          >
            <span>➕</span>
            <span className="hidden sm:inline">إضافة قيد</span>
          </button>

          <button
            onClick={onExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e293b] text-[#94a3b8] hover:text-white hover:bg-[#334155] text-xs sm:text-sm font-bold border border-[#1f293d] transition-colors cursor-pointer"
            title="نسخ البيانات كـ JSON"
          >
            <span>📋</span>
            <span>نسخ</span>
          </button>
        </div>
      </div>
    </header>
  );
}
