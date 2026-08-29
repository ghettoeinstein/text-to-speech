import React, { useState } from 'react';
import {
  History,
  Trash2,
  Download,
  Play,
  Volume2,
  Calendar,
  Layers,
  ArrowUpRight,
  Sparkles,
  BookmarkPlus,
  FolderArchive,
} from 'lucide-react';
import { GenerationHistoryItem, SampleRate } from '../types';
import { decodeWav, encode16BitMonoWav, resampleAudioBuffer } from '../utils/audioDsp';
import { triggerAudioDownload } from '../utils/clientAudio';
import { DownloadAllModal } from './DownloadAllModal';

interface HistoryTabProps {
  history: GenerationHistoryItem[];
  onPlayItem: (item: GenerationHistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onReloadToStudio: (item: GenerationHistoryItem) => void;
  onSaveToLibrary?: (item: GenerationHistoryItem) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  history,
  onPlayItem,
  onDeleteItem,
  onClearAll,
  onReloadToStudio,
  onSaveToLibrary,
}) => {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  const handleExportSampleRate = async (item: GenerationHistoryItem, targetRate: SampleRate) => {
    if (!item.audioUrl) return;
    try {
      const response = await fetch(item.audioUrl);
      const arrayBuf = await response.arrayBuffer();
      const decoded = decodeWav(arrayBuf);
      const resampled = resampleAudioBuffer(decoded.monoSamples, decoded.sampleRate, targetRate);
      const outBuffer = encode16BitMonoWav(resampled, targetRate);
      const blob = new Blob([outBuffer], { type: 'audio/wav' });

      const safeTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 25);
      triggerAudioDownload(blob, `${safeTitle}_${targetRate}hz_16bit_mono.wav`);
    } catch (e) {
      console.error('Export error:', e);
    }
  };

  const getSampleRateColor = (rate: SampleRate) => {
    switch (rate) {
      case 8000:
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 16000:
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      case 24000:
      default:
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
  };

  if (history.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0F0F13] rounded-3xl p-12 border border-slate-200 dark:border-[#1F1F28] text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#181822] text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto border border-slate-200/60 dark:border-[#262634]">
          <History className="w-8 h-8 text-indigo-500" />
        </div>
        <div className="max-w-sm mx-auto">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">No Audio Generations Yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Synthesize your first text-to-speech voice clip or dialogue to save it to your local vault.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" />
          <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
            Generation Vault & History
          </h3>
          <span className="text-xs text-slate-400 font-mono">({history.length} items)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDownloadModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            title="Download all generated history as a ZIP bundle"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Download All History (.ZIP)</span>
          </button>

          <button
            onClick={onClearAll}
            className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 font-medium px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Vault
          </button>
        </div>
      </div>

      {/* Grid of history cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {history.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-[#0F0F13] rounded-2xl p-4 border border-slate-200 dark:border-[#1F1F28] shadow-sm space-y-3 hover:border-slate-300 dark:hover:border-[#2C2C3A] transition-all flex flex-col justify-between"
          >
            <div>
              {/* Top Row: Title, Date, Sample Rate Tag */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{item.voiceName}</span>
                    <span>•</span>
                    <span>{item.duration ? `${item.duration.toFixed(1)}s` : 'WAV'}</span>
                    <span>•</span>
                    <span className="font-mono">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-medium ${getSampleRateColor(
                    item.sampleRate
                  )}`}
                >
                  {item.sampleRate / 1000} kHz
                </span>
              </div>

              {/* Text Snippet */}
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-2 leading-relaxed bg-slate-50 dark:bg-[#09090C] p-2.5 rounded-xl border border-slate-100 dark:border-[#1F1F28] font-mono">
                "{item.text}"
              </p>
            </div>

            {/* Bottom Actions: Play in bar, Reload to studio, Export options, Delete */}
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-[#1E1E28] text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPlayItem(item)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play
                </button>

                <button
                  onClick={() => onReloadToStudio(item)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-700 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-[#262634] transition-colors"
                  title="Load text & voice into Studio"
                >
                  Load in Studio
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {onSaveToLibrary && (
                  <button
                    onClick={() => onSaveToLibrary(item)}
                    className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    title="Save to Clip Library"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleExportSampleRate(item, item.sampleRate)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#181822] transition-colors"
                  title="Download WAV"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteItem(item.id)}
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Download All History Modal */}
      <DownloadAllModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        clips={history}
        title="Download All Generation History (.ZIP)"
        subtitle="Package all previous voice outputs into a ZIP archive with transcripts & metadata"
      />
    </div>
  );
};
