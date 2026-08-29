import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Play,
  Sliders,
  Radio,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { DialogueTurn, SampleRate, PhoneticRule } from '../types';
import { GEMINI_VOICES } from '../data/voices';
import { VOCAL_STYLES } from '../data/styles';
import { DIALOGUE_PRESETS } from '../data/dialoguePresets';

interface MultiSpeakerStudioProps {
  onSynthesizeDialogue: (params: {
    turns: DialogueTurn[];
    sampleRate: SampleRate;
  }) => Promise<void>;
  isSynthesizing: boolean;
  activeRules: PhoneticRule[];
  onOpenScriptAssistant: (initialTopic: string) => void;
}

export const MultiSpeakerStudio: React.FC<MultiSpeakerStudioProps> = ({
  onSynthesizeDialogue,
  isSynthesizing,
  activeRules,
  onOpenScriptAssistant,
}) => {
  const [turns, setTurns] = useState<DialogueTurn[]>(() => {
    const defaultPreset = DIALOGUE_PRESETS[0];
    return defaultPreset.turns.map((t, idx) => ({
      ...t,
      id: `turn-${Date.now()}-${idx}`,
    }));
  });

  const [selectedSampleRate, setSelectedSampleRate] = useState<SampleRate>(24000);

  const handleAddTurn = () => {
    const lastTurn = turns[turns.length - 1];
    const newSpeaker = lastTurn?.speaker === 'Speaker 1' ? 'Speaker 2' : 'Speaker 1';
    const newVoice = lastTurn?.voiceName === 'Puck' ? 'Kore' : 'Puck';

    setTurns([
      ...turns,
      {
        id: `turn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        speaker: newSpeaker,
        voiceName: newVoice,
        styleDirectiveId: 'natural',
        text: '',
      },
    ]);
  };

  const handleRemoveTurn = (id: string) => {
    if (turns.length <= 1) return;
    setTurns(turns.filter((t) => t.id !== id));
  };

  const handleMoveTurn = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= turns.length) return;
    const newTurns = [...turns];
    const [moved] = newTurns.splice(index, 1);
    newTurns.splice(targetIndex, 0, moved);
    setTurns(newTurns);
  };

  const handleUpdateTurn = (id: string, updates: Partial<DialogueTurn>) => {
    setTurns(turns.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = DIALOGUE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setTurns(
      preset.turns.map((t, idx) => ({
        ...t,
        id: `turn-${Date.now()}-${idx}`,
      }))
    );
  };

  const handleGenerate = () => {
    const validTurns = turns.filter((t) => t.text.trim().length > 0);
    if (validTurns.length === 0 || isSynthesizing) return;
    onSynthesizeDialogue({
      turns: validTurns,
      sampleRate: selectedSampleRate,
    });
  };

  // Distinct speakers list
  const distinctSpeakers = Array.from(new Set(turns.map((t) => t.speaker)));

  return (
    <div className="space-y-6 pb-24">
      {/* Top Presets */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0F0F13] p-4 rounded-2xl border border-slate-200 dark:border-[#1F1F28] shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Dialogue Presets:
          </span>
          {DIALOGUE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleLoadPreset(preset.id)}
              className="text-xs px-3 py-1 rounded-lg bg-slate-100 dark:bg-[#14141A] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-[#22222E] transition-all"
            >
              {preset.title}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {turns.length} turns • {distinctSpeakers.length} speakers
          </span>
          <button
            onClick={() => onOpenScriptAssistant('Generate a podcast dialogue')}
            className="text-xs px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
          >
            AI Script Generator
          </button>
        </div>
      </div>

      {/* Turns Editor List */}
      <div className="space-y-3">
        {turns.map((turn, index) => {
          const voiceObj = GEMINI_VOICES.find(
            (v) => v.name.toLowerCase() === turn.voiceName.toLowerCase()
          );

          return (
            <div
              key={turn.id}
              id={`dialogue-turn-${index}`}
              className="bg-white dark:bg-[#0F0F13] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-[#1F1F28] shadow-sm space-y-3.5 transition-all hover:border-slate-300 dark:hover:border-[#2C2C3A]"
            >
              {/* Turn Header: Speaker Name, Voice select, Style Directive, Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1E1E28] pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-800/60">
                    {index + 1}
                  </span>

                  {/* Speaker Label */}
                  <input
                    type="text"
                    value={turn.speaker}
                    onChange={(e) => handleUpdateTurn(turn.id, { speaker: e.target.value })}
                    placeholder="Speaker Name"
                    className="w-32 sm:w-40 font-semibold text-sm bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#22222E] rounded-lg px-2.5 py-1 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  {/* Voice Selector Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-slate-500 dark:text-slate-400">Voice:</label>
                    <select
                      value={turn.voiceName}
                      onChange={(e) => handleUpdateTurn(turn.id, { voiceName: e.target.value })}
                      className="text-xs bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#22222E] rounded-lg px-2.5 py-1 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {GEMINI_VOICES.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.gender}, {v.timbre.split(',')[0]})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Style Directive */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-slate-500 dark:text-slate-400">Tone:</label>
                    <select
                      value={turn.styleDirectiveId || 'natural'}
                      onChange={(e) =>
                        handleUpdateTurn(turn.id, { styleDirectiveId: e.target.value })
                      }
                      className="text-xs bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#22222E] rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {VOCAL_STYLES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Turn Actions: Move Up, Move Down, Delete */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveTurn(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#181822] disabled:opacity-30 transition-colors"
                    title="Move turn up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveTurn(index, 'down')}
                    disabled={index === turns.length - 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#181822] disabled:opacity-30 transition-colors"
                    title="Move turn down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemoveTurn(turn.id)}
                    disabled={turns.length <= 1}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 transition-colors"
                    title="Delete turn"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Turn Text Area */}
              <textarea
                rows={2}
                value={turn.text}
                onChange={(e) => handleUpdateTurn(turn.id, { text: e.target.value })}
                placeholder={`What should ${turn.speaker || 'this speaker'} say?`}
                className="w-full rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#22222E] p-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 leading-relaxed resize-none transition-all placeholder:text-slate-500"
              />
            </div>
          );
        })}

        {/* Add Turn Button */}
        <button
          id="add-dialogue-turn-btn"
          onClick={handleAddTurn}
          className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-[#22222E] hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium text-xs flex items-center justify-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Dialogue Turn
        </button>
      </div>

      {/* Bottom Bar: Sample Rate & Generate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#121218] via-[#0F0F14] to-[#0A0A0D] p-5 rounded-2xl text-white border border-[#1F1F28] shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Users className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Dialogue Synthesis</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-indigo-400 font-mono font-medium">{turns.length} Turns Concatenated</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span>Sample Rate:</span>
              <div className="flex items-center gap-1 bg-[#161620] rounded-lg p-0.5 border border-[#262634]">
                {[
                  { rate: 24000 as SampleRate, label: '24k Studio' },
                  { rate: 16000 as SampleRate, label: '16k AI/VoIP' },
                  { rate: 8000 as SampleRate, label: '8k Telephony' },
                ].map((item) => (
                  <button
                    key={item.rate}
                    onClick={() => setSelectedSampleRate(item.rate)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      selectedSampleRate === item.rate
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          id="synthesize-dialogue-main-btn"
          onClick={handleGenerate}
          disabled={isSynthesizing || turns.every((t) => !t.text.trim())}
          className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#181822] disabled:text-slate-600 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {isSynthesizing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Synthesizing Dialogue...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Generate Full Dialogue</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
