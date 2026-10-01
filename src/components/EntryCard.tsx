'use client';

import React from 'react';
import { LedgerEntry } from '@/types/ledger';

interface EntryCardProps {
  entry: LedgerEntry;
  onUpdate: (id: number, data: Partial<LedgerEntry>) => void;
  onDelete: (id: number) => void;
}

export default function EntryCard({ entry, onUpdate, onDelete }: EntryCardProps) {
  const handleFieldBlur = (field: keyof LedgerEntry, val: string) => {
    const trimmed = val.trim();
    if (field === 'amount') {
      const num = parseFloat(trimmed.replace(/[^\d.]/g, '')) || 0;
      if (num !== entry.amount) {
        onUpdate(entry.id, { amount: num });
      }
    } else {
      if (trimmed !== entry[field]) {
        onUpdate(entry.id, { [field]: trimmed });
      }
    }
  };

  return (
    <div
      className={`border rounded-2xl p-3.5 sm:p-4 transition-all ${
        entry.crossed
          ? 'bg-[#101624] border-[#1e2638] opacity-75'
          : 'bg-[#111827] border-[#1f293d] hover:border-[#38bdf8]/60 shadow-md'
      }`}
    >
      {/* Upper Row: Seq, Name & Amount Badge */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[#1e293b] text-[#94a3b8] font-black text-xs flex items-center justify-center shrink-0">
            {entry.id}
          </span>
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => handleFieldBlur('name', e.currentTarget.innerText)}
            className={`font-black text-base sm:text-lg outline-none rounded px-1.5 py-0.5 transition-colors focus:bg-[#090d16] truncate cursor-text ${
              entry.crossed ? 'line-through text-[#94a3b8]' : 'text-white'
            }`}
          >
            {entry.name}
          </span>
        </div>

        {/* Amount Badge */}
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => handleFieldBlur('amount', e.currentTarget.innerText)}
          className="bg-[#38bdf8]/12 border border-[#38bdf8]/25 text-[#38bdf8] font-black text-base sm:text-lg px-3 py-1 rounded-xl outline-none focus:bg-[#090d16] shrink-0 cursor-text min-w-[75px] text-center"
        >
          {entry.amount} ج
        </span>
      </div>

      {/* Details Row: Meta Tags & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#1a2336] text-xs">
        {/* Location & Notes Tags */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => handleFieldBlur('location', e.currentTarget.innerText)}
            className="bg-[#182234] text-[#cbd5e1] px-2.5 py-1 rounded-md font-semibold outline-none focus:bg-[#090d16] focus:text-white cursor-text"
          >
            {entry.location || 'بدون بلد'}
          </span>

          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => handleFieldBlur('notes', e.currentTarget.innerText)}
            className="bg-[#182234] text-[#cbd5e1] px-2.5 py-1 rounded-md font-semibold outline-none focus:bg-[#090d16] focus:text-white cursor-text"
          >
            {entry.notes || 'بدون ملاحظات'}
          </span>
        </div>

        {/* Actions: Strikethrough Checkbox & Delete */}
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#94a3b8] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={entry.crossed}
              onChange={(e) => onUpdate(entry.id, { crossed: e.target.checked })}
              className="w-4 h-4 rounded accent-[#ef4444] cursor-pointer"
            />
            <span>شطب (مردود)</span>
          </label>

          <button
            onClick={() => onDelete(entry.id)}
            title="حذف هذا القيد"
            className="text-[#64748b] hover:text-[#ef4444] p-1 text-sm transition-colors cursor-pointer"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
