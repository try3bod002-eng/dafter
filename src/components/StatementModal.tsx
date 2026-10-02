'use client';

import React, { useState, useMemo } from 'react';
import { LedgerEntry, LedgerTransaction, OccasionItem, calculateNetBalance } from '@/types/ledger';

interface StatementModalProps {
  entry: LedgerEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveEntry: (updatedEntry: LedgerEntry) => void;
  occasions?: OccasionItem[];
  currentOccasion?: string;
}

export default function StatementModal({
  entry,
  isOpen,
  onClose,
  onSaveEntry,
  occasions = [],
  currentOccasion,
}: StatementModalProps) {
  if (!isOpen || !entry) return null;

  const netInfo = calculateNetBalance(entry);

  const [activeTab, setActiveTab] = useState<'view' | 'add_payment' | 'add_receipt'>('view');
  const [actionAmount, setActionAmount] = useState<string>(
    netInfo.status === 'alina' && netInfo.netAmount > 0 ? String(netInfo.netAmount) : '200'
  );
  const [actionTitle, setActionTitle] = useState<string>('رد واجب في مناسبته');
  const [actionOccasion, setActionOccasion] = useState<string>(
    entry.occasion || (currentOccasion && currentOccasion !== 'all' ? currentOccasion : (occasions[0]?.name || 'فرح أحمد'))
  );
  const [isCustomOccasion, setIsCustomOccasion] = useState<boolean>(false);
  const [customOccasionName, setCustomOccasionName] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [selectedFilterOccasion, setSelectedFilterOccasion] = useState<string>('all');

  // Compute all effective transactions
  const transactions: LedgerTransaction[] = useMemo(() => {
    if (entry.transactions && entry.transactions.length > 0) {
      return entry.transactions;
    }
    const initialOcc = entry.occasion || (occasions[0]?.name ? occasions[0].name : 'المناسبة الأساسية');
    return [
      {
        id: `tx_initial_${entry.id}`,
        date: entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('ar-EG') : 'يوم المناسبة',
        type: 'received',
        amount: entry.receivedAmount ?? entry.amount ?? 0,
        title: `نقطة مستلمة في ${initialOcc}`,
        occasion: initialOcc,
        notes: entry.notes || undefined,
      },
    ];
  }, [entry, occasions]);

  // Breakdown by Occasion (تفنيط المبالغ حسب كل مناسبة)
  const occasionBreakdown = useMemo(() => {
    const map = new Map<string, { received: number; paid: number; transactionsCount: number }>();

    transactions.forEach((tx) => {
      const occName = tx.occasion?.trim() || entry.occasion?.trim() || 'مناسبة عامة';
      const current = map.get(occName) || { received: 0, paid: 0, transactionsCount: 0 };
      if (tx.type === 'received') {
        current.received += tx.amount;
      } else {
        current.paid += tx.amount;
      }
      current.transactionsCount += 1;
      map.set(occName, current);
    });

    return Array.from(map.entries()).map(([name, data]) => {
      const balance = data.received - data.paid;
      let status: 'khalis' | 'alina' | 'leina' = 'khalis';
      let statusLabel = 'خالص ✓';

      if (balance > 0) {
        status = 'alina';
        statusLabel = `واجب علينا: ${balance} ج`;
      } else if (balance < 0) {
        status = 'leina';
        statusLabel = `باقي لينا: ${Math.abs(balance)} ج`;
      }

      return {
        name,
        received: data.received,
        paid: data.paid,
        balance,
        status,
        statusLabel,
        transactionsCount: data.transactionsCount,
      };
    });
  }, [transactions, entry.occasion]);

  // Filtered transactions for timeline
  const displayedTransactions = useMemo(() => {
    if (selectedFilterOccasion === 'all') return transactions;
    return transactions.filter(
      (tx) => (tx.occasion?.trim() || entry.occasion?.trim() || 'مناسبة عامة') === selectedFilterOccasion
    );
  }, [transactions, selectedFilterOccasion, entry.occasion]);

  // Handle adding a new transaction (Payment or Receipt)
  const handleAddTransaction = (type: 'paid' | 'received') => {
    const amt = parseFloat(actionAmount) || 0;
    if (amt <= 0) return;

    const chosenOccasion = isCustomOccasion ? customOccasionName.trim() : actionOccasion.trim();

    const newTx: LedgerTransaction = {
      id: `tx_${Date.now()}`,
      date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' }),
      type,
      amount: amt,
      title: actionTitle.trim() || (type === 'paid' ? `رد واجب في ${chosenOccasion || 'مناسبته'}` : `نقطة مستلمة في ${chosenOccasion || 'مناسبتنا'}`),
      occasion: chosenOccasion || undefined,
      notes: actionNotes.trim() || undefined,
    };

    const updatedTxs = [newTx, ...transactions];
    const totalPaid = updatedTxs.filter((t) => t.type === 'paid').reduce((s, t) => s + t.amount, 0);
    const totalRec = updatedTxs.filter((t) => t.type === 'received').reduce((s, t) => s + t.amount, 0);

    const isCrossed = totalPaid === totalRec;

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
    setIsCustomOccasion(false);
    setCustomOccasionName('');
  };

  // Delete a specific transaction
  const handleDeleteTransaction = (txId: string) => {
    if (!confirm('هل تريد حذف هذه الحركة من كشف الحساب؟')) return;

    const updatedTxs = transactions.filter((t) => t.id !== txId);
    const totalPaid = updatedTxs.filter((t) => t.type === 'paid').reduce((s, t) => s + t.amount, 0);
    const totalRec = updatedTxs.filter((t) => t.type === 'received').reduce((s, t) => s + t.amount, 0);
    const isCrossed = totalPaid === totalRec;

    const updatedEntry: LedgerEntry = {
      ...entry,
      paidAmount: totalPaid,
      receivedAmount: totalRec,
      crossed: isCrossed,
      transactions: updatedTxs,
      updatedAt: new Date().toISOString(),
    };

    onSaveEntry(updatedEntry);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b1220] border-2 border-sky-500/30 rounded-3xl max-w-lg w-full max-h-[94vh] flex flex-col shadow-2xl text-white overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-[#131d33] flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
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

            {/* Current Overall Net Balance Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-bold">الرصيد الإجمالي:</span>
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
        <div className="flex border-b border-white/10 bg-[#080d18] p-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'view'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📑 كشف الحساب والتفنيط
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('add_payment');
              const defaultOcc = actionOccasion || 'مناسبته';
              setActionTitle(`رد واجب في ${defaultOcc}`);
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
            <span>رد الواجب (دفعت له)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('add_receipt');
              const defaultOcc = actionOccasion || 'مناسبتنا';
              setActionTitle(`نقطة مستلمة في ${defaultOcc}`);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'add_receipt'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'bg-sky-950/40 text-sky-400 hover:bg-sky-950/70 border border-sky-500/30'
            }`}
          >
            <span>استلمت منه</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4">
          
          {/* Form to Add Payment / Receipt */}
          {activeTab !== 'view' && (
            <div className="bg-[#131d33]/90 border border-white/10 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-150">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>{activeTab === 'add_payment' ? '🤝 تسجيل رد واجب (دفعت له)' : '💰 تسجيل استلام نقطة جديدة'}</span>
              </h3>

              {/* 1. Occasion Selector (تفنيط حسب المناسبة) */}
              <div>
                <label className="block text-xs font-bold text-sky-300 mb-1.5 flex items-center gap-1">
                  <span>🎉</span>
                  <span>المناسبة التابعة للحركة (التفنيط):</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={isCustomOccasion ? '__custom__' : actionOccasion}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomOccasion(true);
                      } else {
                        setIsCustomOccasion(false);
                        setActionOccasion(e.target.value);
                        if (activeTab === 'add_payment') {
                          setActionTitle(`رد واجب في ${e.target.value}`);
                        } else {
                          setActionTitle(`نقطة مستلمة في ${e.target.value}`);
                        }
                      }
                    }}
                    className="w-full bg-[#080d18] border border-white/20 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-sky-400"
                  >
                    {/* Occasions list */}
                    {occasions.map((occ) => (
                      <option key={occ.id} value={occ.name}>
                        {occ.name}
                      </option>
                    ))}
                    {entry.occasion && !occasions.some((o) => o.name === entry.occasion) && (
                      <option value={entry.occasion}>{entry.occasion}</option>
                    )}
                    <option value="__custom__">➕ مناسبة أخرى جديدة...</option>
                  </select>

                  {isCustomOccasion && (
                    <input
                      type="text"
                      value={customOccasionName}
                      onChange={(e) => {
                        setCustomOccasionName(e.target.value);
                        if (e.target.value) {
                          if (activeTab === 'add_payment') {
                            setActionTitle(`رد واجب في ${e.target.value}`);
                          } else {
                            setActionTitle(`نقطة مستلمة في ${e.target.value}`);
                          }
                        }
                      }}
                      className="w-full bg-[#080d18] border border-sky-400/50 rounded-xl px-3 py-2 text-xs font-bold text-sky-200 outline-none focus:border-sky-400"
                      placeholder="اكتب اسم المناسبة (مثال: فرح ابنه محمد)"
                      autoFocus
                    />
                  )}
                </div>
              </div>

              {/* 2. Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {activeTab === 'add_payment' ? 'المبلغ المدفوع (جنيه):' : 'المبلغ المستلم (جنيه):'}
                </label>
                <input
                  type="number"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="w-full bg-[#080d18] border border-white/20 rounded-xl px-3 py-2.5 text-lg font-black text-emerald-400 outline-none focus:border-emerald-400"
                  placeholder="200"
                />
              </div>

              {/* 3. Title / Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">بيان وتفاصيل الحركة:</label>
                <input
                  type="text"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  className="w-full bg-[#080d18] border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-sky-400"
                  placeholder="مثال: نقطته في فرح ابنه أحمد"
                />
              </div>

              {/* 4. Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات إضافية (اختياري):</label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full bg-[#080d18] border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-sky-400"
                  placeholder="أي تفاصيل خاصة..."
                />
              </div>

              {/* Confirm / Cancel Buttons */}
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
                  ✓ تأكيد وحفظ الحركة وتفنيطها
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

          {/* Section: Breakdown by Occasion (تفنيط الحساب حسب المناسبات) */}
          <div className="bg-[#131d33]/50 border border-white/10 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-black text-sky-300">
              <span className="flex items-center gap-1.5">
                <span>📊</span>
                <span>تفنيط الحساب حسب كل مناسبة:</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {occasionBreakdown.length} {occasionBreakdown.length === 1 ? 'مناسبة' : 'مناسبات'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {occasionBreakdown.map((item) => (
                <div
                  key={item.name}
                  onClick={() => setSelectedFilterOccasion(selectedFilterOccasion === item.name ? 'all' : item.name)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    selectedFilterOccasion === item.name
                      ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400/50'
                      : 'bg-[#080d18]/60 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-xs font-black text-white truncate flex items-center gap-1">
                      <span>🎉</span>
                      <span>{item.name}</span>
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                        item.status === 'khalis'
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
                          : item.status === 'alina'
                          ? 'bg-amber-950/80 text-amber-400 border-amber-500/30'
                          : 'bg-sky-950/80 text-sky-400 border-sky-500/30'
                      }`}
                    >
                      {item.statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pt-1 border-t border-white/5">
                    <span>
                      وارد: <strong className="text-sky-300">{item.received} ج</strong>
                    </span>
                    <span>
                      صادر: <strong className="text-emerald-400">{item.paid} ج</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {selectedFilterOccasion !== 'all' && (
              <div className="flex items-center justify-between text-[11px] font-bold text-sky-300 pt-1">
                <span>تصفية الحركات: {selectedFilterOccasion}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFilterOccasion('all')}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  عرض جميع المناسبات
                </button>
              </div>
            )}
          </div>

          {/* Section: Timeline / Statement List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
              <span>سجل المعاملات والتواريخ</span>
              <span>عدد الحركات: {displayedTransactions.length}</span>
            </div>

            {displayedTransactions.map((tx) => (
              <div
                key={tx.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                  tx.type === 'paid'
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-sky-950/20 border-sky-500/30'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                      tx.type === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
                    }`}
                  >
                    {tx.type === 'paid' ? '🤝' : '💰'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-white truncate">{tx.title}</div>
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400 font-semibold mt-0.5">
                      <span>{tx.date}</span>
                      {tx.occasion && (
                        <span className="bg-white/10 text-sky-300 border border-white/10 px-1.5 py-0.2 rounded-md font-bold">
                          🎉 {tx.occasion}
                        </span>
                      )}
                      {tx.notes && <span>• {tx.notes}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-left">
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

                  {/* Delete individual transaction (if not the sole initial) */}
                  {transactions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTransaction(tx.id)}
                      title="حذف هذه الحركة"
                      className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs transition-colors cursor-pointer"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-[#131d33]/50 flex justify-end">
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
