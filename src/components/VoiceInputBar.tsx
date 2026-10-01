'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { parseSpokenSentence, extractCleanTranscript } from '@/lib/speechParser';

interface VoiceInputBarProps {
  onNewEntry: (entry: { name: string; amount: number; location: string; notes: string; crossed: boolean }) => void;
  onVoiceSearch?: (query: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

const EXAMPLES = [
  'الاسم محمد أحمد شربين المبلغ 1000 البلد شربين الملاحظات كان عليه 400 وعلينا 600',
  'الاسم كمال السيد المبلغ 200 الملاحظات خالص',
  'الاسم اشرف الحديدي المبلغ 800 الملاحظات كان عليه 300 وعلينا 500',
  'الاسم مصطفى الباز المبلغ 200 البلد البنا',
  'الاسم أحمد رجب المبلغ خمسمية الملاحظات خالص',
];

export default function VoiceInputBar({
  onNewEntry,
  onVoiceSearch,
  searchQuery = '',
  onClearSearch,
}: VoiceInputBarProps) {
  // Voice engine state
  const [activeVoiceMode, setActiveVoiceMode] = useState<'record' | 'search' | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [exampleIdx, setExampleIdx] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Liquid Slider State
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0); // in pixels (-100 to +100)
  const [activeZone, setActiveZone] = useState<'search' | 'record' | null>(null);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const activeVoiceModeRef = useRef<'record' | 'search' | null>(null);
  const touchStartX = useRef<number | null>(null);
  const activeZoneRef = useRef<'search' | 'record' | null>(null);

  useEffect(() => {
    activeVoiceModeRef.current = activeVoiceMode;
  }, [activeVoiceMode]);

  useEffect(() => {
    activeZoneRef.current = activeZone;
  }, [activeZone]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line|Twitter|Snapchat|Telegram/i.test(ua);
      setIsInAppBrowser(inApp);
    }
  }, []);

  const triggerHaptic = (ms = 20) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {}
  };

  // Start speech recognition immediately
  const startVoiceEngine = useCallback((mode: 'record' | 'search') => {
    if (activeVoiceModeRef.current) return;
    setErrorMessage(null);
    triggerHaptic(40);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage('متصفحك لا يدعم التعرف الصوتي المباشر. يرجى فتح الموقع في متصفح Google Chrome.');
      setShowHelpModal(true);
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const rec = new SpeechRecognition();
      rec.lang = 'ar-EG';
      rec.continuous = true;
      rec.interimResults = true;

      transcriptRef.current = '';
      setLiveTranscript('');
      setExampleIdx((prev) => (prev + 1) % EXAMPLES.length);
      setActiveVoiceMode(mode);

      rec.onresult = (e: any) => {
        const fullSentence = extractCleanTranscript(e.results);
        if (fullSentence) {
          transcriptRef.current = fullSentence;
          setLiveTranscript(fullSentence);

          // For search: perform real-time instant search as user speaks!
          if (mode === 'search' && onVoiceSearch) {
            const cleaned = fullSentence
              .replace(/^(ابحث عن|دور على|هاتلي|هات|اسم)\s+/g, '')
              .trim();
            if (cleaned) {
              onVoiceSearch(cleaned);
            }
          }
        }
      };

      rec.onerror = (e: any) => {
        console.warn('SpeechRecognition error:', e.error);
        if (e.error === 'not-allowed') {
          setErrorMessage('تم رفض إذن المايك. يرجى السماح بالوصول للميكروفون من إعدادات المتصفح.');
          setShowHelpModal(true);
          stopVoiceEngine();
        }
      };

      rec.onend = () => {
        if (activeVoiceModeRef.current) {
          try {
            rec.start();
          } catch {
            setActiveVoiceMode(null);
          }
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err: any) {
      setErrorMessage('تعذر تشغيل الميكروفون. تأكد من إعطاء الصلاحية.');
      setShowHelpModal(true);
    }
  }, [onVoiceSearch]);

  const stopVoiceEngine = useCallback((commit = true) => {
    const currentMode = activeVoiceModeRef.current;
    if (!currentMode) return;
    setActiveVoiceMode(null);
    triggerHaptic(30);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const finalRaw = transcriptRef.current;
    if (commit && finalRaw) {
      if (currentMode === 'record') {
        const parsed = parseSpokenSentence(finalRaw);
        onNewEntry(parsed);
      } else if (currentMode === 'search' && onVoiceSearch) {
        const cleaned = finalRaw
          .replace(/^(ابحث عن|دور على|هاتلي|هات|اسم)\s+/g, '')
          .trim();
        onVoiceSearch(cleaned);
      }
    }

    transcriptRef.current = '';
    setLiveTranscript('');
  }, [onNewEntry, onVoiceSearch]);

  // Pointer / Touch Handlers for the Fluid Liquid Slider
  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeVoiceMode) return;
    touchStartX.current = e.clientX;
    setIsDragging(true);
    setDragOffset(0);
    setActiveZone(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || touchStartX.current === null) return;
    const currentX = e.clientX;
    const delta = currentX - touchStartX.current;

    // Constrain slider movement within [-80px, +80px]
    const clamped = Math.max(-80, Math.min(80, delta));
    setDragOffset(clamped);

    // In RTL layout or standard screen:
    // delta < -30 => Left side (Search)
    // delta > 30  => Right side (Record)
    if (delta < -30) {
      if (activeZoneRef.current !== 'search') {
        setActiveZone('search');
        triggerHaptic(20);
      }
    } else if (delta > 30) {
      if (activeZoneRef.current !== 'record') {
        setActiveZone('record');
        triggerHaptic(20);
      }
    } else {
      if (activeZoneRef.current !== null) {
        setActiveZone(null);
      }
    }
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    touchStartX.current = null;

    const chosenZone = activeZoneRef.current;
    setDragOffset(0);
    setActiveZone(null);

    // Immediate action on gesture release!
    if (chosenZone === 'search') {
      startVoiceEngine('search');
    } else if (chosenZone === 'record') {
      startVoiceEngine('record');
    }
  };

  return (
    <>
      {/* In-App Browser Warning Banner */}
      {isInAppBrowser && (
        <div className="fixed top-2 inset-x-3 z-50 bg-[#f59e0b] text-[#1e1b4b] p-3 rounded-2xl shadow-2xl flex items-center justify-between text-xs sm:text-sm font-bold border border-amber-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>أنت تفتح التطبيق داخل واتساب! لتشغيل المايك اضغط على (⫶) واختر &quot;فتح في Chrome&quot;.</span>
          </div>
          <button
            onClick={() => setIsInAppBrowser(false)}
            className="text-black/60 hover:text-black font-black text-base px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Permission / Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border-2 border-[#38bdf8] rounded-3xl max-w-lg w-full p-6 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 mb-4">
              <h3 className="text-lg font-black text-[#38bdf8] flex items-center gap-2">
                <span>🎙️</span>
                <span>تفعيل الميكروفون</span>
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="bg-red-950/60 border border-red-500/50 text-red-200 p-3.5 rounded-2xl text-xs sm:text-sm mb-4 font-semibold">
                ⚠️ {errorMessage}
              </div>
            )}

            <div className="space-y-3 text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
              <p>💡 <strong>خطوات تفعيل المايك في متصفح Chrome:</strong></p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-300 pr-1">
                <li>اضغط على علامة القفل 🔒 أو أيقونة الموقع بجوار شريط العنوان بالأعلى.</li>
                <li>اختر <strong>أذونات الموقع (Site settings / Permissions)</strong>.</li>
                <li>تأكد من اختيار <strong>السماح (Allow)</strong> للميكروفون.</li>
                <li>حدّث الصفحة وجرب مرة أخرى.</li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowHelpModal(false);
                  startVoiceEngine('record');
                }}
                className="w-full sm:w-auto bg-[#38bdf8] text-[#090d16] font-black py-2.5 px-5 rounded-xl text-xs hover:bg-[#0284c7] cursor-pointer"
              >
                حاول مرة أخرى
              </button>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="w-full sm:w-auto bg-[#334155] text-white font-bold py-2.5 px-5 rounded-xl text-xs hover:bg-[#475569] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE LISTENING LIQUID DYNAMIC ISLAND (EXPANDED) */}
      {activeVoiceMode && (
        <div className="fixed inset-x-3 bottom-4 max-w-lg mx-auto z-50 pointer-events-auto animate-in slide-in-from-bottom-6 duration-200">
          <div
            className={`relative rounded-3xl p-4 sm:p-5 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-2 transition-all ${
              activeVoiceMode === 'search'
                ? 'bg-[#06111f]/95 border-[#38bdf8] shadow-[#38bdf8]/20'
                : 'bg-[#180808]/95 border-[#ef4444] shadow-[#ef4444]/25'
            }`}
          >
            {/* Header with Liquid Pulsing Audio Waves */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      activeVoiceMode === 'search' ? 'bg-[#38bdf8]' : 'bg-[#ef4444]'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      activeVoiceMode === 'search' ? 'bg-[#38bdf8]' : 'bg-[#ef4444]'
                    }`}
                  />
                </span>

                <span
                  className={`font-black text-sm tracking-wide ${
                    activeVoiceMode === 'search' ? 'text-[#38bdf8]' : 'text-[#ef4444]'
                  }`}
                >
                  {activeVoiceMode === 'search' ? '🔍 بيسمعك الآن للبحث في الدفتر...' : '🎙️ بيسمعك الآن لتسجيل القيد...'}
                </span>

                {/* Animated Audio Waveform Equalizer */}
                <div className="flex items-center gap-1 ml-2">
                  <span className="w-1 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="w-1 h-6 bg-current rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
                  <span className="w-1 h-4 bg-current rounded-full animate-bounce" style={{ animationDelay: '220ms' }} />
                </div>
              </div>

              {/* Action Buttons in listening mode */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => stopVoiceEngine(true)}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs cursor-pointer shadow-lg transition-transform active:scale-95 ${
                    activeVoiceMode === 'search'
                      ? 'bg-gradient-to-r from-[#0284c7] to-[#38bdf8] text-[#090d16]'
                      : 'bg-gradient-to-r from-[#dc2626] to-[#ef4444] text-white'
                  }`}
                >
                  {activeVoiceMode === 'search' ? '✓ تم البحث' : '💾 حفظ القيد'}
                </button>
                <button
                  type="button"
                  onClick={() => stopVoiceEngine(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                  title="إلغاء بدون حفظ"
                >
                  ✕ إلغاء
                </button>
              </div>
            </div>

            {/* Hint / Template pill */}
            {activeVoiceMode === 'record' ? (
              <div className="mb-3 space-y-1.5">
                <div className="flex flex-wrap gap-1 text-[11px] font-black text-white">
                  <span className="bg-white/10 px-2 py-0.5 rounded-md text-[#38bdf8]">الاسم [..]</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-md text-[#38bdf8]">المبلغ [..]</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-md text-[#38bdf8]">البلد [..]</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-md text-[#38bdf8]">الملاحظات [..]</span>
                </div>
                <div className="text-[11px] text-amber-300/90 font-medium truncate">
                  💡 مثال: &quot;{EXAMPLES[exampleIdx]}&quot;
                </div>
              </div>
            ) : (
              <div className="mb-2.5 text-xs text-sky-200/80 font-medium">
                💡 انطق اسم الشخص أو البلد أو العائلة (مثال: &quot;أشرف&quot; أو &quot;شربين&quot;)
              </div>
            )}

            {/* Live speech transcript monitor */}
            <div className="bg-black/60 rounded-2xl p-3 min-h-[50px] flex items-center border border-white/10 shadow-inner">
              {liveTranscript ? (
                <span className="text-white font-black text-sm sm:text-base leading-relaxed tracking-wide">
                  {liveTranscript}
                </span>
              ) : (
                <span className="text-gray-500 text-xs sm:text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  في انتظار صوتك... تكلم الآن وسيكتب مباشرة
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* IDLE FLOATING LIQUID SLIDER HUB (AT BOTTOM CENTER) */}
      {!activeVoiceMode && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex flex-col items-center pointer-events-none px-3">
          {/* Active Search Chip Pill (Allows quick clearing) */}
          {searchQuery && (
            <div className="pointer-events-auto mb-2 flex items-center gap-2 bg-[#0284c7]/90 text-white text-xs font-black px-3.5 py-1.5 rounded-full shadow-lg border border-sky-400 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
              <span>🔍 تصفية بـ: &quot;{searchQuery}&quot;</span>
              <button
                type="button"
                onClick={onClearSearch}
                className="bg-black/20 hover:bg-black/40 rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                title="إلغاء التصفية"
              >
                ✕
              </button>
            </div>
          )}

          {/* Liquid Glass Container */}
          <div className="pointer-events-auto relative select-none">
            {/* Liquid Background Pill Dock */}
            <div
              className={`relative flex items-center h-16 rounded-full px-2 backdrop-blur-2xl transition-all duration-300 shadow-[0_15px_45px_rgba(0,0,0,0.85)] border ${
                activeZone === 'search'
                  ? 'bg-gradient-to-r from-[#0284c7]/30 via-[#0d1829]/95 to-[#0d1829]/95 border-[#38bdf8] shadow-[#38bdf8]/30 scale-[1.03]'
                  : activeZone === 'record'
                  ? 'bg-gradient-to-r from-[#0d1829]/95 via-[#0d1829]/95 to-[#ef4444]/30 border-[#ef4444] shadow-[#ef4444]/30 scale-[1.03]'
                  : 'bg-[#0b1120]/90 border-white/10 hover:border-white/20'
              }`}
              style={{ width: '310px' }}
            >
              {/* LEFT HALF: Instant Voice Search (Direct Tap OR Slide Left) */}
              <button
                type="button"
                onClick={() => startVoiceEngine('search')}
                className={`flex-1 flex items-center justify-start pl-3 gap-2 h-full rounded-l-full cursor-pointer transition-all duration-200 ${
                  activeZone === 'search' ? 'scale-105 text-[#38bdf8]' : 'text-gray-300 hover:text-white'
                }`}
                title="اضغط للبحث الصوتي فوراً"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    activeZone === 'search'
                      ? 'bg-[#38bdf8] text-[#090d16] shadow-lg shadow-[#38bdf8]/50 scale-110'
                      : 'bg-white/5 text-[#38bdf8]'
                  }`}
                >
                  <span className="text-base">🔍</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs font-black tracking-tight">بحث صوتي</span>
                  <span className="text-[9px] text-gray-500 font-bold">👈 اسحب يسار</span>
                </div>
              </button>

              {/* CENTER LIQUID SLIDER ORB (Drag Left to Search, Drag Right to Record) */}
              <div
                className="relative z-10 flex items-center justify-center w-14 h-14"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {/* Glowing Liquid Orb */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform duration-75 select-none shadow-2xl border-2 ${
                    activeZone === 'search'
                      ? 'bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] border-white text-white shadow-[#38bdf8]/60 scale-110'
                      : activeZone === 'record'
                      ? 'bg-gradient-to-tr from-[#dc2626] to-[#ef4444] border-white text-white shadow-[#ef4444]/60 scale-110'
                      : 'bg-gradient-to-b from-[#1e293b] to-[#0f172a] border-[#38bdf8]/60 text-white shadow-black/80 hover:border-[#38bdf8]'
                  }`}
                  style={{
                    transform: `translateX(${dragOffset}px) scale(${isDragging ? 1.15 : 1})`,
                    transition: isDragging ? 'transform 0.05s ease-out' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  {activeZone === 'search' ? (
                    <span className="text-xl animate-pulse">🔍</span>
                  ) : activeZone === 'record' ? (
                    <span className="text-xl animate-pulse">🎙️</span>
                  ) : (
                    <span className="text-xl">⚡</span>
                  )}
                </div>
              </div>

              {/* RIGHT HALF: Instant Voice Record (Direct Tap OR Slide Right) */}
              <button
                type="button"
                onClick={() => startVoiceEngine('record')}
                className={`flex-1 flex items-center justify-end pr-3 gap-2 h-full rounded-r-full cursor-pointer transition-all duration-200 ${
                  activeZone === 'record' ? 'scale-105 text-[#ef4444]' : 'text-gray-300 hover:text-white'
                }`}
                title="اضغط لتسجيل قيد بالصوت فوراً"
              >
                <div className="flex flex-col text-left">
                  <span className="text-xs font-black tracking-tight">تسجيل قيد</span>
                  <span className="text-[9px] text-gray-500 font-bold">اسحب يمين 👉</span>
                </div>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    activeZone === 'record'
                      ? 'bg-[#ef4444] text-white shadow-lg shadow-[#ef4444]/50 scale-110'
                      : 'bg-white/5 text-[#ef4444]'
                  }`}
                >
                  <span className="text-base">🎙️</span>
                </div>
              </button>
            </div>

            {/* Subtle Liquid Glow Reflection Under Dock */}
            <div
              className={`absolute -inset-1 rounded-full blur-xl -z-10 transition-opacity duration-300 ${
                activeZone === 'search'
                  ? 'bg-[#38bdf8]/30 opacity-100'
                  : activeZone === 'record'
                  ? 'bg-[#ef4444]/30 opacity-100'
                  : 'bg-transparent opacity-0'
              }`}
            />
          </div>
        </div>
      )}
    </>
  );
}
