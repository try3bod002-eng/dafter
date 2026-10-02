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

const COMMON_HIS_OCCASIONS = ['فرحه', 'فرح ابنه', 'فرح بنته', 'سبوع', 'طهور', 'عقيقة', 'نجاح'];

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
  
  // For Receiving (Our occasions)
  const [ourOccasion, setOurOccasion] = useState<string>(
    entry.occasion || (currentOccasion && currentOccasion !== 'all' ? currentOccasion : (occasions[0]?.name || 'فرح أحمد'))
  );
  const [isCustomOurOccasion, setIsCustomOurOccasion] = useState<boolean>(false);
  const [customOurOccasionName, setCustomOurOccasionName] = useState<string>('');

  // For Paying (His occasion)
  const [hisOccasion, setHisOccasion] = useState<string>('فرح ابنه');
  const [offsetOurOccasion, setOffsetOurOccasion] = useState<string>(entry.occasion || occasions[0]?.name || '');

  const [actionTitle, setActionTitle] = useState<string>('رد واجب في مناسبته');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [selectedFilterOccasion, setSelectedFilterOccasion] = useState<string>('all');

  // Compute all effective transactions
  const transactions: LedgerTransaction[] = useMemo(() => {
    if (entry.transactions && entry.transactions.length > 0) {
      return entry.transactions;
    }
    const initialOcc = entry.occasion || (occasions[0]?.name ? occasions[0].name : 'مناسبتنا الأساسية');
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

  // Breakdown by Occasion (تفنيط المبالغ حسب مناسباتنا ومناسباته)
  const occasionBreakdown = useMemo(() => {
    const receivedMap = new Map<string, number>();
    const paidMap = new Map<string, number>();

    transactions.forEach((tx) => {
      const occName = tx.occasion?.trim() || 'عام';
      if (tx.type === 'received') {
        receivedMap.set(occName, (receivedMap.get(occName) || 0) + tx.amount);
      } else {
        paidMap.set(occName, (paidMap.get(occName) || 0) + tx.amount);
      }
    });

    return {
      receivedByOccasion: Array.from(receivedMap.entries()),
      paidByOccasion: Array.from(paidMap.entries()),
    };
  }, [transactions]);

  // Filtered transactions for timeline
  const displayedTransactions = useMemo(() => {
    if (selectedFilterOccasion === 'all') return transactions;
    return transactions.filter(
      (tx) => (tx.occasion?.trim() || 'عام') === selectedFilterOccasion
    );
  }, [transactions, selectedFilterOccasion]);

  // Handle adding a new transaction (Payment or Receipt)
  const handleAddTransaction = (type: 'paid' | 'received') => {
    const amt = parseFloat(actionAmount) || 0;
    if (amt <= 0) return;

    let chosenOccasion = '';
    let autoTitle = '';

    if (type === 'received') {
      chosenOccasion = isCustomOurOccasion ? customOurOccasionName.trim() : ourOccasion.trim();
      autoTitle = actionTitle.trim() || `نقطة مستلمة في ${chosenOccasion || 'مناسبتنا'}`;
    } else {
      chosenOccasion = hisOccasion.trim() || 'مناسبته';
      const offsetPart = offsetOurOccasion ? ` (عن ${offsetOurOccasion})` : '';
      autoTitle = actionTitle.trim() || `رد واجب في ${chosenOccasion}${offsetPart}`;
    }

    const newTx: LedgerTransaction = {
      id: `tx_${Date.now()}`,
      date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' }),
      type,
      amount: amt,
      title: autoTitle,
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
    setIsCustomOurOccasion(false);
    setCustomOurOccasionName('');
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
            📑 كشف الحساب
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('add_payment');
              setActionTitle(`رد واجب في ${hisOccasion || 'مناسبته'}`);
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
              const defaultOcc = ourOccasion || 'مناسبتنا';
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
          
          {/* ========================================================= */}
          {/* FORM: ADD PAYMENT (رد واجب - في مناسبته هو) */}
          {/* ========================================================= */}
          {activeTab === 'add_payment' && (
            <div className="bg-[#131d33]/90 border border-emerald-500/30 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-150">
              <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
                <span>🤝</span>
                <span>تسجيل رد واجب (دفعت له في مناسبته)</span>
              </h3>

              {/* 1. His Occasion (مناسبته هو) */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  مناسبته هو (اللي رديتله فيها الواجب):
                </label>
                <input
                  type="text"
                  value={hisOccasion}
                  onChange={(e) => {
                    setHisOccasion(e.target.value);
                    setActionTitle(`رد واجب في ${e.target.value || 'مناسبته'}`);
                  }}
                  className="w-full bg-[#080d18] border border-emerald-500/40 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-400"
                  placeholder="مثال: فرح ابنه أحمد، جوازته، سبوع بنته..."
                />

                {/* Quick suggestions */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[11px] text-slate-400 font-bold">اقتراحات سريعة:</span>
                  {COMMON_HIS_OCCASIONS.map((occ) => (
                    <button
                      key={occ}
                      type="button"
                      onClick={() => {
                        setHisOccasion(occ);
                        setActionTitle(`رد واجب في ${occ}`);
                      }}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border font-bold transition-colors cursor-pointer ${
                        hisOccasion === occ
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:border-emerald-400/50'
                      }`}
                    >
                      {occ}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  المبلغ المدفوع (جنيه):
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
                  className="w-full bg-[#080d18] border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-400"
                  placeholder="مثال: رد واجب في فرح ابنه أحمد"
                />
              </div>

              {/* 4. Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات إضافية (اختياري):</label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full bg-[#080d18] border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-emerald-400"
                  placeholder="أي تفاصيل خاصة..."
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleAddTransaction('paid')}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-500 shadow-md cursor-pointer transition-transform active:scale-95"
                >
                  ✓ تأكيد وحفظ رد الواجب
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

          {/* ========================================================= */}
          {/* FORM: ADD RECEIPT (استلمت منه - في مناسبتنا الخاصة بالدفتر) */}
          {/* ========================================================= */}
          {activeTab === 'add_receipt' && (
            <div className="bg-[#131d33]/90 border border-sky-500/30 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-150">
              <h3 className="text-sm font-black text-sky-400 flex items-center gap-2">
                <span>💰</span>
                <span>تسجيل استلام نقطة جديدة (في إحدى مناسباتنا)</span>
              </h3>

              {/* 1. Our Occasion Selector */}
              <div>
                <label className="block text-xs font-bold text-sky-300 mb-1.5 flex items-center gap-1">
                  <span>🎉</span>
                  <span>مناسبتنا المسجلة بالدفتر (التفنيط):</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={isCustomOurOccasion ? '__custom__' : ourOccasion}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomOurOccasion(true);
                      } else {
                        setIsCustomOurOccasion(false);
                        setOurOccasion(e.target.value);
                        setActionTitle(`نقطة مستلمة في ${e.target.value}`);
                      }
                    }}
                    className="w-full bg-[#080d18] border border-sky-400/40 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-sky-400"
                  >
                    {occasions.map((occ) => (
                      <option key={occ.id} value={occ.name}>
                        {occ.name}
                      </option>
                    ))}
                    {entry.occasion && !occasions.some((o) => o.name === entry.occasion) && (
                      <option value={entry.occasion}>{entry.occasion}</option>
                    )}
                    <option value="__custom__">➕ مناسبة أخرى جديدة لنا...</option>
                  </select>

                  {isCustomOurOccasion && (
                    <input
                      type="text"
                      value={customOurOccasionName}
                      onChange={(e) => {
                        setCustomOurOccasionName(e.target.value);
                        if (e.target.value) {
                          setActionTitle(`نقطة مستلمة في ${e.target.value}`);
                        }
                      }}
                      className="w-full bg-[#080d18] border border-sky-400/50 rounded-xl px-3 py-2 text-xs font-bold text-sky-200 outline-none focus:border-sky-400"
                      placeholder="اسم مناسبتنا الجديدة..."
                      autoFocus
                    />
                  )}
                </div>
              </div>

              {/* 2. Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  المبلغ المستلم (جنيه):
                </label>
                <input
                  type="number"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="w-full bg-[#080d18] border border-white/20 rounded-xl px-3 py-2.5 text-lg font-black text-sky-400 outline-none focus:border-sky-400"
                  placeholder="200"
                />
              </div>

              {/* 3. Title */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">بيان وتفاصيل النقطة:</label>
                <input
                  type="text"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  className="w-full bg-[#080d18] border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-sky-400"
                  placeholder="مثال: نقطة مستلمة في فرح أحمد"
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

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleAddTransaction('received')}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs text-white bg-gradient-to-r from-sky-600 to-cyan-500 shadow-md cursor-pointer transition-transform active:scale-95"
                >
                  ✓ تأكيد وحفظ النقطة وتفنيطها
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

          {/* ========================================================= */}
          {/* BREAKDOWN SECTION (تفنيط الحساب: وارد في مناسباتنا vs صادر في مناسباته) */}
          {/* ========================================================= */}
          <div className="bg-[#131d33]/50 border border-white/10 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs font-black text-sky-300">
              <span className="flex items-center gap-1.5">
                <span>📊</span>
                <span>تفنيط وتوزيع الحساب:</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {transactions.length} {transactions.length === 1 ? 'حركة' : 'حركات'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Box 1: Points Received in OUR Occasions */}
              <div className="bg-[#080d18]/70 border border-sky-500/20 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-sky-400 border-b border-white/5 pb-1.5">
                  <span className="flex items-center gap-1">
                    <span>📥</span>
                    <span>استلمنا منه (في مناسباتنا):</span>
                  </span>
                  <span className="font-mono text-white">
                    {occasionBreakdown.receivedByOccasion.reduce((s, [, a]) => s + a, 0).toLocaleString()} ج
                  </span>
                </div>
                
                {occasionBreakdown.receivedByOccasion.length === 0 ? (
                  <div className="text-[11px] text-slate-500 font-semibold py-1">لا يوجد نقاط واردة</div>
                ) : (
                  <div className="space-y-1.5 pt-0.5">
                    {occasionBreakdown.receivedByOccasion.map(([occ, amt]) => (
                      <div
                        key={occ}
                        onClick={() => setSelectedFilterOccasion(selectedFilterOccasion === occ ? 'all' : occ)}
                        className={`flex items-center justify-between text-xs p-1.5 rounded-lg transition-colors cursor-pointer ${
                          selectedFilterOccasion === occ
                            ? 'bg-sky-500/20 text-white font-black'
                            : 'hover:bg-white/5 text-slate-300 font-bold'
                        }`}
                      >
                        <span className="truncate">🎉 {occ}</span>
                        <span className="text-sky-300 font-black">{amt.toLocaleString()} ج</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Box 2: Payments made in HIS Occasions */}
              <div className="bg-[#080d18]/70 border border-emerald-500/20 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-emerald-400 border-b border-white/5 pb-1.5">
                  <span className="flex items-center gap-1">
                    <span>📤</span>
                    <span>دفعنا له (في مناسباته):</span>
                  </span>
                  <span className="font-mono text-white">
                    {occasionBreakdown.paidByOccasion.reduce((s, [, a]) => s + a, 0).toLocaleString()} ج
                  </span>
                </div>

                {occasionBreakdown.paidByOccasion.length === 0 ? (
                  <div className="text-[11px] text-slate-500 font-semibold py-1">لم نرد الواجب بعد</div>
                ) : (
                  <div className="space-y-1.5 pt-0.5">
                    {occasionBreakdown.paidByOccasion.map(([occ, amt]) => (
                      <div
                        key={occ}
                        onClick={() => setSelectedFilterOccasion(selectedFilterOccasion === occ ? 'all' : occ)}
                        className={`flex items-center justify-between text-xs p-1.5 rounded-lg transition-colors cursor-pointer ${
                          selectedFilterOccasion === occ
                            ? 'bg-emerald-500/20 text-white font-black'
                            : 'hover:bg-white/5 text-slate-300 font-bold'
                        }`}
                      >
                        <span className="truncate">🤝 {occ}</span>
                        <span className="text-emerald-400 font-black">{amt.toLocaleString()} ج</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedFilterOccasion !== 'all' && (
              <div className="flex items-center justify-between text-[11px] font-bold text-sky-300 pt-1">
                <span>تصفية الحركات: {selectedFilterOccasion}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFilterOccasion('all')}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  إظهار كل الحركات
                </button>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* TIMELINE / STATEMENT LIST */}
          {/* ========================================================= */}
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
                        <span className={`px-1.5 py-0.2 rounded-md font-bold border ${
                          tx.type === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                        }`}>
                          {tx.type === 'paid' ? 'مناسبته:' : 'مناسبتنا:'} {tx.occasion}
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
