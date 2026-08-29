import React from 'react';
import { Mic, User, Check, Sparkles, Volume2, ShieldCheck, Tag } from 'lucide-react';
import { VoiceOption } from '../types';
import { GEMINI_VOICES } from '../data/voices';

interface VoicePickerProps {
  selectedVoiceName: string;
  onSelectVoice: (voiceName: string) => void;
  onPreviewVoice?: (voice: VoiceOption) => void;
}

export const VoicePicker: React.FC<VoicePickerProps> = ({
  selectedVoiceName,
  onSelectVoice,
  onPreviewVoice,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 tracking-tight">
            <Mic className="w-4 h-4 text-indigo-500" />
            Gemini Prebuilt Neural Voices
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select a neural voice profile tuned for distinct timbres and acoustic personas
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#181822] px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#262634]">
          {GEMINI_VOICES.length} Voices Available
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {GEMINI_VOICES.map((voice) => {
          const isSelected = selectedVoiceName.toLowerCase() === voice.name.toLowerCase();

          return (
            <div
              key={voice.id}
              id={`voice-card-${voice.id.toLowerCase()}`}
              onClick={() => onSelectVoice(voice.name)}
              className={`relative group rounded-xl p-3.5 text-left transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/40 shadow-sm dark:shadow-[0_0_15px_rgba(99,102,241,0.12)]'
                  : 'bg-white dark:bg-[#111116] border-slate-200 dark:border-[#20202A] hover:border-slate-300 dark:hover:border-[#2E2E3C] hover:bg-slate-50/50 dark:hover:bg-[#15151C]'
              }`}
            >
              {/* Header: Name, Gender badge, Selection tick */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                        : 'bg-slate-100 dark:bg-[#1C1C26] text-slate-700 dark:text-slate-300 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950/60'
                    }`}
                  >
                    {voice.name[0]}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-none">
                      {voice.name}
                    </h4>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {voice.gender} • {voice.pitch} pitch
                    </span>
                  </div>
                </div>

                {isSelected ? (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/30">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1A1A24] text-slate-500 dark:text-slate-400">
                    {voice.gender === 'Female' ? '♀' : '♂'}
                  </span>
                )}
              </div>

              {/* Timbre & Tone */}
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-2.5 leading-relaxed">
                {voice.description}
              </p>

              {/* Personality Pills */}
              <div className="flex flex-wrap gap-1 mb-2.5">
                {voice.personality.slice(0, 2).map((trait) => (
                  <span
                    key={trait}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#181822] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-[#242432] font-medium"
                  >
                    {trait}
                  </span>
                ))}
              </div>

              {/* Recommended Tag */}
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 border-t border-slate-100 dark:border-[#1E1E28] pt-2">
                <Tag className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                <span className="truncate">{voice.recommendedFor[0]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
