'use client';

import React from 'react';
import { LedgerStats } from '@/types/ledger';

interface StatsCardsProps {
  stats: LedgerStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 select-none">
      {/* 1. اللي جالنا (إجمالي النقطة المستلمة) */}
      <div className="bg-[#111827] border border-[#1f293d] hover:border-sky-500/40 rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[82px] sm:min-h-[92px] shadow-md transition-all">
        <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-black text-sky-400">
          <span className="truncate">📥 اللي جالنا</span>
          <span className="text-[10px] text-sky-400 font-bold bg-sky-950/60 border border-sky-500/20 px-1.5 py-0.5 rounded shrink-0">
            استلام
          </span>
        </div>
        <div className="mt-1 flex items-baseline">
          <span className="text-xl sm:text-2xl font-black text-sky-400 tracking-tight">
            {(stats.totalAmount || 0).toLocaleString('en-US')}
          </span>
          <span className="text-[11px] font-bold text-sky-400/80 mr-1.5">ج</span>
        </div>
      </div>

      {/* 2. اللي دفعناه (إجمالي رد الواجب) */}
      <div className="bg-[#111827] border border-[#1f293d] hover:border-purple-500/40 rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[82px] sm:min-h-[92px] shadow-md transition-all">
        <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-black text-purple-400">
          <span className="truncate">📤 اللي دفعناه</span>
          <span className="text-[10px] text-purple-400 font-bold bg-purple-950/60 border border-purple-500/20 px-1.5 py-0.5 rounded shrink-0">
            رد واجب
          </span>
        </div>
        <div className="mt-1 flex items-baseline">
          <span className="text-xl sm:text-2xl font-black text-purple-400 tracking-tight">
            {(stats.totalPaidAmount || 0).toLocaleString('en-US')}
          </span>
          <span className="text-[11px] font-bold text-purple-400/80 mr-1.5">ج</span>
        </div>
      </div>

      {/* 3. اللي لينا (متبقي مستحق لينا عند الناس) */}
      <div className="bg-[#111827] border border-[#1f293d] hover:border-emerald-500/40 rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[82px] sm:min-h-[92px] shadow-md transition-all">
        <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-black text-emerald-400">
          <span className="truncate">💎 اللي لينا</span>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
            باقي لينا
          </span>
        </div>
        <div className="mt-1 flex items-baseline">
          <span className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
            {(stats.totalLeinaAmount || 0).toLocaleString('en-US')}
          </span>
          <span className="text-[11px] font-bold text-emerald-400/80 mr-1.5">ج</span>
        </div>
      </div>

      {/* 4. اللي علينا (واجب في رقبتنا لسه مدفعناهوش) */}
      <div className="bg-[#111827] border border-[#1f293d] hover:border-amber-500/40 rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[82px] sm:min-h-[92px] shadow-md transition-all">
        <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-black text-[#fbbf24]">
          <span className="truncate">⚖️ اللي علينا</span>
          <span className="text-[10px] text-amber-400 font-bold bg-amber-950/60 border border-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
            {stats.settlementsCount} واجب
          </span>
        </div>
        <div className="mt-1 flex items-baseline">
          <span className="text-xl sm:text-2xl font-black text-[#fbbf24] tracking-tight">
            {(stats.totalAlinaAmount || 0).toLocaleString('en-US')}
          </span>
          <span className="text-[11px] font-bold text-[#fbbf24]/80 mr-1.5">ج</span>
        </div>
      </div>
    </div>
  );
}
