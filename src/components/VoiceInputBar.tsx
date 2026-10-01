'use client';

import React, { useState, useRef, useEffect } from 'react';
import { parseSpokenSentence } from '@/lib/speechParser';

interface VoiceInputBarProps {
  onNewEntry: (entry: { name: string; amount: number; location: string; notes: string; crossed: boolean }) => void;
}

const EXAMPLES = [
  'الاسم محمد أحمد شربين المبلغ 1000 البلد شربين الملاحظات كان عليه 400 وعلينا 600',
  'الاسم كمال السيد المبلغ 200 الملاحظات خالص',
  'الاسم اشرف الحديدي المبلغ 800 الملاحظات كان عليه 300 وعلينا 500',
  'الاسم مصطفى الباز المبلغ 200 البلد البنا',
  'الاسم أحمد رجب المبلغ خمسمية الملاحظات خالص',
];

export default function VoiceInputBar({ onNewEntry }: VoiceInputBarProps) {
  const [triggerMode, setTriggerMode] = useState<'click' | 'hold'>('click');
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [exampleIdx, setExampleIdx] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const isRecordingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line|Twitter|Snapchat|Telegram/i.test(ua);
      setIsInAppBrowser(inApp);
    }
  }, []);

  const startListening = () => {
    if (isRecordingRef.current) return;
    setErrorMessage(null);

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
      setIsRecording(true);

      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(50);
        }
      } catch {}

      rec.onresult = (e: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript + ' ';
          } else {
            // On mobile Chrome, non-final results accumulate in sequence, take the latest full hypothesis
            interimTranscript = res[0].transcript;
          }
        }

        const fullSentence = `${finalTranscript} ${interimTranscript}`.trim().replace(/\s+/g, ' ');
        if (fullSentence) {
          transcriptRef.current = fullSentence;
          setLiveTranscript(fullSentence);
        }
      };

      rec.onerror = (e: any) => {
        console.warn('Speech recognition status:', e.error);
        if (e.error === 'not-allowed') {
          setIsRecording(false);
          setShowHelpModal(true);
          setErrorMessage('تم حظر المايكروفون في المتصفح أو إعدادات الهاتف.');
        } else if (e.error === 'no-speech') {
          // Keep active, let user speak
        } else if (e.error === 'audio-capture') {
          setErrorMessage('المايكروفون غير متصل أو مشغول بتطبيق آخر.');
          setIsRecording(false);
        } else if (e.error === 'network') {
          // If network glitch occurs on Google server, finalize if we already have speech
          if (transcriptRef.current) {
            setIsRecording(false);
            const parsed = parseSpokenSentence(transcriptRef.current);
            onNewEntry(parsed);
          }
        }
      };

      rec.onend = () => {
        if (isRecordingRef.current) {
          // If still recording but recognition ended with text, finalize
          if (transcriptRef.current) {
            setIsRecording(false);
            const parsed = parseSpokenSentence(transcriptRef.current);
            onNewEntry(parsed);
          } else {
            // If ended with no text yet (e.g. mobile timeout), restart seamlessly
            try {
              rec.start();
            } catch {
              setIsRecording(false);
            }
          }
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsRecording(false);
      setShowHelpModal(true);
    }
  };

  const stopListening = () => {
    if (!isRecordingRef.current) return;
    setIsRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const finalRaw = transcriptRef.current;
    if (finalRaw) {
      const parsed = parseSpokenSentence(finalRaw);
      onNewEntry(parsed);
      transcriptRef.current = '';
      setLiveTranscript('');
    }
  };

  const handleToggleClick = () => {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleHoldStart = () => {
    if (triggerMode === 'hold') startListening();
  };

  const handleHoldEnd = () => {
    if (triggerMode === 'hold' && isRecordingRef.current) stopListening();
  };

  return (
    <>
      {/* In-App Browser Warning Banner */}
      {isInAppBrowser && (
        <div className="fixed top-2 inset-x-3 z-50 bg-[#f59e0b] text-[#1e1b4b] p-3 rounded-xl shadow-2xl flex items-center justify-between text-xs sm:text-sm font-bold border border-amber-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>أنت تفتح التطبيق داخل واتساب! لتشغيل المايك اضغط على (⫶) واختر &quot;فتح في المتصفح Chrome&quot;.</span>
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
          <div className="bg-[#0f172a] border-2 border-[#38bdf8] rounded-2xl max-w-lg w-full p-5 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 mb-4">
              <div className="flex items-center gap-2 text-[#38bdf8] font-black text-base">
                <span className="text-xl">🎙️</span>
                <span>كيفية تفعيل المايك في متصفح هاتفك</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-[#94a3b8] hover:text-white font-black text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#1e293b]/70 border border-[#334155] rounded-xl p-3.5 mb-3 text-xs leading-relaxed">
              <div className="font-black text-[#38bdf8] text-sm mb-2 flex items-center gap-1.5">
                <span>📱</span>
                <span>لهواتف أندرويد (Google Chrome):</span>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-[#e2e8f0]">
                <li className="bg-[#0284c7]/20 p-2 rounded-lg border border-[#0284c7]/40">
                  <strong className="text-[#38bdf8]">إعدادات الهاتف الأساسية:</strong><br />
                  افتح <strong>إعدادات الهاتف (Settings)</strong> ⬅️ <strong>التطبيقات (Apps)</strong> ⬅️ <strong>Chrome</strong> ⬅️ <strong>الأذونات (Permissions)</strong> ⬅️ فعّل <strong>الميكروفون (السماح عند استخدام التطبيق)</strong>.
                </li>
                <li>
                  <strong>من شريط الرابط:</strong> اضغط على أيقونة الإعدادات/الشرطتين (🎛️) بجانب الرابط ⬅️ <strong>الأذونات</strong> ⬅️ فعّل <strong>الميكروفون</strong>.
                </li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => {
                  setShowHelpModal(false);
                  startListening();
                }}
                className="w-full sm:flex-1 bg-gradient-to-r from-[#0284c7] to-[#38bdf8] text-[#090d16] font-black py-2.5 px-4 rounded-xl text-xs hover:brightness-110 cursor-pointer shadow-lg"
              >
                🔄 تجربة المايك الآن
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

      {/* Teleprompter Spoken Template Modal (Appears when recording) */}
      {isRecording && (
        <div className="fixed inset-x-4 top-16 max-w-lg mx-auto z-50 bg-[#0d1424]/98 backdrop-blur-xl border-2 border-[#ef4444] rounded-2xl p-4 sm:p-5 shadow-2xl shadow-[#ef4444]/30 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-[#1f2e4a] pb-2.5 mb-3">
            <div className="flex items-center gap-2 text-[#ef4444] font-black text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-ping"></span>
              <span>بيسمعك الآن... تكلم بالقالب التالي:</span>
            </div>
            <span className="text-[11px] font-bold text-[#94a3b8]">
              {triggerMode === 'hold' ? 'ارفع إصبعك للحفظ' : 'اضغط مرة أخرى للحفظ'}
            </span>
          </div>

          {/* Formula Chips */}
          <div className="bg-[#080d18] border border-[#2d456b] rounded-xl p-3 mb-3">
            <div className="text-[11px] font-bold text-[#38bdf8] mb-1.5">📋 الصيغة الصحيحة للنطق:</div>
            <div className="flex flex-wrap gap-1.5 text-xs font-black text-white">
              <span className="bg-[#152238] border border-[#293e61] px-2 py-0.5 rounded-md">
                <strong className="text-[#38bdf8]">الاسم</strong> [اسم الشخص]
              </span>
              <span className="bg-[#152238] border border-[#293e61] px-2 py-0.5 rounded-md">
                <strong className="text-[#38bdf8]">المبلغ</strong> [الرقم]
              </span>
              <span className="bg-[#152238] border border-[#293e61] px-2 py-0.5 rounded-md">
                <strong className="text-[#38bdf8]">البلد</strong> [البلد]
              </span>
              <span className="bg-[#152238] border border-[#293e61] px-2 py-0.5 rounded-md">
                <strong className="text-[#38bdf8]">الملاحظات</strong> [الواجب]
              </span>
            </div>
          </div>

          {/* Spoken Live Example */}
          <div className="bg-[#f59e0b]/12 border border-[#f59e0b]/30 text-[#fde68a] text-xs sm:text-sm font-bold p-2.5 rounded-xl mb-3 leading-relaxed">
            💡 <strong>مثال انطقه الآن: </strong>
            <span>&quot;{EXAMPLES[exampleIdx]}&quot;</span>
          </div>

          {/* Real-time speech transcript */}
          <div className="bg-[#040711] text-[#38bdf8] text-sm sm:text-base font-black p-3 rounded-xl min-h-[44px] flex items-center shadow-inner border border-[#1e293d]">
            {liveTranscript ? (
              <span className="text-white font-black">{liveTranscript}</span>
            ) : (
              <span className="text-[#64748b] font-normal flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse"></span>
                في انتظار صوتك... تكلم الآن
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bottom Sticky Action Area */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-[#090d16]/96 backdrop-blur-md border-t border-[#1f293d] p-3 sm:pb-4 shadow-2xl">
        <div className="max-w-md mx-auto flex flex-col items-center gap-2.5">
          {/* Mode Selector */}
          <div className="w-full flex items-center justify-between px-1">
            <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-full border border-[#1f293d] text-xs font-bold">
              <button
                type="button"
                onClick={() => setTriggerMode('click')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  triggerMode === 'click' ? 'bg-[#0284c7] text-white shadow-xs' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                🎙️ نقرة للبدء والإنهاء
              </button>
              <button
                type="button"
                onClick={() => setTriggerMode('hold')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  triggerMode === 'hold' ? 'bg-[#0284c7] text-white shadow-xs' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                👆 ضغط متواصل (Hold)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="text-[11px] font-bold text-[#94a3b8] hover:text-white px-2 py-1"
            >
              مساعدة المايك ❓
            </button>
          </div>

          {/* Main Voice Button */}
          {triggerMode === 'click' ? (
            <button
              type="button"
              onClick={handleToggleClick}
              className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all select-none cursor-pointer shadow-lg active:scale-98 ${
                isRecording
                  ? 'bg-gradient-to-r from-[#dc2626] to-[#ef4444] text-white shadow-[#ef4444]/40 scale-98 animate-pulse'
                  : 'bg-gradient-to-r from-[#0284c7] to-[#38bdf8] hover:brightness-110 text-[#090d16] shadow-[#38bdf8]/25'
              }`}
            >
              <span className="text-xl">🎙️</span>
              <span>
                {isRecording ? 'بيسمعك الآن... اضغط هنا للإنهاء والحفظ' : 'اضغط للتسجيل الصوتي (بالعامية المصرية)'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onPointerDown={handleHoldStart}
              onPointerUp={handleHoldEnd}
              onPointerCancel={handleHoldEnd}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all select-none cursor-pointer shadow-lg active:scale-98 ${
                isRecording
                  ? 'bg-gradient-to-r from-[#dc2626] to-[#ef4444] text-white shadow-[#ef4444]/40 scale-98 animate-pulse'
                  : 'bg-gradient-to-r from-[#0284c7] to-[#38bdf8] hover:brightness-110 text-[#090d16] shadow-[#38bdf8]/25'
              }`}
            >
              <span className="text-xl">🎙️</span>
              <span>
                {isRecording ? 'جاري التسجيل... ارفع إصبعك للحفظ' : 'اضغط مطولاً وتكلم (Hold to Speak)'}
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
