'use client';

import React from 'react';
import { LedgerStats } from '@/types/ledger';

interface StatsCardsProps {
  stats: LedgerStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
      {/* Total Count */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-3.5 flex flex-col justify-between">
        <span className="text-xs font-semibold text-[#94a3b8]">عدد الأسماء</span>
        <div className="mt-1">
          <span className="text-xl sm:text-2xl font-black text-white">
            {stats.totalCount}
          </span>
          <span className="text-xs font-bold text-[#94a3b8] mr-1">شخص</span>
        </div>
      </div>

      {/* Total Amount */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-3.5 flex flex-col justify-between">
        <span className="text-xs font-semibold text-[#94a3b8]">مجموع المبالغ</span>
        <div className="mt-1">
          <span className="text-xl sm:text-2xl font-black text-[#38bdf8]">
            {stats.totalAmount.toLocaleString('en-US')}
          </span>
          <span className="text-xs font-bold text-[#38bdf8] mr-1">ج</span>
        </div>
      </div>

      {/* Done / Crossed */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-3.5 flex flex-col justify-between">
        <span className="text-xs font-semibold text-[#94a3b8]">المشطوب (مردود)</span>
        <div className="mt-1">
          <span className="text-xl sm:text-2xl font-black text-[#34d399]">
            {stats.crossedCount}
          </span>
          <span className="text-xs font-bold text-[#34d399] mr-1">شخص</span>
        </div>
      </div>

      {/* Target Written in notebook */}
      <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-3.5 flex flex-col justify-between">
        <span className="text-xs font-semibold text-[#94a3b8]">دفتر الورقة الأولى</span>
        <div className="mt-1">
          <span className="text-xl sm:text-2xl font-black text-[#fbbf24]">
            7,900
          </span>
          <span className="text-xs font-bold text-[#fbbf24] mr-1">ج</span>
        </div>
      </div>
    </div>
  );
}
