import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Volume2,
  Sliders,
  Radio,
  FileText,
  Play,
  RotateCcw,
  Check,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Wand2,
} from 'lucide-react';
import { SampleRate, PhoneticRule } from '../types';
import { VoicePicker } from './VoicePicker';
import { VOCAL_STYLES } from '../data/styles';
import { detectPhoneticMatches, applyPhoneticReplacements } from '../utils/phoneticEngine';

interface SingleSpeakerStudioProps {
  onSynthesize: (params: {
    text: string;
    voiceName: string;
    styleDirectiveId: string;
    sampleRate: SampleRate;
  }) => Promise<void>;
  isSynthesizing: boolean;
  activeRules: PhoneticRule[];
  onOpenPhoneticModal: () => void;
  onOpenScriptAssistant: (initialText: string) => void;
}

const SAMPLE_PROMPTS = [
  {
    title: 'Telephony PBX IVR',
    styleId: 'telephony_ivr',
    sampleRate: 8000 as SampleRate,
    voiceName: 'Zephyr',
    text: 'Thank you for calling Nova Cloud IVR. For account authentication and API gateway status, press 1. For PSTN telephone routing, press 2.',
  },
  {
    title: 'Acronym & JCOD Normalization',
    styleId: 'broadcaster',
    sampleRate: 24000 as SampleRate,
    voiceName: 'Puck',
    text: 'The JCOD protocol processes TTS audio through high-efficiency VoIP and Whisper pipelines, ensuring sub-millisecond API latency.',
  },
  {
    title: 'Studio Tech Podcast',
    styleId: 'energetic',
    sampleRate: 24000 as SampleRate,
    voiceName: 'Puck',
    text: 'Welcome back to the Deep Tech Daily! Today we are exploring neural speech synthesis models delivering crystal-clear 24 kHz high-definition audio.',
  },
  {
    title: 'Empathetic Customer Care',
    styleId: 'empathetic',
    sampleRate: 16000 as SampleRate,
    voiceName: 'Kore',
    text: 'We truly appreciate your patience while we verify your cloud security settings. Everything looks in order, and your service is now fully active.',
  },
];

export const SingleSpeakerStudio: React.FC<SingleSpeakerStudioProps> = ({
  onSynthesize,
  isSynthesizing,
  activeRules,
  onOpenPhoneticModal,
  onOpenScriptAssistant,
}) => {
  const [text, setText] = useState(
    'Welcome to the Gemini Voice Synthesis Studio. The JCOD audio engine seamlessly converts neural speech into clean 8 kHz telephony and 16 kHz Whisper audio.'
  );
  const [selectedVoiceName, setSelectedVoiceName] = useState('Kore');
  const [selectedStyleId, setSelectedStyleId] = useState('natural');
  const [selectedSampleRate, setSelectedSampleRate] = useState<SampleRate>(24000);
  const [showPreviewTransform, setShowPreviewTransform] = useState(false);

  // Real-time phonetic detection
  const detectedMatches = useMemo(() => {
    return detectPhoneticMatches(text, activeRules);
  }, [text, activeRules]);

  // Transformed preview
  const transformation = useMemo(() => {
    return applyPhoneticReplacements(text, activeRules);
  }, [text, activeRules]);

  // Estimated duration (~140 words per minute)
  const estimatedWords = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimatedSeconds = ((estimatedWords / 140) * 60).toFixed(1);

  const handleSynthesizeClick = () => {
    if (!text.trim() || isSynthesizing) return;
    onSynthesize({
      text,
      voiceName: selectedVoiceName,
      styleDirectiveId: selectedStyleId,
      sampleRate: selectedSampleRate,
    });
  };

  const handleApplyPreset = (p: (typeof SAMPLE_PROMPTS)[0]) => {
    setText(p.text);
    setSelectedVoiceName(p.voiceName);
    setSelectedStyleId(p.styleId);
    setSelectedSampleRate(p.sampleRate);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Top Presets Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          Quick Presets:
        </span>
        {SAMPLE_PROMPTS.map((p) => (
          <button
            key={p.title}
            onClick={() => handleApplyPreset(p)}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#14141A] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-[#22222E] transition-all"
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Voice Selection Cards */}
      <div className="bg-white dark:bg-[#0F0F13] rounded-2xl p-5 border border-slate-200 dark:border-[#1F1F28] shadow-sm">
        <VoicePicker
          selectedVoiceName={selectedVoiceName}
          onSelectVoice={setSelectedVoiceName}
        />
      </div>

      {/* Main Studio Input Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Text Prompt Area & Phonetic Tags */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-[#0F0F13] rounded-2xl p-5 border border-slate-200 dark:border-[#1F1F28] shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <label className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  Speech Text Script
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenScriptAssistant(text)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/80 transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  AI Script Assistant
                </button>

                <button
                  onClick={onOpenPhoneticModal}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#262634] transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Phonetics ({activeRules.filter((r) => r.enabled).length})
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                id="tts-text-input"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to synthesize into spoken audio..."
                className="w-full rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#22222E] p-3.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 leading-relaxed resize-none transition-all placeholder:text-slate-500"
              />
            </div>

            {/* Text stats & phonetic match indicators */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <div className="flex items-center gap-3 font-mono">
                <span>{text.length} chars</span>
                <span>•</span>
                <span>{estimatedWords} words</span>
                <span>•</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  ~{estimatedSeconds}s audio
                </span>
              </div>

              {/* Detected Phonetic Replacements Badge */}
              {detectedMatches.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Auto-normalized:</span>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(detectedMatches.map((m) => `${m.matchedText} ➔ ${m.replacementText}`)))
                      .slice(0, 3)
                      .map((label, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        >
                          {label}
                        </span>
                      ))}
                    {detectedMatches.length > 3 && (
                      <span className="text-[10px] text-slate-400">
                        +{detectedMatches.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Phonetic Transformed Live Preview Toggle */}
            <div className="border-t border-slate-100 dark:border-[#1E1E28] pt-2.5">
              <button
                type="button"
                onClick={() => setShowPreviewTransform(!showPreviewTransform)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {showPreviewTransform ? 'Hide Phonetic Preview' : 'Preview Normalized Acoustic Text'}
              </button>

              {showPreviewTransform && (
                <div className="mt-2.5 p-3.5 rounded-xl bg-slate-100/80 dark:bg-[#0A0A0D] border border-slate-200 dark:border-[#22222E] text-xs space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Acoustic Input Sent to Gemini TTS:
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 font-mono leading-relaxed">
                    {transformation.transformedText}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {transformation.appliedCount} phonetic substitutions applied
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Vocal Style Directives & Sample Rate Selector */}
        <div className="space-y-4">
          {/* Vocal Style Directives */}
          <div className="bg-white dark:bg-[#0F0F13] rounded-2xl p-5 border border-slate-200 dark:border-[#1F1F28] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 tracking-tight">
                <Sliders className="w-4 h-4 text-indigo-500" />
                Vocal Style Directive
              </label>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Acoustic Tone
              </span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {VOCAL_STYLES.map((style) => {
                const isSelected = selectedStyleId === style.id;
                return (
                  <div
                    key={style.id}
                    id={`style-directive-${style.id}`}
                    onClick={() => setSelectedStyleId(style.id)}
                    className={`p-2.5 rounded-xl cursor-pointer text-left transition-all border ${
                      isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-100 ring-1 ring-indigo-500/30'
                        : 'bg-slate-50/50 dark:bg-[#09090C] border-slate-200/80 dark:border-[#1F1F28] hover:bg-slate-100 dark:hover:bg-[#14141B] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs">{style.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight line-clamp-1">
                      {style.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sample Rate Selector */}
          <div className="bg-white dark:bg-[#0F0F13] rounded-2xl p-5 border border-slate-200 dark:border-[#1F1F28] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 tracking-tight">
                <Radio className="w-4 h-4 text-indigo-500" />
                Target Sample Rate
              </label>
              <span className="text-[10px] text-slate-400 font-mono">16-bit Mono PCM</span>
            </div>

            <div className="space-y-2">
              {/* 24 kHz */}
              <div
                id="samplerate-24k-option"
                onClick={() => setSelectedSampleRate(24000)}
                className={`p-2.5 rounded-xl cursor-pointer border text-left transition-all ${
                  selectedSampleRate === 24000
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/30 shadow-sm'
                    : 'bg-slate-50/50 dark:bg-[#09090C] border-slate-200 dark:border-[#1F1F28] hover:border-slate-300 dark:hover:border-[#2C2C3A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                    24 kHz (24,000 Hz)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">48 kB/s</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Native Studio HD bandwidth for high-fidelity voiceovers.
                </p>
              </div>

              {/* 16 kHz */}
              <div
                id="samplerate-16k-option"
                onClick={() => setSelectedSampleRate(16000)}
                className={`p-2.5 rounded-xl cursor-pointer border text-left transition-all ${
                  selectedSampleRate === 16000
                    ? 'bg-cyan-50/90 dark:bg-cyan-950/30 border-cyan-500 ring-1 ring-cyan-500/30 shadow-sm'
                    : 'bg-slate-50/50 dark:bg-[#09090C] border-slate-200 dark:border-[#1F1F28] hover:border-slate-300 dark:hover:border-[#2C2C3A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"></span>
                    16 kHz (16,000 Hz)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">32 kB/s</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Standard AI Whisper pipelines, VoIP codecs, and SIP telephony.
                </p>
              </div>

              {/* 8 kHz */}
              <div
                id="samplerate-8k-option"
                onClick={() => setSelectedSampleRate(8000)}
                className={`p-2.5 rounded-xl cursor-pointer border text-left transition-all ${
                  selectedSampleRate === 8000
                    ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-500 ring-1 ring-amber-500/30 shadow-sm'
                    : 'bg-slate-50/50 dark:bg-[#09090C] border-slate-200 dark:border-[#1F1F28] hover:border-slate-300 dark:hover:border-[#2C2C3A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                    8 kHz (8,000 Hz)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">16 kB/s</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  PSTN phone lines, Asterisk PBX, and legacy IVR menus.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Synthesize Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#121218] via-[#0F0F14] to-[#0A0A0D] p-5 rounded-2xl text-white border border-[#1F1F28] shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Voice: {selectedVoiceName}</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-indigo-400 font-mono font-medium">{selectedSampleRate / 1000} kHz WAV</span>
            </div>
            <p className="text-xs text-slate-400">
              Style: {VOCAL_STYLES.find((s) => s.id === selectedStyleId)?.name || 'Natural'}
            </p>
          </div>
        </div>

        <button
          id="synthesize-speech-main-btn"
          onClick={handleSynthesizeClick}
          disabled={isSynthesizing || !text.trim()}
          className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#181822] disabled:text-slate-600 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {isSynthesizing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Synthesizing Voice...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Generate Audio Clip</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
