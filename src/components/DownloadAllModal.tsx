import React, { useState } from 'react';
import {
  Download,
  FolderArchive,
  CheckCircle2,
  FileText,
  Radio,
  Sparkles,
  Layers,
  X,
  Loader2,
  HardDrive,
  FileCode,
  Check,
} from 'lucide-react';
import { AudioClip, GenerationHistoryItem, SampleRate } from '../types';
import { downloadClipsZip, ZipExportFormat, ZipExportProgress } from '../utils/zipExport';

interface DownloadAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: (AudioClip | GenerationHistoryItem)[];
  title?: string;
  subtitle?: string;
}

export const DownloadAllModal: React.FC<DownloadAllModalProps> = ({
  isOpen,
  onClose,
  clips,
  title = 'Download All Generated Audio Clips',
  subtitle = 'Package your audio generations into a compressed ZIP archive with metadata index',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ZipExportFormat>('original');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ZipExportProgress | null>(null);
  const [customZipName, setCustomZipName] = useState(
    `voice_studio_clips_${new Date().toISOString().slice(0, 10)}`
  );

  if (!isOpen) return null;

  const handleStartDownload = async () => {
    if (clips.length === 0) return;
    setIsExporting(true);
    setProgress({
      current: 0,
      total: clips.length,
      currentTitle: 'Starting export...',
      status: 'resampling',
    });

    try {
      await downloadClipsZip(clips, {
        format: selectedFormat,
        zipFilename: `${customZipName.trim() || 'voice_studio_clips'}.zip`,
        onProgress: (p) => setProgress(p),
      });

      // Brief delay to show completion
      setTimeout(() => {
        setIsExporting(false);
        setProgress(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('ZIP download error:', err);
      setProgress((prev) =>
        prev
          ? { ...prev, status: 'error', error: err.message || 'Failed to create ZIP package' }
          : null
      );
      setIsExporting(false);
    }
  };

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0F0F13] rounded-3xl border border-slate-200 dark:border-[#262634] shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-[#1A1A24] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C1C26] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Summary Stat */}
          <div className="bg-slate-50 dark:bg-[#09090C] rounded-2xl p-4 border border-slate-200 dark:border-[#1F1F28] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                Total Clips to Export:
              </span>
            </div>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
              {clips.length} {clips.length === 1 ? 'Clip' : 'Clips'}
            </span>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Select Export Codec / Sample Rate
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Original Rate */}
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setSelectedFormat('original')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedFormat === 'original'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-[#22222E] bg-white dark:bg-[#121218] hover:border-slate-300 dark:hover:border-[#333344]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Original Sample Rates
                  </span>
                  {selectedFormat === 'original' && (
                    <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Keep each clip at its native generated sample rate (8k, 16k, or 24k).
                </p>
              </button>

              {/* Option 2: 8 kHz Telephony */}
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setSelectedFormat(8000)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedFormat === 8000
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500'
                    : 'border-slate-200 dark:border-[#22222E] bg-white dark:bg-[#121218] hover:border-slate-300 dark:hover:border-[#333344]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    8 kHz PSTN Telephony
                  </span>
                  {selectedFormat === 8000 && (
                    <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Transcode all clips to 8,000 Hz for Asterisk, Twilio, and PBX IVR.
                </p>
              </button>

              {/* Option 3: 16 kHz VoIP / Whisper */}
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setSelectedFormat(16000)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedFormat === 16000
                    ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40 text-cyan-950 dark:text-cyan-200 ring-1 ring-cyan-500'
                    : 'border-slate-200 dark:border-[#22222E] bg-white dark:bg-[#121218] hover:border-slate-300 dark:hover:border-[#333344]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    16 kHz VoIP / Whisper
                  </span>
                  {selectedFormat === 16000 && (
                    <Check className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Transcode all clips to 16,000 Hz for SIP, WebRTC, and Whisper STT.
                </p>
              </button>

              {/* Option 4: Multi-Codec Studio Pack */}
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setSelectedFormat('all_formats')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedFormat === 'all_formats'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-[#22222E] bg-white dark:bg-[#121218] hover:border-slate-300 dark:hover:border-[#333344]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Triple-Codec Master Pack
                  </span>
                  {selectedFormat === 'all_formats' && (
                    <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Includes 3 folders (8k, 16k, and 24k) for every single clip.
                </p>
              </button>
            </div>
          </div>

          {/* Included Package Assets */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#1F1F28] space-y-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Package Contents:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>16-bit Mono WAV files</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>manifest.json (Metadata)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>transcripts.txt (Index)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>README & Telephony specs</span>
              </div>
            </div>
          </div>

          {/* Archive Filename */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ZIP File Name
            </label>
            <div className="flex items-center">
              <input
                type="text"
                disabled={isExporting}
                value={customZipName}
                onChange={(e) => setCustomZipName(e.target.value)}
                className="w-full text-xs font-mono px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#121217] border border-slate-200 dark:border-[#262634] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="ml-2 font-mono text-xs text-slate-400">.zip</span>
            </div>
          </div>

          {/* Progress Bar during Export */}
          {isExporting && progress && (
            <div className="space-y-2 p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-indigo-900 dark:text-indigo-200 truncate max-w-[280px]">
                  {progress.status === 'resampling'
                    ? `Processing ${progress.current} of ${progress.total}: ${progress.currentTitle}`
                    : progress.currentTitle}
                </span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full bg-indigo-200 dark:bg-indigo-950 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-[#09090C] border-t border-slate-100 dark:border-[#1A1A24] flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#181822] hover:bg-slate-100 dark:hover:bg-[#222230] text-slate-700 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-[#262634] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isExporting || clips.length === 0}
            onClick={handleStartDownload}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating ZIP ({progressPercent}%)...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download {clips.length} Clips (.ZIP)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
