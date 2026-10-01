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
  // Default to 'click' for maximum mobile reliability
  const [triggerMode, setTriggerMode] = useState<'click' | 'hold'>('click');
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [exampleIdx, setExampleIdx] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [micStatus, setMicStatus] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const isRecordingRef = useRef(false);

  // Keep ref in sync to avoid stale state in event handlers
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Check environment on mount (In-App Browser & Permissions)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line|Twitter|Snapchat|Telegram/i.test(ua);
      setIsInAppBrowser(inApp);

      // Check mic permission status if supported
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions
          .query({ name: 'microphone' as any })
          .then((permissionStatus) => {
            setMicStatus(permissionStatus.state as any);
            permissionStatus.onchange = () => {
              setMicStatus(permissionStatus.state as any);
            };
          })
          .catch(() => {});
      }
    }
  }, []);

  const [showHelpModal, setShowHelpModal] = useState(false);

  // Explicitly prompt the native browser microphone dialog
  const requestMicPermission = async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop stream immediately so SpeechRecognition has full exclusive mic access
        stream.getTracks().forEach((track) => track.stop());
        setMicStatus('granted');
        setErrorMessage(null);
        setShowHelpModal(false);
        return true;
      } catch (err: any) {
        console.warn('Microphone permission request error:', err);
        setMicStatus('denied');
        setShowHelpModal(true);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage('تم حظر المايكروفون في المتصفح. اتبع الخطوات بالأسفل لتفعيله.');
        } else {
          setErrorMessage('تعذر الوصول إلى المايكروفون. تأكد من تفعيله في إعدادات الهاتف.');
        }
        return false;
      }
    }
    return true;
  };

  const startListening = async () => {
    if (isRecordingRef.current) return;
    setErrorMessage(null);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage(
        'متصفحك الحالي لا يدعم التعرف الصوتي المباشر. يُفضل فتح الرابط في متصفح Google Chrome أو Safari الحديث.'
      );
      return;
    }

    // If permission not yet granted, request it first to trigger the browser system prompt
    if (micStatus !== 'granted') {
      const granted = await requestMicPermission();
      if (!granted) return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const rec = new SpeechRecognition();
      rec.lang = 'ar-EG';
      
      // On mobile devices, continuous=false prevents immediate silent timeout/crashes
      const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      rec.continuous = !isMobile;
      rec.interimResults = true;

      transcriptRef.current = '';
      setLiveTranscript('');
      setExampleIdx((prev) => (prev + 1) % EXAMPLES.length);
      setIsRecording(true);

      // Haptic feedback on phones if available
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(50);
        }
      } catch {}

      rec.onresult = (e: any) => {
        let text = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          text += e.results[i][0].transcript;
        }
        const trimmed = text.trim();
        transcriptRef.current = trimmed;
        setLiveTranscript(trimmed);
      };

      rec.onerror = async (e: any) => {
        console.error('Speech recognition error:', e);
        if (e.error === 'not-allowed') {
          setMicStatus('denied');
          // Try prompting via getUserMedia
          await requestMicPermission();
        } else if (e.error === 'no-speech') {
          // No speech detected, not fatal
        } else if (e.error === 'audio-capture') {
          setErrorMessage('المايكروفون غير متصل أو قيد الاستخدام بواسطة تطبيق آخر.');
          setIsRecording(false);
        } else if (e.error === 'network') {
          setErrorMessage('خطأ في الاتصال بخدمة التعرف الصوتي. تأكد من اتصال الإنترنت.');
          setIsRecording(false);
        }
      };

      rec.onend = () => {
        // If recording was active and we captured speech, finalize it
        if (isRecordingRef.current) {
          setIsRecording(false);
          const finalRaw = transcriptRef.current;
          if (finalRaw) {
            const parsed = parseSpokenSentence(finalRaw);
            onNewEntry(parsed);
          }
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsRecording(false);
      setErrorMessage('تعذر بدء التعرف الصوتي. يرجى إعادة المحاولة أو التأكد من إذن المايك.');
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
    }
  };

  // Click Mode Handlers
  const handleToggleClick = () => {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Hold Mode Handlers
  const handleHoldStart = () => {
    if (triggerMode === 'hold') {
      startListening();
    }
  };

  const handleHoldEnd = () => {
    if (triggerMode === 'hold' && isRecordingRef.current) {
      stopListening();
    }
  };

  return (
    <>
      {/* In-App Browser Warning Banner */}
      {isInAppBrowser && (
        <div className="fixed top-2 inset-x-3 z-50 bg-[#f59e0b] text-[#1e1b4b] p-3 rounded-xl shadow-2xl flex items-center justify-between text-xs sm:text-sm font-bold border border-amber-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>أنت تفتح التطبيق داخل واتساب أو فيسبوك! لتشغيل المايك اضغط على (⫶) واختر &quot;فتح في المتصفح Chrome&quot;.</span>
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

            <p className="text-xs text-[#94a3b8] mb-4 leading-relaxed">
              إذا لم تظهر علامة القفل القديمة، فذلك لأن متصفح Chrome الحديث استبدلها بأيقونة إعدادات جديدة. اتبع إحدى الطرق البسيطة التالية:
            </p>

            {/* Android Chrome Section */}
            <div className="bg-[#1e293b]/70 border border-[#334155] rounded-xl p-3.5 mb-3 text-xs leading-relaxed">
              <div className="font-black text-[#38bdf8] text-sm mb-2 flex items-center gap-1.5">
                <span>📱</span>
                <span>لهواتف أندرويد (Google Chrome):</span>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-[#e2e8f0]">
                <li>
                  <strong>أيقونة التحكم (🎛️ أو ⚙️):</strong> انظر لشريط الرابط بالأعلى بجانب اسم الموقع، اضغط على أيقونة الإعدادات/الشرطتين، ثم اختر <strong>&quot;الأذونات&quot;</strong> وفعّل <strong>الميكروفون (سماح)</strong>.
                </li>
                <li>
                  <strong>أو من قائمة المتصفح:</strong> اضغط على الثلاث نقاط (⫶) أعلى الشاشة ⬅️ <strong>الإعدادات</strong> ⬅️ <strong>إعدادات المواقع الإلكترونية</strong> ⬅️ <strong>الميكروفون</strong> ⬅️ فعّل السماح للموقع.
                </li>
              </ol>
            </div>

            {/* iPhone Safari Section */}
            <div className="bg-[#1e293b]/70 border border-[#334155] rounded-xl p-3.5 mb-4 text-xs leading-relaxed">
              <div className="font-black text-[#a78bfa] text-sm mb-2 flex items-center gap-1.5">
                <span>🍏</span>
                <span>لهواتف آيفون (Safari):</span>
              </div>
              <p className="text-[#e2e8f0]">
                اضغط على زر <strong>&quot;aA&quot;</strong> أو <strong>&quot;ع‌ع&quot;</strong> بجانب الرابط ⬅️ اختر <strong>إعدادات موقع الويب (Website Settings)</strong> ⬅️ الميكروفون ⬅️ اختر <strong>سماح (Allow)</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={requestMicPermission}
                className="w-full sm:flex-1 bg-gradient-to-r from-[#0284c7] to-[#38bdf8] text-[#090d16] font-black py-2.5 px-4 rounded-xl text-xs hover:brightness-110 cursor-pointer shadow-lg"
              >
                🔄 إعادة فحص وتفعيل المايك الآن
              </button>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="w-full sm:w-auto bg-[#334155] text-white font-bold py-2.5 px-5 rounded-xl text-xs hover:bg-[#475569] cursor-pointer"
              >
                فهمت، إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Error Banner if modal closed */}
      {errorMessage && !showHelpModal && (
        <div className="fixed top-16 inset-x-4 max-w-md mx-auto z-40 bg-[#1e1215] border-2 border-[#ef4444] text-[#fca5a5] p-3.5 rounded-2xl shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span>🎙️❌</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="bg-[#ef4444] text-white text-[11px] font-black px-2.5 py-1 rounded-lg cursor-pointer hover:bg-[#dc2626]"
          >
            كيف أفعّله؟
          </button>
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
            {liveTranscript ? liveTranscript : <span className="text-[#64748b] font-normal">في انتظار صوتك...</span>}
          </div>
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-[#090d16]/96 backdrop-blur-md border-t border-[#1f293d] p-3 sm:pb-4 shadow-2xl">
        <div className="max-w-md mx-auto flex flex-col items-center gap-2">
          {/* Trigger mode selector pills & Mic permission indicator */}
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

            {/* Mic Permission test button */}
            <button
              type="button"
              onClick={requestMicPermission}
              title="فحص وتفعيل إذن المايك"
              className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                micStatus === 'granted'
                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30'
                  : micStatus === 'denied'
                  ? 'border-rose-500/40 text-rose-400 bg-rose-950/30 animate-pulse'
                  : 'border-[#334155] text-[#94a3b8] bg-[#111827] hover:text-white'
              }`}
            >
              <span>{micStatus === 'granted' ? '✅' : '🎙️'}</span>
              <span>{micStatus === 'granted' ? 'المايك مفعل' : 'إذن المايك'}</span>
            </button>
          </div>

          {/* Main Interactive Button */}
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
                {isRecording ? 'جاري الاستماع... اضغط هنا للإنهاء والحفظ' : 'اضغط للتسجيل الصوتي (بالعامية المصرية)'}
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
