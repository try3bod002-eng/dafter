'use client';

import React from 'react';
import { LedgerStats } from '@/types/ledger';

interface StatsCardsProps {
  stats: LedgerStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
      {/* 1. Total People Count */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between text-xs font-semibold text-[#94a3b8]">
          <span>👥 عدد الأسماء</span>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded">
            {stats.activeCount} نشط
          </span>
        </div>
        <div className="mt-2">
          <span className="text-xl sm:text-2xl font-black text-white">
            {stats.totalCount}
          </span>
          <span className="text-xs font-bold text-[#94a3b8] mr-1.5">شخص</span>
        </div>
      </div>

      {/* 2. Total Inbound Cash (Received by Groom / Family) */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between text-xs font-semibold text-[#38bdf8]">
          <span>💰 النقطة المستلمة (لينا)</span>
        </div>
        <div className="mt-2">
          <span className="text-xl sm:text-2xl font-black text-[#38bdf8]">
            {(stats.totalAmount || 0).toLocaleString('en-US')}
          </span>
          <span className="text-xs font-bold text-[#38bdf8] mr-1.5">ج</span>
        </div>
      </div>

      {/* 3. Crossed / Returned Obligation Amount */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between text-xs font-semibold text-[#34d399]">
          <span>🤝 مشطوب (مردود)</span>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded">
            {stats.crossedCount} سُدّد
          </span>
        </div>
        <div className="mt-2">
          <span className="text-xl sm:text-2xl font-black text-[#34d399]">
            {(stats.totalCrossedAmount || 0).toLocaleString('en-US')}
          </span>
          <span className="text-xs font-bold text-[#34d399] mr-1.5">ج</span>
        </div>
      </div>

      {/* 4. Total Outbound Future Obligation (Alina) */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between text-xs font-semibold text-[#fbbf24]">
          <span>⚖️ واجب علينا للناس</span>
          <span className="text-[10px] text-amber-400 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded">
            {stats.settlementsCount} تسوية
          </span>
        </div>
        <div className="mt-2">
          <span className="text-xl sm:text-2xl font-black text-[#fbbf24]">
            {(stats.totalAlinaAmount || 0).toLocaleString('en-US')}
          </span>
          <span className="text-xs font-bold text-[#fbbf24] mr-1.5">ج</span>
        </div>
      </div>
    </div>
  );
}
