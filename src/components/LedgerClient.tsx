'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import EntryCard from '@/components/EntryCard';
import VoiceInputBar from '@/components/VoiceInputBar';
import ManualAddModal from '@/components/ManualAddModal';
import { LedgerEntry, LedgerStats } from '@/types/ledger';

const LOCAL_STORAGE_KEY = 'daftr_nuqta_vercel_cache_v1';

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

  // Sync with LocalStorage for guaranteed 100% persistence on Vercel
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEntries(parsed);
          calculateAndSetStats(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('LocalStorage load error:', e);
    }
    calculateAndSetStats(initialEntries);
  }, [initialEntries]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  const calculateAndSetStats = (currentEntries: LedgerEntry[]) => {
    const totalCount = currentEntries.length;
    const totalAmount = currentEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const crossedCount = currentEntries.filter((e) => e.crossed).length;
    const activeCount = totalCount - crossedCount;
    const settlementsCount = currentEntries.filter((e) =>
      e.notes.includes('كان عليه') ||
      e.notes.includes('علينا') ||
      e.location.includes('كان عليه') ||
      e.location.includes('علينا')
    ).length;

    setStats({
      totalCount,
      totalAmount,
      crossedCount,
      activeCount,
      settlementsCount,
    });
  };

  const persistEntries = (newEntries: LedgerEntry[]) => {
    setEntries(newEntries);
    calculateAndSetStats(newEntries);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newEntries));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddNewEntry = async (newEntryData: {
    name: string;
    amount: number;
    location: string;
    notes: string;
    crossed?: boolean;
  }) => {
    const maxId = entries.reduce((max, e) => (e.id > max ? e.id : max), 0);
    const now = new Date().toISOString();

    const localEntry: LedgerEntry = {
      id: maxId + 1,
      name: newEntryData.name.trim(),
      amount: Number(newEntryData.amount) || 0,
      location: (newEntryData.location || '').trim(),
      notes: (newEntryData.notes || '').trim(),
      crossed: !!newEntryData.crossed,
      createdAt: now,
      updatedAt: now,
    };

    const updatedList = [localEntry, ...entries];
    persistEntries(updatedList);
    showToast(`✔ تم حفظ "${localEntry.name}" بمبلغ ${localEntry.amount} ج`);

    // Also notify API in background
    try {
      fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntryData),
      }).catch(() => {});
    } catch {}
  };

  const handleUpdateEntry = async (id: number, updatedFields: Partial<LedgerEntry>) => {
    const updatedList = entries.map((item) => {
      if (item.id === id) {
        return { ...item, ...updatedFields, updatedAt: new Date().toISOString() };
      }
      return item;
    });

    persistEntries(updatedList);
    showToast('✔ تم تحديث التعديل');

    try {
      fetch(`/api/entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      }).catch(() => {});
    } catch {}
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الاسم؟')) return;
    const updatedList = entries.filter((item) => item.id !== id);
    persistEntries(updatedList);
    showToast('تم الحذف بنجاح');

    try {
      fetch(`/api/entries/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(entries, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      showToast('✔ تم نسخ كود البيانات للحافظة!');
    }).catch(() => {
      prompt('انسخ كود البيانات:', jsonStr);
    });
  };

  const filteredEntries = entries.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.notes.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === 'pending') return !item.crossed;
    if (statusFilter === 'crossed') return item.crossed;
    if (statusFilter === 'settlements') {
      return (
        item.notes.includes('كان عليه') ||
        item.notes.includes('علينا') ||
        item.location.includes('كان عليه') ||
        item.location.includes('علينا')
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-[#f8fafc] pb-32">
      {/* Top Header */}
      <Header
        totalCount={stats.totalCount}
        onOpenManualModal={() => setIsManualModalOpen(true)}
        onExportJson={handleExportJson}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-4 sm:pt-6">
        {/* Quick Stats Grid */}
        <StatsCards stats={stats} />

        {/* Search & Filter Bar */}
        <div className="mb-4 flex flex-col gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الشخص أو البلد..."
              className="w-full bg-[#111827] border border-[#1f293d] rounded-xl py-2.5 pr-10 pl-4 text-sm font-bold text-white outline-none focus:border-[#38bdf8] transition-all"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">
              🔍
            </span>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === 'all'
                  ? 'bg-[#38bdf8] text-[#090d16] border border-[#38bdf8]'
                  : 'bg-[#111827] text-[#94a3b8] border border-[#1f293d] hover:text-white'
              }`}
            >
              الكل ({entries.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === 'pending'
                  ? 'bg-[#38bdf8] text-[#090d16] border border-[#38bdf8]'
                  : 'bg-[#111827] text-[#94a3b8] border border-[#1f293d] hover:text-white'
              }`}
            >
              النشط فقط
            </button>
            <button
              onClick={() => setStatusFilter('crossed')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === 'crossed'
                  ? 'bg-[#38bdf8] text-[#090d16] border border-[#38bdf8]'
                  : 'bg-[#111827] text-[#94a3b8] border border-[#1f293d] hover:text-white'
              }`}
            >
              المشطوب فقط
            </button>
            <button
              onClick={() => setStatusFilter('settlements')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === 'settlements'
                  ? 'bg-[#fbbf24] text-[#090d16] border border-[#fbbf24]'
                  : 'bg-[#111827] text-[#94a3b8] border border-[#1f293d] hover:text-white'
              }`}
            >
              تسويات وفروق
            </button>
          </div>
        </div>

        {/* Entries List */}
        {filteredEntries.length === 0 ? (
          <div className="text-center py-16 bg-[#111827] border border-[#1f293d] rounded-2xl p-8">
            <div className="text-4xl mb-3">🔍</div>
            <h4 className="text-base font-black text-white mb-1">لا توجد قيود مطابقة</h4>
            <p className="text-xs text-[#94a3b8]">جرب البحث بكلمات أخرى أو أضف قيوداً جديدة بالصوت</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onUpdate={handleUpdateEntry}
                onDelete={handleDeleteEntry}
              />
            ))}
          </div>
        )}
      </main>

      {/* Voice Input Bottom Bar */}
      <VoiceInputBar onNewEntry={handleAddNewEntry} />

      {/* Manual Entry Modal */}
      <ManualAddModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={handleAddNewEntry}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#10b981] text-[#090d16] font-black text-xs sm:text-sm px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in duration-150">
          <span>✔</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
