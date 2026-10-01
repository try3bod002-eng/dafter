'use client';

import React, { useState } from 'react';
import { LedgerEntry, LedgerTransaction, calculateNetBalance } from '@/types/ledger';

interface StatementModalProps {
  entry: LedgerEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveEntry: (updatedEntry: LedgerEntry) => void;
}

export default function StatementModal({
  entry,
  isOpen,
  onClose,
  onSaveEntry,
}: StatementModalProps) {
  if (!isOpen || !entry) return null;

  const netInfo = calculateNetBalance(entry);

  const [activeTab, setActiveTab] = useState<'view' | 'add_payment' | 'add_receipt'>('view');
  const [actionAmount, setActionAmount] = useState<string>(
    netInfo.status === 'alina' && netInfo.netAmount > 0 ? String(netInfo.netAmount) : '200'
  );
  const [actionTitle, setActionTitle] = useState<string>('رد واجب في مناسبته');
  const [actionNotes, setActionNotes] = useState<string>('');

  // Handle adding a new transaction (Payment or Receipt)
  const handleAddTransaction = (type: 'paid' | 'received') => {
    const amt = parseFloat(actionAmount) || 0;
    if (amt <= 0) return;

    const newTx: LedgerTransaction = {
      id: `tx_${Date.now()}`,
      date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' }),
      type,
      amount: amt,
      title: actionTitle.trim() || (type === 'paid' ? 'رد واجب' : 'نقطة مستلمة'),
      notes: actionNotes.trim() || undefined,
    };

    // Calculate existing transactions or initialize from current entry
    const existingTxs: LedgerTransaction[] = entry.transactions && entry.transactions.length > 0
      ? [...entry.transactions]
      : [
          {
            id: `tx_initial_${entry.id}`,
            date: entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('ar-EG') : 'يوم الفرح',
            type: 'received',
            amount: entry.receivedAmount ?? entry.amount ?? 0,
            title: 'نقطة مستلمة في فرحنا',
            notes: entry.notes || undefined,
          },
        ];

    const updatedTxs = [newTx, ...existingTxs];
    const totalPaid = updatedTxs.filter((t) => t.type === 'paid').reduce((s, t) => s + t.amount, 0);
    const totalRec = updatedTxs.filter((t) => t.type === 'received').reduce((s, t) => s + t.amount, 0);

    // If fully paid or more
    const isCrossed = totalPaid >= totalRec;

    const updatedEntry: LedgerEntry = {
      ...entry,
      paidAmount: totalPaid,
      receivedAmount: totalRec,
      crossed: isCrossed,
      transactions: updatedTxs,
      updatedAt: new Date().toISOString(),
    };

    onSaveEntry(updatedEntry);
    setActiveTab('view');
    setActionNotes('');
  };

  const transactions: LedgerTransaction[] = entry.transactions && entry.transactions.length > 0
    ? entry.transactions
    : [
        {
          id: `tx_initial_${entry.id}`,
          date: entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('ar-EG') : 'يوم الفرح',
          type: 'received',
          amount: entry.receivedAmount ?? entry.amount ?? 0,
          title: 'نقطة مستلمة في فرحنا',
          notes: entry.notes || undefined,
        },
      ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border-2 border-sky-400/40 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-[#1e293b]/50 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg sm:text-xl font-black text-white truncate">
                {entry.name}
              </h2>
              {entry.nickname && (
                <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-black px-2 py-0.5 rounded-lg">
                  ({entry.nickname})
                </span>
              )}
              {entry.location && (
                <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                  📍 {entry.location}
                </span>
              )}
            </div>

            {/* Current Net Balance Badge */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">حالة الحساب:</span>
              <span
                className={`text-xs font-black px-3 py-1 rounded-xl border shadow-sm ${
                  netInfo.status === 'khalis'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                    : netInfo.status === 'alina'
                    ? 'bg-amber-950/80 text-amber-400 border-amber-500/40 animate-pulse'
                    : 'bg-sky-950/80 text-sky-400 border-sky-500/40'
                }`}
              >
                {netInfo.label}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Action Toggle Bar */}
        <div className="flex border-b border-white/10 bg-[#090d16]/60 p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'view'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📑 كشف الحساب
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('add_payment');
              setActionTitle('رد واجب في مناسبته');
              if (netInfo.status === 'alina' && netInfo.netAmount > 0) {
                setActionAmount(String(netInfo.netAmount));
              }
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'add_payment'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-emerald-950/40 text-emerald-400 hover:bg-emerald-950/70 border border-emerald-500/30'
            }`}
          >
            <span>🤝</span>
            <span>رد الواجب (دفعت له)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('add_receipt');
              setActionTitle('نقطة إضافية مستلمة');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'add_receipt'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'bg-sky-950/40 text-sky-400 hover:bg-sky-950/70 border border-sky-500/30'
            }`}
          >
            <span>💰</span>
            <span>استلمت منه</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          
          {/* Form to Add Payment / Receipt */}
          {activeTab !== 'view' && (
            <div className="bg-[#1e293b]/80 border border-white/10 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>{activeTab === 'add_payment' ? '🤝 تسجيل رد واجب (دفعت له)' : '💰 تسجيل استلام نقطة جديدة'}</span>
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ المدفوع (جنيه):</label>
                <input
                  type="number"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="w-full bg-[#090d16] border border-white/20 rounded-xl px-3 py-2 text-base font-black text-emerald-400 outline-none focus:border-emerald-400"
                  placeholder="200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">بيان الحركة / المناسبة:</label>
                <input
                  type="text"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  className="w-full bg-[#090d16] border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-sky-400"
                  placeholder="مثال: نقطته في فرح ابنه أحمد"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات إضافية (اختياري):</label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full bg-[#090d16] border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-sky-400"
                  placeholder="ملاحظات..."
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleAddTransaction(activeTab === 'add_payment' ? 'paid' : 'received')}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs text-white shadow-md cursor-pointer transition-transform active:scale-95 ${
                    activeTab === 'add_payment'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
                      : 'bg-gradient-to-r from-sky-600 to-cyan-500'
                  }`}
                >
                  ✓ تأكيد وحفظ الحركة
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('view')}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Timeline / Statement List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
              <span>سجل المعاملات والتواريخ</span>
              <span>عدد الحركات: {transactions.length}</span>
            </div>

            {transactions.map((tx) => (
              <div
                key={tx.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                  tx.type === 'paid'
                    ? 'bg-emerald-950/25 border-emerald-500/30'
                    : 'bg-sky-950/25 border-sky-500/30'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                      tx.type === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
                    }`}
                  >
                    {tx.type === 'paid' ? '🤝' : '💰'}
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">{tx.title}</div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      {tx.date} {tx.notes ? `• ${tx.notes}` : ''}
                    </div>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span
                    className={`text-sm sm:text-base font-black ${
                      tx.type === 'paid' ? 'text-emerald-400' : 'text-sky-400'
                    }`}
                  >
                    {tx.type === 'paid' ? '-' : '+'}
                    {tx.amount.toLocaleString('en-US')} ج
                  </span>
                  <div className="text-[9px] font-bold text-slate-500">
                    {tx.type === 'paid' ? 'رد واجب (صادر)' : 'نقطة (وارد)'}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-[#1e293b]/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
}
