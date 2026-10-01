'use client';

import React, { useState, useRef } from 'react';
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
  const [triggerMode, setTriggerMode] = useState<'hold' | 'click'>('hold');
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [exampleIdx, setExampleIdx] = useState(0);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  const startListening = () => {
    if (isRecording) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('متصفحك لا يدعم التعرف الصوتي المباشر. يُفضل استخدام متصفح Google Chrome.');
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

      rec.onresult = (e: any) => {
        let text = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          text += e.results[i][0].transcript;
        }
        const trimmed = text.trim();
        transcriptRef.current = trimmed;
        setLiveTranscript(trimmed);
      };

      rec.onerror = (e: any) => {
        console.error('Speech error:', e);
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsRecording(false);
    }
  };

  const stopListening = () => {
    if (!isRecording) return;
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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (triggerMode === 'hold') startListening();
    else {
      if (!isRecording) startListening();
      else stopListening();
    }
  };

  const handleMouseUp = () => {
    if (triggerMode === 'hold' && isRecording) {
      stopListening();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (triggerMode === 'hold') startListening();
    else {
      if (!isRecording) startListening();
      else stopListening();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (triggerMode === 'hold' && isRecording) {
      stopListening();
    }
  };

  return (
    <>
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
          {/* Trigger mode pills */}
          <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-full border border-[#1f293d] text-xs font-bold">
            <button
              onClick={() => setTriggerMode('hold')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                triggerMode === 'hold' ? 'bg-[#0284c7] text-white shadow-xs' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              👆 الضغط المتواصل (Hold)
            </button>
            <button
              onClick={() => setTriggerMode('click')}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                triggerMode === 'click' ? 'bg-[#0284c7] text-white shadow-xs' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              🎙️ نقرة للبدء ونقرة للإنهاء
            </button>
          </div>

          {/* Main Push to talk button */}
          <button
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
            className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all select-none cursor-pointer shadow-lg ${
              isRecording
                ? 'bg-gradient-to-r from-[#dc2626] to-[#ef4444] text-white shadow-[#ef4444]/40 scale-98 animate-pulse'
                : 'bg-gradient-to-r from-[#0284c7] to-[#38bdf8] hover:brightness-110 text-[#090d16] shadow-[#38bdf8]/25 active:scale-98'
            }`}
          >
            <span className="text-xl">🎙️</span>
            <span>
              {isRecording
                ? triggerMode === 'hold'
                  ? 'جاري التسجيل... ارفع صباعك للحفظ'
                  : 'جاري التسجيل... اضغط للإنهاء والحفظ'
                : triggerMode === 'hold'
                ? 'اضغط مطولاً وتكلم (Hold to Speak)'
                : 'اضغط للبدء بالتسجيل الصوتي'}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
