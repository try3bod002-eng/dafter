'use client';

import React from 'react';
import { LedgerStats } from '@/types/ledger';

interface StatsCardsProps {
  stats: LedgerStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
      {/* 1. Total People Count */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[80px] sm:min-h-[90px] shadow-md hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-bold text-[#94a3b8]">
          <span className="truncate">👥 عدد الأسماء</span>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
            {stats.activeCount} نشط
          </span>
        </div>
        <div className="mt-1 flex items-baseline">
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {stats.totalCount}
          </span>
          <span className="text-[11px] font-bold text-[#64748b] mr-1.5">شخص</span>
        </div>
      </div>

      {/* 2. Total Inbound Cash (Received) */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[80px] sm:min-h-[90px] shadow-md hover:border-sky-500/30 transition-colors">
        <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-bold text-[#38bdf8]">
          <span className="truncate">💰 النقطة المستلمة</span>
          <span className="text-[10px] text-sky-400 font-bold bg-sky-950/50 border border-sky-500/20 px-1.5 py-0.5 rounded shrink-0">
            لينا
          </span>
        </div>
        <div className="mt-1 flex items-baseline">
          <span className="text-xl sm:text-2xl font-black text-[#38bdf8] tracking-tight">
            {(stats.totalAmount || 0).toLocaleString('en-US')}
          </span>
          <span className="text-[11px] font-bold text-[#38bdf8]/80 mr-1.5">ج</span>
        </div>
      </div>

      {/* 3. Money Owed to Us by Others (Leina) */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[80px] sm:min-h-[90px] shadow-md hover:border-sky-500/30 transition-colors">
        <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-bold text-sky-400">
          <span className="truncate">💎 فلوس لينا عند الناس</span>
          <span className="text-[10px] text-sky-400 font-bold bg-sky-950/50 border border-sky-500/20 px-1.5 py-0.5 rounded shrink-0">
            مستحقة لينا
          </span>
        </div>
        <div className="mt-1 flex items-baseline">
          <span className="text-xl sm:text-2xl font-black text-sky-400 tracking-tight">
            {(stats.totalLeinaAmount || 0).toLocaleString('en-US')}
          </span>
          <span className="text-[11px] font-bold text-sky-400/80 mr-1.5">ج</span>
        </div>
      </div>

      {/* 4. Total Outbound Future Obligation (Alina) */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[80px] sm:min-h-[90px] shadow-md hover:border-amber-500/30 transition-colors">
        <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs font-bold text-[#fbbf24]">
          <span className="truncate">⚖️ واجب علينا</span>
          <span className="text-[10px] text-amber-400 font-bold bg-amber-950/50 border border-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
            {stats.settlementsCount} تسوية
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
