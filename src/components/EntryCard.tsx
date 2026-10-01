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
  const startYRef = useRef<number | null>(null);
  const isHorizontalDragRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only initiate swipe if not clicking an interactive input or button
    const target = e.target as HTMLElement;
    if (['BUTTON', 'INPUT', 'A'].includes(target.tagName) || target.isContentEditable) {
      return;
    }
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    isHorizontalDragRef.current = false;
    setIsSwiping(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Check if user is scrolling vertically
    if (!isHorizontalDragRef.current) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        // Vertical page scroll — cancel horizontal swipe
        startXRef.current = null;
        startYRef.current = null;
        setOffsetX(0);
        return;
      }
      if (Math.abs(dx) > 10) {
        isHorizontalDragRef.current = true;
        setIsSwiping(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
      }
    }

    if (isHorizontalDragRef.current) {
      // Clamp between -120px and +120px
      const clamped = Math.max(-120, Math.min(120, dx));
      setOffsetX(clamped);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (startXRef.current === null) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const finalDiff = offsetX;
    startXRef.current = null;
    startYRef.current = null;
    isHorizontalDragRef.current = false;
    setIsSwiping(false);

    // If swiped far to the left (<= -50px)
    if (finalDiff <= -50) {
      onOpenStatement(entry);
    } else if (finalDiff >= 50) {
      // Swiped far to the right (>= +50px)
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
    <div className="relative overflow-hidden rounded-2xl select-none touch-pan-y bg-[#090d16]">
      
      {/* ── Background Action Reveal Layers ── */}
      {/* 1. Left Swipe Reveal (dragged to Left, opens on the Right): Green "رد الواجب" */}
      <div
        dir="ltr"
        className={`absolute inset-y-0 right-0 w-44 bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 flex items-center justify-end px-3.5 text-white font-black text-xs sm:text-sm transition-opacity ${
          offsetX < -5 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span className="whitespace-nowrap font-black tracking-wide text-white drop-shadow-sm">رد الواجب</span>
      </div>

      {/* 2. Right Swipe Reveal (dragged to Right, opens on the Left): Blue "كشف الحساب" */}
      <div
        dir="ltr"
        className={`absolute inset-y-0 left-0 w-44 bg-gradient-to-r from-sky-600 via-blue-600 to-sky-700 flex items-center justify-start px-3.5 text-white font-black text-xs sm:text-sm transition-opacity ${
          offsetX > 5 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span className="whitespace-nowrap font-black tracking-wide text-white drop-shadow-sm">كشف الحساب</span>
      </div>

      {/* ── Main Foreground Card (100% Solid Background, Zero Bleed-through) ── */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          startXRef.current = null;
          startYRef.current = null;
          isHorizontalDragRef.current = false;
          setOffsetX(0);
          setIsSwiping(false);
        }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.4, 1)',
        }}
        className={`relative z-10 border rounded-2xl p-3.5 sm:p-4 shadow-lg transition-colors bg-[#111827] ${
          netInfo.status === 'khalis'
            ? 'border-emerald-950/80 hover:border-emerald-500/30'
            : netInfo.status === 'alina'
            ? 'border-[#1f293d] hover:border-amber-500/40'
            : 'border-[#1f293d] hover:border-[#38bdf8]/40'
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
                className="font-black text-base sm:text-lg outline-none rounded px-1 transition-colors focus:bg-[#090d16] truncate cursor-text text-white"
              >
                {entry.name}
              </span>

              {/* Nickname (اللقب أو الشهرة) */}
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleFieldBlur('nickname', e.currentTarget.innerText)}
                className="text-xs font-bold text-sky-400 bg-sky-950/50 border border-sky-500/30 px-2 py-0.5 rounded-md outline-none focus:bg-[#090d16] cursor-text shrink-0"
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
                ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900/60'
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
              className="bg-white/5 hover:bg-white/10 text-sky-300 border border-sky-400/20 px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>📑</span>
              <span>كشف الحساب</span>
            </button>

            {/* Quick Settle / Pay Button */}
            <button
              type="button"
              onClick={() => onOpenStatement(entry)}
              className="bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>🤝</span>
              <span>رد الواجب</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Strikethrough Checkbox: Disabled if person owes us money */}
            <label
              className={`flex items-center gap-1.5 text-[11px] font-bold select-none ${
                netInfo.status === 'leina'
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : 'text-[#94a3b8] cursor-pointer'
              }`}
              title={
                netInfo.status === 'leina'
                  ? 'لا يمكن الشطب؛ الشخص متبقي عليه فلوس لينا'
                  : 'شطب القيد'
              }
            >
              <input
                type="checkbox"
                disabled={netInfo.status === 'leina'}
                checked={entry.crossed}
                onChange={(e) => {
                  if (netInfo.status === 'leina') return;
                  onUpdate(entry.id, { crossed: e.target.checked });
                }}
                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
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
