'use client';

import React, { useState } from 'react';

interface ManualAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    nickname?: string;
    amount: number;
    location: string;
    notes: string;
  }) => void;
}

export default function ManualAddModal({ isOpen, onClose, onSubmit }: ManualAddModalProps) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [amount, setAmount] = useState<string>('200');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('يرجى كتابة اسم الشخص أولاً');
      return;
    }
    onSubmit({
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      amount: parseFloat(amount) || 0,
      location: location.trim(),
      notes: notes.trim(),
    });
    setName('');
    setNickname('');
    setAmount('200');
    setLocation('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0f172a] border border-[#1e293d] rounded-3xl p-6 w-full max-w-md shadow-2xl text-white animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <span>➕</span>
            <span>إضافة قيد جديد يدوياً</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Name & Nickname row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم الشخص *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: أشرف الحديدي"
                className="w-full bg-[#111827] border border-[#1f293d] rounded-xl px-3.5 py-2.5 text-sm font-bold text-white outline-none focus:border-sky-400 transition-all placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اللقب / الشهرة (اختياري)</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="مثال: أبو طارق"
                className="w-full bg-[#111827] border border-[#1f293d] rounded-xl px-3.5 py-2.5 text-sm font-bold text-sky-400 outline-none focus:border-sky-400 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Amount & Location row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ (ج.م) *</label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="200"
                className="w-full bg-[#111827] border border-[#1f293d] rounded-xl px-3.5 py-2.5 text-sm font-bold text-emerald-400 outline-none focus:border-emerald-400 transition-all placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">البلد / القرية</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: شربين"
                className="w-full bg-[#111827] border border-[#1f293d] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white outline-none focus:border-sky-400 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">الملاحظات والتسوية</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: كان عليه 300 وعلينا 500"
              className="w-full bg-[#111827] border border-[#1f293d] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white outline-none focus:border-sky-400 transition-all placeholder:text-slate-600"
            />
          </div>

          <div className="flex gap-2.5 mt-2">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold py-2.5 px-4 rounded-xl text-sm transition-all cursor-pointer shadow-md"
            >
              ✓ حفظ في الدفتر
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-white/10 hover:bg-white/15 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-sm transition-all cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
