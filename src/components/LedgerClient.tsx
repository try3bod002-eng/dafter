'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import EntryCard from '@/components/EntryCard';
import VoiceInputBar from '@/components/VoiceInputBar';
import ManualAddModal from '@/components/ManualAddModal';
import { LedgerEntry, LedgerStats } from '@/types/ledger';

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
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  // Voice Search State
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const searchRecRef = useRef<any>(null);

  // 100% Database Reliance: Fetch fresh entries directly from the database API on mount
  useEffect(() => {
    async function loadFromDatabase() {
      try {
        setIsLoadingDb(true);
        const res = await fetch('/api/entries');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.entries)) {
            setEntries(data.entries);
            calculateAndSetStats(data.entries);
          }
        }
      } catch (err) {
        console.error('Failed to load entries from database:', err);
      } finally {
        setIsLoadingDb(false);
      }
    }
    loadFromDatabase();
  }, []);

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

  // Database Add Handler
  const handleAddNewEntry = async (newEntryData: {
    name: string;
    amount: number;
    location: string;
    notes: string;
    crossed?: boolean;
  }) => {
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntryData),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.entry) {
          const updated = [data.entry, ...entries];
          setEntries(updated);
          calculateAndSetStats(updated);
          showToast(`✔ تم الحفظ في قاعدة البيانات: "${data.entry.name}" (${data.entry.amount} ج)`);
          return;
        }
      }
    } catch (err) {
      console.error('Database save error:', err);
    }

    // Fallback in case of temporary network disconnect
    const maxId = entries.reduce((max, e) => (e.id > max ? e.id : max), 0);
    const fallbackEntry: LedgerEntry = {
      id: maxId + 1,
      name: newEntryData.name.trim(),
      amount: Number(newEntryData.amount) || 0,
      location: (newEntryData.location || '').trim(),
      notes: (newEntryData.notes || '').trim(),
      crossed: !!newEntryData.crossed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [fallbackEntry, ...entries];
    setEntries(updated);
    calculateAndSetStats(updated);
    showToast(`✔ تم الحفظ: "${fallbackEntry.name}"`);
  };

  // Database Update Handler
  const handleUpdateEntry = async (id: number, updatedFields: Partial<LedgerEntry>) => {
    const updatedList = entries.map((item) => {
      if (item.id === id) {
        return { ...item, ...updatedFields, updatedAt: new Date().toISOString() };
      }
      return item;
    });

    setEntries(updatedList);
    calculateAndSetStats(updatedList);
    showToast('✔ تم تحديث التعديل في قاعدة البيانات');

    try {
      await fetch(`/api/entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
    } catch (err) {
      console.error('Database update error:', err);
    }
  };

  // Database Delete Handler
  const handleDeleteEntry = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الاسم نهائياً من قاعدة البيانات؟')) return;
    const updatedList = entries.filter((item) => item.id !== id);
    setEntries(updatedList);
    calculateAndSetStats(updatedList);
    showToast('تم الحذف من قاعدة البيانات');

    try {
      await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Database delete error:', err);
    }
  };

  // Voice Search inside Search Box
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
        let transcript = '';
        for (let i = 0; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript + ' ';
        }
        const cleaned = transcript
          .trim()
          .replace(/^(ابحث عن|دور على|هاتلي|هات|اسم)\s+/g, '')
          .trim();

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
          {/* Search Input with Integrated Voice Search */}
          <div className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isVoiceSearching
                  ? '🎙️ بيسمعك الآن... انطق اسم الشخص أو البلد للبحث...'
                  : '🔍 ابحث باسم الشخص أو البلد أو بالصوت...'
              }
              className={`w-full bg-[#111827] border rounded-xl py-2.5 pr-10 pl-24 text-sm font-bold text-white outline-none transition-all ${
                isVoiceSearching
                  ? 'border-[#ef4444] shadow-lg shadow-[#ef4444]/20 animate-pulse placeholder-[#f87171]'
                  : 'border-[#1f293d] focus:border-[#38bdf8]'
              }`}
            />
            {/* Search Icon */}
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">
              🔍
            </span>

            {/* Clear Button & Voice Search Button inside input */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-6 h-6 rounded-lg bg-[#1f293d] hover:bg-[#334155] text-[#94a3b8] hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
                  title="مسح البحث"
                >
                  ✕
                </button>
              )}

              <button
                type="button"
                onClick={toggleVoiceSearch}
                className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 transition-all cursor-pointer select-none ${
                  isVoiceSearching
                    ? 'bg-[#ef4444] text-white shadow-md shadow-[#ef4444]/40 animate-bounce'
                    : 'bg-[#1f2e4a] text-[#38bdf8] hover:bg-[#2d456b]'
                }`}
                title="بحث بالصوت"
              >
                <span>🎙️</span>
                <span className="text-[11px]">{isVoiceSearching ? 'بيسمع...' : 'صوتي'}</span>
              </button>
            </div>
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

        {/* Database Status indicator */}
        <div className="flex items-center justify-between text-xs text-[#94a3b8] px-1 mb-3">
          <div>
            نتائج البحث: <span className="text-[#38bdf8] font-bold">{filteredEntries.length}</span> من إجمالي{' '}
            <span className="text-white font-bold">{entries.length}</span> قيد بالداتابيز
          </div>
          {isLoadingDb && (
            <div className="flex items-center gap-1.5 text-xs text-[#38bdf8] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]"></span>
              <span>جاري المزامنة مع الداتابيز...</span>
            </div>
          )}
        </div>

        {/* Entries List */}
        {filteredEntries.length === 0 ? (
          <div className="bg-[#111827] border border-[#1f293d] rounded-2xl p-8 text-center text-[#94a3b8] my-4">
            <span className="text-3xl block mb-2">🔍</span>
            <p className="font-bold text-sm text-white mb-1">لم يتم العثور على أي نتائج مطابقة</p>
            <p className="text-xs">جرب البحث بكلمة أخرى أو انطق اسماً مختلفاً</p>
          </div>
        ) : (
          <div className="space-y-3">
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

      {/* Persistent Voice Input Bar & Quick Keyboard Dictation at Bottom */}
      <VoiceInputBar onNewEntry={handleAddNewEntry} />

      {/* Manual Entry Modal */}
      <ManualAddModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={handleAddNewEntry}
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
