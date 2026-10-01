'use client';

import React from 'react';

interface HeaderProps {
  totalCount: number;
  onOpenDrawer: () => void;
  currentOccasionName?: string;
}

export default function Header({
  totalCount,
  onOpenDrawer,
  currentOccasionName,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#090d16]/95 backdrop-blur-md border-b border-[#1f293d] px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Right side in RTL: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0284c7] to-[#38bdf8] flex items-center justify-center text-white text-xl shadow-md shadow-[#38bdf8]/20">
            📖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white leading-tight">
                دفتر النقطة
              </h1>
              {currentOccasionName && currentOccasionName !== 'all' && (
                <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/40 text-[11px] font-black text-sky-300">
                  {currentOccasionName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>قاعدة البيانات متصلة</span>
            </div>
          </div>
        </div>

        {/* Left side in RTL: Clean 3-Bars Hamburger Button */}
        <button
          type="button"
          onClick={onOpenDrawer}
          className="w-11 h-11 rounded-2xl bg-[#111827] hover:bg-[#1e293b] border border-[#1f293d] hover:border-sky-400 text-slate-300 hover:text-white flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-90"
          title="القائمة والمناسبات (3 شُرط)"
        >
          <span className="w-5 h-0.5 bg-current rounded-full transition-transform"></span>
          <span className="w-5 h-0.5 bg-current rounded-full transition-transform"></span>
          <span className="w-3.5 h-0.5 bg-current rounded-full transition-transform ml-auto"></span>
        </button>
      </div>
    </header>
  );
}
