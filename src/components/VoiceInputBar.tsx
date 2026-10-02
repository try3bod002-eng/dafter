'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { parseSpokenSentence, extractCleanTranscript, cleanSearchQuery } from '@/lib/speechParser';

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



// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function VoiceInputBar({
  onNewEntry,
  onVoiceSearch,
  searchQuery = '',
  onClearSearch,
}: VoiceInputBarProps) {
  const [activeVoiceMode, setActiveVoiceMode] = useState<'record' | 'search' | null>(null);
  const [liveTranscript, setLiveTranscript]   = useState('');
  const [exampleIdx, setExampleIdx]           = useState(0);
  const [errorMessage, setErrorMessage]       = useState<string | null>(null);
  const [isInAppBrowser, setIsInAppBrowser]   = useState(false);
  const [showHelpModal, setShowHelpModal]      = useState(false);

  // Liquid Gesture Menu State
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<'record' | 'search' | 'cancel' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const recognitionRef    = useRef<any>(null);
  const transcriptRef     = useRef('');
  const activeVoiceModeRef = useRef<'record' | 'search' | null>(null);

  // Gesture tracking refs
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const selectedTargetRef = useRef<'record' | 'search' | 'cancel' | null>(null);
  const recordBtnRef = useRef<HTMLButtonElement | null>(null);
  const searchBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { activeVoiceModeRef.current = activeVoiceMode; }, [activeVoiceMode]);
  useEffect(() => { selectedTargetRef.current = selectedTarget; }, [selectedTarget]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua  = navigator.userAgent || '';
      const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line|Twitter|Snapchat|Telegram/i.test(ua);
      setIsInAppBrowser(inApp);
    }
  }, []);

  const haptic = useCallback((ms = 25) => {
    try { navigator.vibrate?.(ms); } catch {}
  }, []);

  // ── Voice Engine ──────────────────────────────────────────
  const startVoiceEngine = useCallback((mode: 'record' | 'search') => {
    if (activeVoiceModeRef.current) return;
    setErrorMessage(null);
    setMenuOpen(false);
    setSelectedTarget(null);
    setIsDragging(false);
    haptic(45);

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setErrorMessage('متصفحك لا يدعم التعرف الصوتي. يرجى استخدام Google Chrome.');
      setShowHelpModal(true);
      return;
    }

    try {
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }

      const rec = new SR();
      rec.lang = 'ar-EG';
      rec.continuous = true;
      rec.interimResults = true;

      transcriptRef.current = '';
      setLiveTranscript('');
      setExampleIdx(p => (p + 1) % EXAMPLES.length);
      setActiveVoiceMode(mode);

      rec.onresult = (e: any) => {
        const full = extractCleanTranscript(e.results);
        if (full) {
          transcriptRef.current = full;
          setLiveTranscript(full);
          if (mode === 'search' && onVoiceSearch) {
            const q = full.replace(/^(ابحث عن|دور على|هاتلي|هات|اسم)\s+/g, '').trim();
            if (q) onVoiceSearch(q);
          }
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          setErrorMessage('تم رفض إذن المايك. يرجى السماح من إعدادات المتصفح.');
          setShowHelpModal(true);
          stopVoiceEngine(false);
        }
      };

      rec.onend = () => {
        if (activeVoiceModeRef.current) {
          try { rec.start(); } catch { setActiveVoiceMode(null); }
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setErrorMessage('تعذر تشغيل الميكروفون. تأكد من الإذن.');
      setShowHelpModal(true);
    }
  }, [haptic, onVoiceSearch]);

  const stopVoiceEngine = useCallback((commit = true) => {
    const mode = activeVoiceModeRef.current;
    if (!mode) return;
    setActiveVoiceMode(null);
    haptic(30);
    try { recognitionRef.current?.stop(); } catch {}

    const raw = transcriptRef.current;
    if (commit && raw) {
      if (mode === 'record') {
        onNewEntry(parseSpokenSentence(raw));
      } else if (mode === 'search' && onVoiceSearch) {
        const q = cleanSearchQuery(raw);
        onVoiceSearch(q);
      }
    }
    transcriptRef.current = '';
    setLiveTranscript('');
  }, [haptic, onNewEntry, onVoiceSearch]);

  // ── Target Resolution on Pointer Move ─────────────────────
  const resolveTargetAtPoint = useCallback((clientX: number, clientY: number, originX: number, originY: number) => {
    const dx = clientX - originX;
    const dy = clientY - originY;
    const dist = Math.hypot(dx, dy);

    // 1. Check cancel button bounding box
    if (cancelBtnRef.current) {
      const cRect = cancelBtnRef.current.getBoundingClientRect();
      const pad = 12;
      if (
        clientX >= cRect.left - pad &&
        clientX <= cRect.right + pad &&
        clientY >= cRect.top - pad &&
        clientY <= cRect.bottom + pad
      ) {
        return 'cancel';
      }
    }

    // 2. Direct bounding box checks
    if (recordBtnRef.current) {
      const r = recordBtnRef.current.getBoundingClientRect();
      if (
        clientX >= r.left - 8 &&
        clientX <= r.right + 8 &&
        clientY >= r.top - 16 &&
        clientY <= r.bottom + 16
      ) {
        return 'record';
      }
    }

    if (searchBtnRef.current) {
      const s = searchBtnRef.current.getBoundingClientRect();
      if (
        clientX >= s.left - 8 &&
        clientX <= s.right + 8 &&
        clientY >= s.top - 16 &&
        clientY <= s.bottom + 16
      ) {
        return 'search';
      }
    }

    // 3. Directional gesture vector (Thumb slide)
    // RIGHT button is Record (dx > 16)
    // LEFT button is Search (dx < -16)
    // CENTER upward pull is Cancel (dy < -45 while |dx| < 20)
    if (dist > 16) {
      if (dy < -45 && Math.abs(dx) < 20) {
        return 'cancel';
      }
      if (dx > 16) {
        return 'record'; // Slide RIGHT -> Select RIGHT button (تسجيل جديد)
      }
      if (dx < -16) {
        return 'search'; // Slide LEFT -> Select LEFT button (بحث صوتي)
      }
    }

    return null;
  }, []);

  // ── Pointer Handlers (Hold & Slide Gesture) ───────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activeVoiceMode) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
    setIsDragging(false);
    setSelectedTarget(null);
    setMenuOpen(true);
    haptic(20);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStartRef.current || !menuOpen) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 12) {
      setIsDragging(true);
    }

    const target = resolveTargetAtPoint(
      e.clientX,
      e.clientY,
      pointerStartRef.current.x,
      pointerStartRef.current.y
    );

    if (target !== selectedTargetRef.current) {
      if (target) {
        haptic(18); // haptic tick when snapping onto an option!
      }
      setSelectedTarget(target);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStartRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const elapsed = Date.now() - pointerStartRef.current.time;
    const target = selectedTargetRef.current;
    const wasDragging = isDragging;

    pointerStartRef.current = null;
    setIsDragging(false);

    // If user dragged to a target, execute it immediately on release!
    if (wasDragging && target) {
      if (target === 'record') {
        startVoiceEngine('record');
      } else if (target === 'search') {
        startVoiceEngine('search');
      } else if (target === 'cancel') {
        setMenuOpen(false);
        setSelectedTarget(null);
        haptic(15);
      }
      return;
    }

    // If it was just a quick tap without drag (< 250ms), toggle or keep open for manual clicks
    if (elapsed < 250 && !wasDragging) {
      // Toggle
      setMenuOpen(prev => !prev);
      setSelectedTarget(null);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {/* ── In-App Browser Warning ── */}
      {isInAppBrowser && (
        <div className="fixed top-2 inset-x-3 z-50 bg-amber-400 text-[#1e1b4b] p-3 rounded-2xl shadow-xl flex items-center justify-between text-xs font-bold border border-amber-300">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>أنت داخل واتساب! اضغط (⫶) واختر &quot;فتح في Chrome&quot; لتشغيل المايك.</span>
          </div>
          <button onClick={() => setIsInAppBrowser(false)} className="font-black text-base px-1">✕</button>
        </div>
      )}

      {/* ── Help Modal ── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border-2 border-sky-400 rounded-3xl max-w-sm w-full p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <h3 className="text-base font-black text-sky-400 flex items-center gap-2">
                <span>🎙️</span><span>تفعيل الميكروفون</span>
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            {errorMessage && (
              <div className="bg-red-950/60 border border-red-500/40 text-red-200 p-3 rounded-xl text-xs mb-4">{errorMessage}</div>
            )}
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-300 mb-5">
              <li>اضغط 🔒 بجوار شريط العنوان.</li>
              <li>اختر <strong>أذونات الموقع</strong>.</li>
              <li>اختر <strong>السماح (Allow)</strong> للميكروفون.</li>
              <li>حدّث الصفحة وجرب مرة أخرى.</li>
            </ol>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowHelpModal(false); startVoiceEngine('record'); }}
                className="flex-1 bg-sky-400 text-[#090d16] font-black py-2.5 rounded-xl text-xs cursor-pointer"
              >حاول مرة أخرى</button>
              <button
                onClick={() => setShowHelpModal(false)}
                className="flex-1 bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
              >إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Listening Modal ── */}
      {activeVoiceMode && (
        <div className="fixed inset-x-3 bottom-6 max-w-lg mx-auto z-50 animate-in slide-in-from-bottom-4 duration-200">
          <div
            className={`rounded-3xl p-4 backdrop-blur-2xl border-2 shadow-2xl ${
              activeVoiceMode === 'search'
                ? 'bg-[#06111f]/97 border-sky-400 shadow-sky-500/25'
                : 'bg-[#180808]/97 border-red-500 shadow-red-500/25'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inset-0 rounded-full opacity-70 ${activeVoiceMode === 'search' ? 'bg-sky-400' : 'bg-red-500'}`} />
                  <span className={`relative rounded-full h-3 w-3 ${activeVoiceMode === 'search' ? 'bg-sky-400' : 'bg-red-500'}`} />
                </span>
                <span className={`text-sm font-black ${activeVoiceMode === 'search' ? 'text-sky-400' : 'text-red-400'}`}>
                  {activeVoiceMode === 'search' ? '🔍 بيسمعك للبحث...' : '🎙️ بيسمعك للتسجيل...'}
                </span>
                <div className={`flex items-end gap-0.5 ${activeVoiceMode === 'search' ? 'text-sky-400' : 'text-red-400'}`}>
                  {[3, 5, 2, 6, 4].map((h, i) => (
                    <span key={i} className="w-0.5 rounded-full bg-current animate-bounce" style={{ height: `${h * 3}px`, animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => stopVoiceEngine(true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${activeVoiceMode === 'search' ? 'bg-gradient-to-r from-sky-600 to-sky-400 text-white shadow-md' : 'bg-gradient-to-r from-red-700 to-red-500 text-white shadow-md'}`}
                >
                  {activeVoiceMode === 'search' ? '✓ بحث' : '💾 حفظ'}
                </button>
                <button onClick={() => stopVoiceEngine(false)} className="px-2.5 py-1.5 rounded-xl bg-white/5 text-gray-400 text-xs font-bold cursor-pointer hover:text-white">✕</button>
              </div>
            </div>
            {/* Hint */}
            {activeVoiceMode === 'record' ? (
              <div className="mb-2.5 flex flex-wrap gap-1">
                {['الاسم [..]', 'المبلغ [..]', 'البلد [..]', 'الملاحظات [..]'].map(t => (
                  <span key={t} className="bg-white/10 text-sky-300 text-[11px] font-black px-2 py-0.5 rounded-md">{t}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-sky-200/70 mb-2.5">💡 انطق الاسم أو البلد مثال: &quot;أشرف&quot; أو &quot;شربين&quot;</p>
            )}
            {/* Live transcript */}
            <div className="bg-black/50 rounded-2xl p-3 min-h-[48px] flex items-center border border-white/10">
              {liveTranscript
                ? <span className="text-white font-black text-sm">{liveTranscript}</span>
                : <span className="text-gray-500 text-xs flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" /> في انتظار صوتك...</span>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── BACKDROP ON MENU OPEN ── */}
      {menuOpen && !activeVoiceMode && (
        <div
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[3px] transition-opacity duration-200"
          onClick={() => { setMenuOpen(false); setSelectedTarget(null); }}
        />
      )}

      {/* ── FLOATING VOICE CONTROLLER (ELEVATED & LARGER) ── */}
      {!activeVoiceMode && (
        <div className="fixed inset-x-0 bottom-10 sm:bottom-12 z-40 flex flex-col items-center pointer-events-none select-none">

          {/* Active search pill indicator */}
          {searchQuery && (
            <div className="mb-3 pointer-events-auto flex items-center gap-2 bg-sky-600/95 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-lg border border-sky-400/50 backdrop-blur-md animate-in fade-in zoom-in-95">
              <span>🔍 &quot;{searchQuery}&quot;</span>
              <button onClick={onClearSearch} className="bg-black/25 hover:bg-black/40 rounded-full w-4 h-4 flex items-center justify-center text-[10px] cursor-pointer">✕</button>
            </div>
          )}

          {/* ───── POPUP CAPSULE / LIQUID SELECTION MENU ───── */}
          <div
            className={`pointer-events-auto flex flex-col items-center mb-3 transition-all duration-300 ease-out origin-bottom ${
              menuOpen
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-75 translate-y-6 pointer-events-none'
            }`}
          >
            {/* Main Interactive Floating Capsule: Left is Search, Right is Record */}
            <div dir="ltr" className="bg-[#0b1329]/95 backdrop-blur-2xl border-2 border-white/15 p-2 rounded-full shadow-[0_16px_50px_rgba(0,0,0,0.8)] flex items-center gap-2">

              {/* 1. SEARCH BUTTON (LEFT) */}
              <button
                ref={searchBtnRef}
                type="button"
                onClick={() => startVoiceEngine('search')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-black text-xs transition-all duration-200 cursor-pointer ${
                  selectedTarget === 'search'
                    ? 'bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400 text-white shadow-[0_0_20px_rgba(56,189,248,0.7)] scale-110 ring-2 ring-sky-300'
                    : 'bg-white/5 text-sky-300 hover:bg-white/10 active:scale-95'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedTarget === 'search' ? 'bg-white text-sky-600' : 'bg-sky-500/20 text-sky-300'}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <span>بحث صوتي</span>
              </button>

              {/* 2. CANCEL BUTTON (CENTER) */}
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => { setMenuOpen(false); setSelectedTarget(null); haptic(15); }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  selectedTarget === 'cancel'
                    ? 'bg-red-500 text-white scale-125 shadow-[0_0_15px_rgba(239,68,68,0.8)] ring-2 ring-white'
                    : 'bg-white/10 text-gray-400 hover:text-white hover:bg-white/15 active:scale-90'
                }`}
                title="إلغاء"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {/* 3. RECORD BUTTON (RIGHT) */}
              <button
                ref={recordBtnRef}
                type="button"
                onClick={() => startVoiceEngine('record')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-black text-xs transition-all duration-200 cursor-pointer ${
                  selectedTarget === 'record'
                    ? 'bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.7)] scale-110 ring-2 ring-rose-300'
                    : 'bg-white/5 text-rose-300 hover:bg-white/10 active:scale-95'
                }`}
              >
                <span>تسجيل جديد</span>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedTarget === 'record' ? 'bg-white text-rose-600' : 'bg-red-500/20 text-rose-300'}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                    <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </div>
              </button>

            </div>
          </div>

          {/* ───── ELEVATED & LARGER MAIN FLOATING BUTTON (70x70) ───── */}
          <div className="relative pointer-events-auto touch-none">
            {/* Outer pulsating rings strictly AROUND the button (not inside) */}
            {!menuOpen && (
              <div className="absolute -inset-3 rounded-full pointer-events-none flex items-center justify-center">
                {/* Exterior glow halo */}
                <span className="absolute -inset-1 rounded-full bg-cyan-400/20 blur-md animate-pulse pointer-events-none" />
                {/* External concentric ripple ring */}
                <span className="absolute -inset-2.5 rounded-full border border-sky-400/40 animate-ping opacity-60 pointer-events-none duration-1000" />
                {/* Wider secondary pulse ring */}
                <span className="absolute -inset-4 rounded-full border border-cyan-400/20 animate-pulse pointer-events-none" />
              </div>
            )}

            <button
              type="button"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => { pointerStartRef.current = null; setIsDragging(false); }}
              className={`relative w-[70px] h-[70px] rounded-full flex items-center justify-center cursor-pointer select-none transition-all duration-200 shadow-2xl border-2 ${
                menuOpen
                  ? 'bg-[#0f172a] border-white/40 shadow-[0_0_30px_rgba(255,255,255,0.2)] scale-95'
                  : 'bg-gradient-to-tr from-[#1e40af] via-[#2563eb] to-[#06b6d4] border-white/40 shadow-[0_12px_40px_rgba(37,99,235,0.55)] hover:scale-105 active:scale-90'
              }`}
              aria-label={menuOpen ? 'إغلاق القائمة' : 'تفعيل التحكم الصوتي'}
            >
              {menuOpen ? (
                // Open state icon (Close X)
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                // Closed state icon: Clean, crisp microphone without internal dots
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" fill="white" />
                  <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
            </button>
          </div>

        </div>
      )}
    </>
  );
}

