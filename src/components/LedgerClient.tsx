'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import EntryCard from '@/components/EntryCard';
import VoiceInputBar from '@/components/VoiceInputBar';
import ManualAddModal from '@/components/ManualAddModal';
import StatementModal from '@/components/StatementModal';
import { LedgerEntry, LedgerStats, OccasionItem, calculateNetBalance } from '@/types/ledger';
import { matchesArabicSearch, extractCleanTranscript, cleanSearchQuery } from '@/lib/speechParser';
import SidebarDrawer from '@/components/SidebarDrawer';
import OccasionChipsBar from '@/components/OccasionChipsBar';

const LOCAL_STORAGE_DB_KEY = 'daftr_nuqta_live_db_v5';
const LOCAL_STORAGE_OCCASIONS_KEY = 'daftr_occasions_v1';

const DEFAULT_OCCASIONS: OccasionItem[] = [
  { id: '1', name: 'فرح أحمد', createdAt: new Date().toISOString() },
  { id: '2', name: 'سبوع مريم', createdAt: new Date().toISOString() },
];

interface LedgerClientProps {
  initialEntries: LedgerEntry[];
  initialStats: LedgerStats;
}

export default function LedgerClient({ initialEntries, initialStats }: LedgerClientProps) {
  const [entries, setEntries] = useState<LedgerEntry[]>(initialEntries);
  const [stats, setStats] = useState<LedgerStats>(initialStats);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'crossed' | 'settlements'>('all');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drawer / Navigation Bar (3 bars) State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Occasions / Collections State
  const [occasions, setOccasions] = useState<OccasionItem[]>(DEFAULT_OCCASIONS);
  const [selectedOccasion, setSelectedOccasion] = useState<string>('all');

  // Statement / Ledger Profile Modal State
  const [selectedStatementEntry, setSelectedStatementEntry] = useState<LedgerEntry | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Sort Order State: 'desc' (newest first) or 'asc' (oldest first)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Voice Search State
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const searchRecRef = useRef<any>(null);

  // Central Database Sync: Live synchronization with SQLite database (unified across all devices)
  useEffect(() => {
    calculateAndSetStats(initialEntries);

    const refreshFromDb = () => {
      fetch('/api/entries')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.entries)) {
            setEntries(data.entries);
            calculateAndSetStats(data.entries);
          }
        })
        .catch(() => {});
    };

    refreshFromDb();
    window.addEventListener('focus', refreshFromDb);

    // Load saved occasions
    try {
      const savedOccs = localStorage.getItem(LOCAL_STORAGE_OCCASIONS_KEY);
      if (savedOccs) {
        const parsedOccs = JSON.parse(savedOccs);
        if (Array.isArray(parsedOccs) && parsedOccs.length > 0) {
          setOccasions(parsedOccs);
        }
      } else {
        localStorage.setItem(LOCAL_STORAGE_OCCASIONS_KEY, JSON.stringify(DEFAULT_OCCASIONS));
      }
    } catch (e) {
      console.error('Error loading occasions:', e);
    }

    return () => window.removeEventListener('focus', refreshFromDb);
  }, [initialEntries]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  const calculateAndSetStats = (currentEntries: LedgerEntry[]) => {
    const totalCount = currentEntries.length;
    const totalAmount = currentEntries.reduce(
      (sum, e) => sum + (Number(e.receivedAmount ?? e.amount) || 0),
      0
    );

    let crossedCount = 0;
    let totalCrossedAmount = 0;
    let totalPaidAmount = 0;
    let totalAlinaAmount = 0;
    let totalLeinaAmount = 0;
    let settlementsCount = 0;

    currentEntries.forEach((e) => {
      let paid = Number(e.paidAmount) || 0;
      if (e.transactions && e.transactions.length > 0) {
        paid = e.transactions
          .filter((t) => t.type === 'paid')
          .reduce((sum, t) => sum + t.amount, 0);
      }
      totalPaidAmount += paid;

      const net = calculateNetBalance(e);
      if (net.status === 'khalis' || e.crossed) {
        crossedCount++;
        totalCrossedAmount += (Number(e.paidAmount ?? e.amount) || 0);
      } else if (net.status === 'alina') {
        settlementsCount++;
        totalAlinaAmount += net.netAmount;
      } else if (net.status === 'leina') {
        totalLeinaAmount += net.netAmount;
      }
    });

    const activeCount = totalCount - crossedCount;

    setStats({
      totalCount,
      totalAmount,
      totalPaidAmount,
      crossedCount,
      activeCount,
      settlementsCount,
      totalCrossedAmount,
      totalAlinaAmount,
      totalLeinaAmount,
    });
  };

  const updateLocalList = (newEntries: LedgerEntry[]) => {
    setEntries(newEntries);
    calculateAndSetStats(newEntries);
  };

  // Add Handler - Saves to SQLite database directly
  const handleAddNewEntry = async (newEntryData: {
    name: string;
    nickname?: string;
    occasion?: string;
    amount: number;
    location: string;
    notes: string;
    crossed?: boolean;
  }) => {
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEntryData,
          occasion: newEntryData.occasion || (selectedOccasion !== 'all' ? selectedOccasion : undefined),
        }),
      });
      const data = await res.json();
      if (data.success && data.entry) {
        const updated = [data.entry, ...entries.filter((e) => e.id !== data.entry.id)];
        updateLocalList(updated);
        showToast(`✔ تم الحفظ في قاعدة البيانات: "${data.entry.name}" (${data.entry.amount} ج)`);
        return;
      }
    } catch (e) {
      console.error('Error saving to SQLite:', e);
    }

    // Fallback optimistic
    const maxId = entries.reduce((max, e) => (e.id > max ? e.id : max), 0);
    const newEntry: LedgerEntry = {
      id: maxId + 1,
      name: newEntryData.name.trim(),
      nickname: newEntryData.nickname?.trim() || undefined,
      occasion: newEntryData.occasion || (selectedOccasion !== 'all' ? selectedOccasion : undefined),
      amount: Number(newEntryData.amount) || 0,
      receivedAmount: Number(newEntryData.amount) || 0,
      paidAmount: 0,
      location: (newEntryData.location || '').trim(),
      notes: (newEntryData.notes || '').trim(),
      crossed: !!newEntryData.crossed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newEntry, ...entries];
    updateLocalList(updated);
    showToast(`✔ تم الحفظ: "${newEntry.name}" (${newEntry.amount} ج)`);
  };

  const handleAddOccasion = (name: string) => {
    const newOcc: OccasionItem = {
      id: Date.now().toString(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...occasions, newOcc];
    setOccasions(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_OCCASIONS_KEY, JSON.stringify(updated));
    } catch {}
    setSelectedOccasion(newOcc.name);
    showToast(`🎉 تم إضافة مناسبة جديدة: "${newOcc.name}"`);
  };

  const handleDeleteOccasion = (id: string) => {
    const updated = occasions.filter((o) => o.id !== id);
    setOccasions(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_OCCASIONS_KEY, JSON.stringify(updated));
    } catch {}
    if (selectedOccasion !== 'all' && !updated.find((o) => o.name === selectedOccasion)) {
      setSelectedOccasion('all');
    }
    showToast('🗑️ تم حذف المناسبة');
  };

  const handleImportJson = async (imported: LedgerEntry[]) => {
    updateLocalList(imported);
    showToast(`✔ تم استيراد واسترجاع ${imported.length} قيد بنجاح!`);
    // Sync each to server
    for (const item of imported) {
      try {
        await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      } catch {}
    }
  };

  // Update Handler - Syncs to SQLite directly
  const handleUpdateEntry = async (id: number, updatedFields: Partial<LedgerEntry>) => {
    const updatedList = entries.map((item) => {
      if (item.id === id) {
        return { ...item, ...updatedFields, updatedAt: new Date().toISOString() };
      }
      return item;
    });

    updateLocalList(updatedList);

    // Keep selected statement modal in sync
    if (selectedStatementEntry && selectedStatementEntry.id === id) {
      setSelectedStatementEntry({ ...selectedStatementEntry, ...updatedFields });
    }

    try {
      await fetch(`/api/entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
    } catch (e) {
      console.error('Error updating in SQLite:', e);
    }
  };

  // Save updated entry from Statement Modal
  const handleSaveStatementEntry = (updatedEntry: LedgerEntry) => {
    handleUpdateEntry(updatedEntry.id, updatedEntry);
    setSelectedStatementEntry(updatedEntry);
    showToast(`✔ تم حفظ كشف حساب: ${updatedEntry.name} في قاعدة البيانات`);
  };

  // Delete Handler - Permanently deletes from SQLite
  const handleDeleteEntry = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الاسم نهائياً من قاعدة البيانات؟')) return;
    const updatedList = entries.filter((item) => item.id !== id);
    updateLocalList(updatedList);
    showToast('تم الحذف من قاعدة البيانات');

    try {
      await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Error deleting from SQLite:', e);
    }
  };

  // Voice Search inside Search Box (with smart deduplication)
  const toggleVoiceSearch = () => {
    if (isVoiceSearching) {
      if (searchRecRef.current) {
        try { searchRecRef.current.stop(); } catch {}
      }
      setIsVoiceSearching(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('متصفحك لا يدعم التعرف الصوتي المباشر. يُفضل استخدام متصفح Google Chrome.');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'ar-EG';
      rec.continuous = false;
      rec.interimResults = true;

      setIsVoiceSearching(true);

      rec.onresult = (e: any) => {
        const fullSentence = extractCleanTranscript(e.results);
        const cleaned = cleanSearchQuery(fullSentence);

        if (cleaned) {
          setSearchQuery(cleaned);
        }
      };

      rec.onerror = (e: any) => {
        console.warn('Voice search error:', e.error);
        setIsVoiceSearching(false);
      };

      rec.onend = () => {
        setIsVoiceSearching(false);
      };

      rec.start();
      searchRecRef.current = rec;
    } catch (err) {
      console.error('Failed to start voice search:', err);
      setIsVoiceSearching(false);
    }
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(entries, null, 2);
    navigator.clipboard
      .writeText(jsonStr)
      .then(() => {
        showToast('✔ تم نسخ بيانات الداتابيز للحافظة!');
      })
      .catch(() => {
        prompt('انسخ كود البيانات:', jsonStr);
      });
  };

  // Smart Arabic Search Filter (normalizes hamzas, yaa/alif maqsura, taa marbuta, and matches all words)
  const filteredEntries = entries.filter((item) => {
    // When NOT searching, filter by active occasion/collection.
    // When the user IS searching, search across the entire notebook so no one is missed!
    if (!searchQuery.trim() && selectedOccasion !== 'all') {
      const itemOcc = item.occasion || 'عام';
      if (itemOcc !== selectedOccasion && (selectedOccasion !== 'عام' || item.occasion)) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const targetText = `${item.name} ${item.nickname || ''} ${item.location} ${item.notes} ${item.occasion || ''}`;
      if (!matchesArabicSearch(targetText, searchQuery)) return false;
    }

    const net = calculateNetBalance(item);
    if (statusFilter === 'pending') return net.status !== 'khalis' && !item.crossed;
    if (statusFilter === 'crossed') return net.status === 'khalis' || item.crossed;
    if (statusFilter === 'settlements') {
      return net.status === 'alina' || net.netAmount > 0;
    }
    return true;
  });

  // Sort entries: 'desc' = newest/top first (id high to low), 'asc' = oldest first (id low to high)
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    return sortOrder === 'desc' ? b.id - a.id : a.id - b.id;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-[#f8fafc] pb-64">
      {/* Top Header with 3 Bars */}
      <Header
        totalCount={stats.totalCount}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        currentOccasionName={selectedOccasion}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-4 sm:pt-6">
        {/* Quick Stats Grid */}
        <StatsCards stats={stats} />

        {/* Occasions / Collections Quick Bar */}
        <div className="mb-3">
          <OccasionChipsBar
            occasions={occasions}
            selectedOccasion={selectedOccasion}
            onSelectOccasion={(occ) => setSelectedOccasion(occ)}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            entries={entries}
          />
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-4 flex flex-col gap-2.5">
          {/* Search Input with Integrated Voice Search */}
          <div className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isVoiceSearching
                  ? 'بيسمعك الآن... انطق اسم الشخص أو البلد...'
                  : 'ابحث بالاسم أو البلد...'
              }
              className={`w-full bg-[#111827] border rounded-2xl py-3 pr-11 pl-24 text-sm font-bold text-white outline-none transition-all placeholder:text-[#64748b] placeholder:text-xs sm:placeholder:text-sm shadow-inner ${
                isVoiceSearching
                  ? 'border-[#ef4444] shadow-lg shadow-[#ef4444]/20 animate-pulse placeholder-[#f87171]'
                  : 'border-[#1f293d] focus:border-[#38bdf8] focus:bg-[#0f172a]'
              }`}
            />
            {/* Single Crisp Search Icon */}
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none flex items-center justify-center">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>

            {/* Clear Button & Voice Search Button inside input */}
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-7 h-7 rounded-xl bg-[#1f293d] hover:bg-[#334155] text-[#94a3b8] hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                  title="مسح البحث"
                >
                  ✕
                </button>
              )}

              <button
                type="button"
                onClick={toggleVoiceSearch}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer select-none ${
                  isVoiceSearching
                    ? 'bg-[#ef4444] text-white shadow-md shadow-[#ef4444]/40 animate-bounce'
                    : 'bg-[#1e293b] text-[#38bdf8] hover:bg-[#2d456b] border border-sky-400/20'
                }`}
                title="بحث بالصوت"
              >
                <span>🎙️</span>
                <span className="text-[11px]">{isVoiceSearching ? 'بيسمع...' : 'صوتي'}</span>
              </button>
            </div>
          </div>

          {/* Filter Chips (No Scrollbar) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === 'all'
                  ? 'bg-[#38bdf8] text-[#090d16] border border-[#38bdf8] shadow-sm shadow-[#38bdf8]/30'
                  : 'bg-[#111827] text-[#94a3b8] border border-[#1f293d] hover:text-white'
              }`}
            >
              الكل ({entries.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === 'pending'
                  ? 'bg-[#38bdf8] text-[#090d16] border border-[#38bdf8] shadow-sm shadow-[#38bdf8]/30'
                  : 'bg-[#111827] text-[#94a3b8] border border-[#1f293d] hover:text-white'
              }`}
            >
              النشط فقط
            </button>
            <button
              onClick={() => setStatusFilter('crossed')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === 'crossed'
                  ? 'bg-[#38bdf8] text-[#090d16] border border-[#38bdf8] shadow-sm shadow-[#38bdf8]/30'
                  : 'bg-[#111827] text-[#94a3b8] border border-[#1f293d] hover:text-white'
              }`}
            >
              المشطوب فقط
            </button>
            <button
              onClick={() => setStatusFilter('settlements')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === 'settlements'
                  ? 'bg-[#fbbf24] text-[#090d16] border border-[#fbbf24] shadow-sm shadow-[#fbbf24]/30'
                  : 'bg-[#111827] text-[#94a3b8] border border-[#1f293d] hover:text-white'
              }`}
            >
              تسويات وفروق
            </button>
          </div>
        </div>

        {/* Database Status indicator & Sort Order Toggle */}
        <div className="flex items-center justify-between text-xs text-[#94a3b8] px-1 mb-3">
          <div>
            نتائج البحث: <span className="text-[#38bdf8] font-bold">{sortedEntries.length}</span> من إجمالي{' '}
            <span className="text-white font-bold">{entries.length}</span> قيد بالداتابيز
          </div>

          {/* Sort Order Toggle Button */}
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111827] border border-[#1f293d] hover:border-sky-400 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
            title="تبديل ترتيب الكروت"
          >
            <span>{sortOrder === 'desc' ? '⬇️ الأحدث أولاً' : '⬆️ الأقدم أولاً'}</span>
          </button>
        </div>

        {/* Entries List */}
        {sortedEntries.length === 0 ? (
          <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-8 text-center text-[#94a3b8] my-4">
            <span className="text-3xl block mb-2">🔍</span>
            <p className="font-bold text-sm text-white mb-1">لم يتم العثور على أي نتائج مطابقة</p>
            <p className="text-xs">جرب البحث بكلمة أخرى أو انطق اسماً مختلفاً</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onUpdate={handleUpdateEntry}
                onDelete={handleDeleteEntry}
                onOpenStatement={(item) => {
                  setSelectedStatementEntry(item);
                  setIsStatementOpen(true);
                }}
              />
            ))}
          </div>
        )}

        {/* Extra bottom spacer so the last card is never covered by the elevated floating button */}
        <div className="h-36 w-full pointer-events-none" aria-hidden="true" />
      </main>

      {/* Persistent Voice Input Bar at Bottom */}
      <VoiceInputBar
        onNewEntry={handleAddNewEntry}
        onVoiceSearch={(query) => {
          setSearchQuery(query);
          showToast(`🔍 جاري البحث عن: ${query}`);
        }}
        searchQuery={searchQuery}
        onClearSearch={() => setSearchQuery('')}
      />

      {/* Manual Entry Modal */}
      <ManualAddModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        occasions={occasions}
        defaultOccasion={selectedOccasion === 'all' ? undefined : selectedOccasion}
        onSubmit={handleAddNewEntry}
      />

      {/* Sidebar Navigation Drawer (3 Bars ☰) */}
      <SidebarDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        occasions={occasions}
        selectedOccasion={selectedOccasion}
        onSelectOccasion={(occ) => setSelectedOccasion(occ)}
        onAddOccasion={handleAddOccasion}
        onDeleteOccasion={handleDeleteOccasion}
        entries={entries}
        onOpenManualModal={() => setIsManualModalOpen(true)}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
      />

      {/* Statement / Ledger Profile Modal */}
      <StatementModal
        entry={selectedStatementEntry}
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        onSaveEntry={handleSaveStatementEntry}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#0284c7] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-full shadow-2xl shadow-[#0284c7]/40 animate-in fade-in zoom-in-95 duration-150 flex items-center gap-2">
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
