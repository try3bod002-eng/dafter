'use client';

import React, { useState, useRef } from 'react';
import { LedgerEntry, calculateNetBalance } from '@/types/ledger';

interface EntryCardProps {
  entry: LedgerEntry;
  onUpdate: (id: number, data: Partial<LedgerEntry>) => void;
  onDelete: (id: number) => void;
  onOpenStatement: (entry: LedgerEntry) => void;
}

export default function EntryCard({
  entry,
  onUpdate,
  onDelete,
  onOpenStatement,
}: EntryCardProps) {
  const netInfo = calculateNetBalance(entry);

  // Swipe gesture state
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only initiate swipe if not clicking an interactive input or button
    const target = e.target as HTMLElement;
    if (['BUTTON', 'INPUT', 'A'].includes(target.tagName) || target.isContentEditable) {
      return;
    }
    startXRef.current = e.clientX;
    setIsSwiping(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null) return;
    const diff = e.clientX - startXRef.current;
    // Limit maximum drag to -110px left and +110px right
    const clamped = Math.max(-110, Math.min(110, diff));
    setOffsetX(clamped);
  };

  const handlePointerUp = () => {
    if (startXRef.current === null) return;
    const finalDiff = offsetX;
    startXRef.current = null;
    setIsSwiping(false);

    // If swiped far to the left (negative in RTL or physical screen left < -60)
    if (finalDiff < -60) {
      // Trigger Statement / Settle
      onOpenStatement(entry);
    } else if (finalDiff > 60) {
      // Swiped far to the right -> Open Statement
      onOpenStatement(entry);
    }

    // Smoothly snap back
    setOffsetX(0);
  };

  const handleFieldBlur = (field: keyof LedgerEntry, val: string) => {
    const trimmed = val.trim();
    if (field === 'amount') {
      const num = parseFloat(trimmed.replace(/[^\d.]/g, '')) || 0;
      if (num !== entry.amount) {
        onUpdate(entry.id, { amount: num });
      }
    } else {
      if (trimmed !== (entry[field] || '')) {
        onUpdate(entry.id, { [field]: trimmed });
      }
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl select-none touch-pan-y">
      
      {/* ── Background Action Reveal Layers ── */}
      {/* Left Reveal (Swipe Right): Blue "كشف الحساب" */}
      <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-sky-600 to-sky-500 flex items-center justify-end px-5 text-white font-black text-xs gap-1.5">
        <span>📑 كشف الحساب</span>
        <span>👉</span>
      </div>

      {/* Right Reveal (Swipe Left): Green "رد الواجب" */}
      <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-emerald-600 to-teal-500 flex items-center justify-start px-5 text-white font-black text-xs gap-1.5">
        <span>👈</span>
        <span>🤝 رد الواجب</span>
      </div>

      {/* ── Main Foreground Card ── */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { startXRef.current = null; setOffsetX(0); setIsSwiping(false); }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.4, 1)',
        }}
        className={`relative z-10 border rounded-2xl p-3.5 sm:p-4 shadow-md transition-colors ${
          netInfo.status === 'khalis'
            ? 'bg-[#0f172a] border-emerald-950/60 opacity-85'
            : netInfo.status === 'alina'
            ? 'bg-[#111827] border-[#1f293d] hover:border-amber-500/40'
            : 'bg-[#111827] border-[#1f293d] hover:border-[#38bdf8]/40'
        }`}
      >
        {/* Upper Row: Seq, Name & Nickname + Net Balance Badge */}
        <div className="flex items-start justify-between gap-2.5 mb-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Sequential Number */}
            <span className="w-6 h-6 rounded-lg bg-[#1e293b] text-[#94a3b8] font-black text-[11px] flex items-center justify-center shrink-0">
              {entry.id}
            </span>

            {/* Name and Nickname */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleFieldBlur('name', e.currentTarget.innerText)}
                className={`font-black text-base sm:text-lg outline-none rounded px-1 transition-colors focus:bg-[#090d16] truncate cursor-text ${
                  netInfo.status === 'khalis' ? 'text-slate-300' : 'text-white'
                }`}
              >
                {entry.name}
              </span>

              {/* Nickname (اللقب أو الشهرة) */}
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleFieldBlur('nickname', e.currentTarget.innerText)}
                className="text-xs font-bold text-sky-400 bg-sky-950/40 border border-sky-500/30 px-2 py-0.5 rounded-md outline-none focus:bg-[#090d16] cursor-text shrink-0"
                title="اللقب أو الشهرة (اضغط للتعديل)"
              >
                {entry.nickname ? `(${entry.nickname})` : '+ لقب'}
              </span>
            </div>
          </div>

          {/* Net Status Badge (واجب علينا / باقي لينا / خالص) */}
          <div
            onClick={() => onOpenStatement(entry)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border shadow-sm shrink-0 cursor-pointer transition-transform active:scale-95 text-center ${
              netInfo.status === 'khalis'
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/60'
                : netInfo.status === 'alina'
                ? 'bg-gradient-to-r from-amber-950/90 to-amber-900/80 text-amber-300 border-amber-500/40 hover:border-amber-400'
                : 'bg-gradient-to-r from-sky-950/90 to-sky-900/80 text-sky-300 border-sky-500/40 hover:border-sky-400'
            }`}
            title="اضغط لفتح كشف الحساب وتفاصيل الحركات"
          >
            {netInfo.label}
          </div>
        </div>

        {/* Middle Row: Meta Tags (Location & Notes) */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-xs">
          {/* Location Tag */}
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => handleFieldBlur('location', e.currentTarget.innerText)}
            className="bg-[#182234] text-[#cbd5e1] px-2.5 py-1 rounded-md font-semibold outline-none focus:bg-[#090d16] focus:text-white cursor-text flex items-center gap-1"
          >
            <span>📍</span>
            <span>{entry.location || 'بدون بلد'}</span>
          </span>

          {/* Notes Tag */}
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => handleFieldBlur('notes', e.currentTarget.innerText)}
            className="bg-[#182234] text-[#94a3b8] px-2.5 py-1 rounded-md font-semibold outline-none focus:bg-[#090d16] focus:text-white cursor-text flex items-center gap-1 flex-1 min-w-[120px] truncate"
          >
            <span>📝</span>
            <span>{entry.notes || 'بدون ملاحظات'}</span>
          </span>
        </div>

        {/* Bottom Row: Quick Actions Bar */}
        <div className="flex items-center justify-between pt-2.5 border-t border-[#1a2336] text-xs">
          
          <div className="flex items-center gap-2">
            {/* Open Statement Button */}
            <button
              type="button"
              onClick={() => onOpenStatement(entry)}
              className="bg-white/5 hover:bg-white/10 text-sky-300 border border-sky-400/20 px-3 py-1 rounded-lg font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>📑</span>
              <span>كشف الحساب</span>
            </button>

            {/* Quick Settle / Pay Button */}
            <button
              type="button"
              onClick={() => onOpenStatement(entry)}
              className="bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>🤝</span>
              <span>رد الواجب</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Strikethrough Checkbox */}
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#94a3b8] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={entry.crossed}
                onChange={(e) => onUpdate(entry.id, { crossed: e.target.checked })}
                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
              />
              <span>شطب (خالص)</span>
            </label>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              title="حذف هذا القيد"
              className="text-[#64748b] hover:text-red-400 p-1 text-sm transition-colors cursor-pointer"
            >
              🗑️
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
