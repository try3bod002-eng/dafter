'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import EntryCard from '@/components/EntryCard';
import VoiceInputBar from '@/components/VoiceInputBar';
import ManualAddModal from '@/components/ManualAddModal';
import { LedgerEntry, LedgerStats } from '@/types/ledger';
import { matchesArabicSearch, extractCleanTranscript } from '@/lib/speechParser';

const LOCAL_STORAGE_DB_KEY = 'daftr_nuqta_live_db_v4';

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

  // Voice Search State
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const searchRecRef = useRef<any>(null);

  // Persistent Client Database: Ensures deletes, edits, and additions stay 100% saved across refreshes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DB_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setEntries(parsed);
          calculateAndSetStats(parsed);
          return;
        }
      } else {
        // Initial setup on new device
        localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(initialEntries));
      }
    } catch (e) {
      console.error('Error reading local persistent DB:', e);
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
    const totalCrossedAmount = currentEntries
      .filter((e) => e.crossed)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    let totalAlinaAmount = 0;
    let settlementsCount = 0;

    currentEntries.forEach((e) => {
      const text = `${e.location} ${e.notes}`;
      const hasSettlement = text.includes('كان عليه') || text.includes('علينا') || text.includes('عليه');
      if (hasSettlement) settlementsCount++;

      const alinaMatch = text.match(/علينا\s*(\d+)/);
      if (alinaMatch) {
        totalAlinaAmount += parseInt(alinaMatch[1], 10);
      }
    });

    setStats({
      totalCount,
      totalAmount,
      crossedCount,
      activeCount,
      settlementsCount,
      totalCrossedAmount,
      totalAlinaAmount,
    });
  };

  const persistState = (newEntries: LedgerEntry[]) => {
    setEntries(newEntries);
    calculateAndSetStats(newEntries);
    try {
      localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(newEntries));
    } catch (e) {
      console.error('Error persisting database:', e);
    }
  };

  // Add Handler
  const handleAddNewEntry = async (newEntryData: {
    name: string;
    amount: number;
    location: string;
    notes: string;
    crossed?: boolean;
  }) => {
    const maxId = entries.reduce((max, e) => (e.id > max ? e.id : max), 0);
    const newEntry: LedgerEntry = {
      id: maxId + 1,
      name: newEntryData.name.trim(),
      amount: Number(newEntryData.amount) || 0,
      location: (newEntryData.location || '').trim(),
      notes: (newEntryData.notes || '').trim(),
      crossed: !!newEntryData.crossed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newEntry, ...entries];
    persistState(updated);
    showToast(`✔ تم الحفظ: "${newEntry.name}" (${newEntry.amount} ج)`);

    // Sync to API in background
    try {
      fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntryData),
      }).catch(() => {});
    } catch {}
  };

  // Update Handler
  const handleUpdateEntry = async (id: number, updatedFields: Partial<LedgerEntry>) => {
    const updatedList = entries.map((item) => {
      if (item.id === id) {
        return { ...item, ...updatedFields, updatedAt: new Date().toISOString() };
      }
      return item;
    });

    persistState(updatedList);
    showToast('✔ تم حفظ التعديل');

    try {
      fetch(`/api/entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      }).catch(() => {});
    } catch {}
  };

  // Delete Handler - Permanently deletes and stays deleted on refresh
  const handleDeleteEntry = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الاسم نهائياً؟')) return;
    const updatedList = entries.filter((item) => item.id !== id);
    persistState(updatedList);
    showToast('تم الحذف نهائياً');

    try {
      fetch(`/api/entries/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
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
        const cleaned = fullSentence
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

  // Smart Arabic Search Filter (normalizes hamzas, yaa/alif maqsura, taa marbuta, and matches all words)
  const filteredEntries = entries.filter((item) => {
    if (searchQuery.trim()) {
      const targetText = `${item.name} ${item.location} ${item.notes}`;
      if (!matchesArabicSearch(targetText, searchQuery)) return false;
    }

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
    <div className="min-h-screen flex flex-col bg-[#090d16] text-[#f8fafc] pb-64">
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

        {/* Extra bottom spacer so the last card is never covered by the bottom bar */}
        <div className="h-28 w-full pointer-events-none" aria-hidden="true" />
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
