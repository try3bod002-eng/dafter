'use client';

import React from 'react';
import { OccasionItem, LedgerEntry } from '@/types/ledger';

interface OccasionChipsBarProps {
  occasions: OccasionItem[];
  selectedOccasion: string;
  onSelectOccasion: (name: string) => void;
  onOpenDrawer: () => void;
  entries: LedgerEntry[];
}

export default function OccasionChipsBar({
  occasions,
  selectedOccasion,
  onSelectOccasion,
  onOpenDrawer,
  entries,
}: OccasionChipsBarProps) {
  // Compute counts
  const getCount = (name: string) => {
    if (name === 'all') return entries.length;
    return entries.filter((e) => (e.occasion || 'عام') === name || (name === 'عام' && !e.occasion)).length;
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1.5 px-0.5 select-none">
      {/* All Occasions Chip */}
      <button
        type="button"
        onClick={() => onSelectOccasion('all')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 ${
          selectedOccasion === 'all'
            ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25 border border-sky-400'
            : 'bg-[#111827] text-slate-300 border border-[#1f293d] hover:text-white hover:border-slate-600'
        }`}
      >
        <span>🌟</span>
        <span>كل المناسبات</span>
        <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
          selectedOccasion === 'all' ? 'bg-black/30 text-white' : 'bg-[#1f293d] text-slate-400'
        }`}>
          {getCount('all')}
        </span>
      </button>

      {/* Dynamic Occasion Chips */}
      {occasions.map((occ) => {
        const isSelected = selectedOccasion === occ.name;
        const count = getCount(occ.name);
        return (
          <button
            key={occ.id}
            type="button"
            onClick={() => onSelectOccasion(occ.name)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 ${
              isSelected
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25 border border-sky-400'
                : 'bg-[#111827] text-slate-300 border border-[#1f293d] hover:text-white hover:border-slate-600'
            }`}
          >
            <span>🎉</span>
            <span>{occ.name}</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
              isSelected ? 'bg-black/30 text-white' : 'bg-[#1f293d] text-slate-400'
            }`}>
              {count}
            </span>
          </button>
        );
      })}

      {/* "+ مناسبة جديدة" button opens Drawer or prompt */}
      <button
        type="button"
        onClick={onOpenDrawer}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap text-sky-400 hover:text-sky-300 bg-[#111827]/60 border border-sky-500/20 hover:border-sky-500/50 cursor-pointer transition-all"
        title="إدارة وإضافة المناسبات"
      >
        <span>➕</span>
        <span>مناسبة</span>
      </button>
    </div>
  );
}
