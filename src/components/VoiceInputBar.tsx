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

// ─────────────────────────────────────────────────────────────
// SVG Radial Fan Math
// Convention: 0° = top (12 o'clock), clockwise
// ─────────────────────────────────────────────────────────────
function toCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function fanBlade(
  cx: number, cy: number,
  ir: number, or_: number,
  a1: number, a2: number
): string {
  const span = a2 >= a1 ? a2 - a1 : a2 + 360 - a1;
  const large = span > 180 ? 1 : 0;
  const o1 = toCartesian(cx, cy, or_, a1);
  const o2 = toCartesian(cx, cy, or_, a2);
  const i2 = toCartesian(cx, cy, ir, a2);
  const i1 = toCartesian(cx, cy, ir, a1);
  return `M${o1.x.toFixed(2)} ${o1.y.toFixed(2)} A${or_} ${or_} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)} L${i2.x.toFixed(2)} ${i2.y.toFixed(2)} A${ir} ${ir} 0 ${large} 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}Z`;
}

function midArc(cx: number, cy: number, r: number, a1: number, a2: number) {
  const mid = a2 >= a1 ? (a1 + a2) / 2 : (a1 + a2 + 360) / 2;
  return toCartesian(cx, cy, r, mid);
}

// ─────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────
const SVG_W = 240, SVG_H = 220;
const CX = 120, CY = 182; // button center in SVG space
const IR = 40;  // inner radius (just outside the button)
const OR = 112; // outer radius (fan blade extent)
const LR = 82;  // label radius (between IR and OR, offset toward outer)

// Search blade: lower-left → upper-left arc (225° → 345°)
const SA1 = 225, SA2 = 345;
const SEARCH_PATH = fanBlade(CX, CY, IR, OR, SA1, SA2);
const SEARCH_LABEL = midArc(CX, CY, LR, SA1, SA2); // mid at ~285° = NW

// Record blade: upper-right arc (345° → 105°, wraps through 0°)
const RA1 = 345, RA2 = 105;
const RECORD_PATH = fanBlade(CX, CY, IR, OR, RA1, RA2);
const RECORD_LABEL = midArc(CX, CY, LR, RA1, RA2); // mid at ~45° = NE

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

  // Fan menu
  const [menuOpen, setMenuOpen]       = useState(false);
  const [touchedZone, setTouchedZone] = useState<'search' | 'record' | null>(null);

  const recognitionRef    = useRef<any>(null);
  const transcriptRef     = useRef('');
  const activeVoiceModeRef = useRef<'record' | 'search' | null>(null);

  useEffect(() => { activeVoiceModeRef.current = activeVoiceMode; }, [activeVoiceMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua  = navigator.userAgent || '';
      const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line|Twitter|Snapchat|Telegram/i.test(ua);
      setIsInAppBrowser(inApp);
    }
  }, []);

  const haptic = (ms = 25) => {
    try { navigator.vibrate?.(ms); } catch {}
  };

  // ── Voice Engine ──────────────────────────────────────────
  const startVoiceEngine = useCallback((mode: 'record' | 'search') => {
    if (activeVoiceModeRef.current) return;
    setErrorMessage(null);
    setMenuOpen(false);
    setTouchedZone(null);
    haptic(40);

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
  }, [onVoiceSearch]);

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
        const q = raw.replace(/^(ابحث عن|دور على|هاتلي|هات|اسم)\s+/g, '').trim();
        onVoiceSearch(q);
      }
    }
    transcriptRef.current = '';
    setLiveTranscript('');
  }, [onNewEntry, onVoiceSearch]);

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
                className="flex-1 bg-sky-400 text-[#090d16] font-black py-2.5 rounded-xl text-xs"
              >حاول مرة أخرى</button>
              <button
                onClick={() => setShowHelpModal(false)}
                className="flex-1 bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs"
              >إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Listening Modal ── */}
      {activeVoiceMode && (
        <div className="fixed inset-x-3 bottom-5 max-w-lg mx-auto z-50 animate-in slide-in-from-bottom-4 duration-200">
          <div
            className={`rounded-3xl p-4 backdrop-blur-2xl border-2 shadow-2xl ${
              activeVoiceMode === 'search'
                ? 'bg-[#06111f]/97 border-sky-400 shadow-sky-500/20'
                : 'bg-[#180808]/97 border-red-500 shadow-red-500/20'
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${activeVoiceMode === 'search' ? 'bg-gradient-to-r from-sky-600 to-sky-400 text-white' : 'bg-gradient-to-r from-red-700 to-red-500 text-white'}`}
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

      {/* ── BACKDROP ── */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px]"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── RADIAL FAN HUB ── */}
      {!activeVoiceMode && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center items-end pointer-events-none">

          {/* Active search pill */}
          {searchQuery && (
            <div className="absolute bottom-[200px] pointer-events-auto flex items-center gap-2 bg-sky-600/90 text-white text-xs font-black px-3.5 py-1.5 rounded-full shadow-lg border border-sky-400 backdrop-blur-md">
              <span>🔍 &quot;{searchQuery}&quot;</span>
              <button onClick={onClearSearch} className="bg-black/20 hover:bg-black/40 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">✕</button>
            </div>
          )}

          <div className="pointer-events-auto relative" style={{ width: SVG_W, height: SVG_H }}>

            {/* ───── SVG FAN ───── */}
            <svg
              width={SVG_W}
              height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'visible',
                transformOrigin: `${CX}px ${CY}px`,
                transform: menuOpen ? 'scale(1)' : 'scale(0)',
                transition: 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              {/* ── SEARCH BLADE (upper-left) ── */}
              <path
                d={SEARCH_PATH}
                fill={touchedZone === 'search' ? '#0284c7' : '#0c2a45'}
                stroke={touchedZone === 'search' ? '#38bdf8' : '#0e3d66'}
                strokeWidth="1.5"
                strokeLinejoin="round"
                style={{
                  cursor: 'pointer',
                  transition: 'fill 0.12s, filter 0.12s',
                  filter: touchedZone === 'search'
                    ? 'drop-shadow(0 0 14px rgba(56,189,248,0.6))'
                    : 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
                }}
                onPointerDown={() => { haptic(15); setTouchedZone('search'); }}
                onPointerUp={() => { startVoiceEngine('search'); }}
                onPointerLeave={() => setTouchedZone(null)}
              />

              {/* Search icon + label */}
              <g
                transform={`translate(${SEARCH_LABEL.x.toFixed(1)} ${SEARCH_LABEL.y.toFixed(1)})`}
                style={{ pointerEvents: 'none' }}
              >
                {/* Magnifier icon */}
                <circle cx="0" cy="-12" r="8" fill="none" stroke={touchedZone === 'search' ? 'white' : '#7dd3fc'} strokeWidth="2.5" />
                <line x1="6" y1="-6" x2="11" y2="-1" stroke={touchedZone === 'search' ? 'white' : '#7dd3fc'} strokeWidth="2.5" strokeLinecap="round" />
                {/* Label */}
                <text
                  textAnchor="middle"
                  y="5"
                  fill={touchedZone === 'search' ? 'white' : '#93c5fd'}
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="Cairo, Arial, sans-serif"
                >
                  بحث صوتي
                </text>
              </g>

              {/* ── RECORD BLADE (upper-right) ── */}
              <path
                d={RECORD_PATH}
                fill={touchedZone === 'record' ? '#dc2626' : '#2d0808'}
                stroke={touchedZone === 'record' ? '#f87171' : '#4a1010'}
                strokeWidth="1.5"
                strokeLinejoin="round"
                style={{
                  cursor: 'pointer',
                  transition: 'fill 0.12s, filter 0.12s',
                  filter: touchedZone === 'record'
                    ? 'drop-shadow(0 0 14px rgba(239,68,68,0.6))'
                    : 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
                }}
                onPointerDown={() => { haptic(15); setTouchedZone('record'); }}
                onPointerUp={() => { startVoiceEngine('record'); }}
                onPointerLeave={() => setTouchedZone(null)}
              />

              {/* Mic icon + label */}
              <g
                transform={`translate(${RECORD_LABEL.x.toFixed(1)} ${RECORD_LABEL.y.toFixed(1)})`}
                style={{ pointerEvents: 'none' }}
              >
                {/* Mic body */}
                <rect x="-5" y="-21" width="10" height="14" rx="5" fill="none" stroke={touchedZone === 'record' ? 'white' : '#fca5a5'} strokeWidth="2.3" />
                {/* Mic stand arc */}
                <path d="M -9 -11 Q -9 0 0 0 Q 9 0 9 -11" fill="none" stroke={touchedZone === 'record' ? 'white' : '#fca5a5'} strokeWidth="2.3" strokeLinecap="round" />
                {/* Mic stem */}
                <line x1="0" y1="0" x2="0" y2="5" stroke={touchedZone === 'record' ? 'white' : '#fca5a5'} strokeWidth="2.3" strokeLinecap="round" />
                {/* Red dot */}
                <circle cx="7" cy="-18" r="3" fill="#ef4444" stroke={touchedZone === 'record' ? 'white' : '#4a1010'} strokeWidth="1" />
                {/* Label */}
                <text
                  textAnchor="middle"
                  y="18"
                  fill={touchedZone === 'record' ? 'white' : '#fca5a5'}
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="Cairo, Arial, sans-serif"
                >
                  تسجيل جديد
                </text>
              </g>

              {/* Blade gap dividers */}
              {[SA1, SA2, RA2].map((a, i) => {
                const ip = toCartesian(CX, CY, IR + 3, a);
                const op = toCartesian(CX, CY, OR - 4, a);
                return (
                  <line key={i} x1={ip.x} y1={ip.y} x2={op.x} y2={op.y}
                    stroke="rgba(0,0,0,0.45)" strokeWidth="2.5" strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                );
              })}
            </svg>

            {/* ───── CENTER BUTTON ───── */}
            <button
              type="button"
              onClick={() => {
                if (menuOpen) {
                  setMenuOpen(false);
                  setTouchedZone(null);
                } else {
                  haptic(25);
                  setTouchedZone(null);
                  setMenuOpen(true);
                }
              }}
              style={{
                position: 'absolute',
                left: CX - 30,
                top: CY - 30,
                width: 60,
                height: 60,
                borderRadius: '50%',
                transition: 'background 0.2s, transform 0.15s',
                transform: menuOpen ? 'scale(0.88)' : 'scale(1)',
              }}
              className={`flex items-center justify-center cursor-pointer select-none border-2 shadow-2xl ${
                menuOpen
                  ? 'bg-[#1e293b] border-white/30 shadow-white/10'
                  : 'bg-gradient-to-tr from-[#1d4ed8] via-[#2563eb] to-[#0ea5e9] border-white/20 shadow-blue-500/60'
              }`}
              aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح قائمة الصوت'}
            >
              {menuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              ) : (
                <>
                  {/* Bullseye */}
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                  </div>
                  {/* Outer pulse rings */}
                  <span className="absolute w-[78px] h-[78px] rounded-full border-2 border-sky-400/25 animate-pulse pointer-events-none" />
                  <span className="absolute w-[96px] h-[96px] rounded-full border border-sky-400/12 animate-pulse pointer-events-none" style={{ animationDelay: '0.6s' }} />
                </>
              )}
            </button>

            {/* ── Hint label ── */}
            <div
              style={{ position: 'absolute', left: CX, top: CY + 36, transform: 'translateX(-50%)' }}
              className="text-[9px] text-gray-500 font-bold whitespace-nowrap pointer-events-none"
            >
              {menuOpen ? 'اضغط لإغلاق • اختر وضع الصوت' : 'اضغط للقائمة الصوتية'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
