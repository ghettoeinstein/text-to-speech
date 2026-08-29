import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BookmarkCheck,
  Star,
  Play,
  Pause,
  Download,
  Trash2,
  Edit2,
  Plus,
  Search,
  Filter,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  UploadCloud,
  FileDown,
  FileUp,
  Tag,
  Folder,
  Layers,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Radio,
  Copy,
  ExternalLink,
  RefreshCw,
  Info,
  CheckSquare,
  Square,
  Music,
  Mic,
  Users,
  HardDrive,
  Share2,
  X,
  Volume1,
  ArrowUpDown,
  FolderArchive,
} from 'lucide-react';
import { AudioClip, ClipCategory, SampleRate } from '../types';
import { decodeWav, encode16BitMonoWav, resampleAudioBuffer } from '../utils/audioDsp';
import { triggerAudioDownload } from '../utils/clientAudio';
import { DownloadAllModal } from './DownloadAllModal';

interface ClipLibraryTabProps {
  clips: AudioClip[];
  onPlayClip: (clip: AudioClip) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteClip: (id: string) => void;
  onUpdateClip: (clip: AudioClip) => void;
  onAddClip: (clip: AudioClip) => void;
  onImportLibrary: (jsonStr: string) => Promise<number>;
  onExportLibrary: () => Promise<void>;
  onClearLibrary: () => void;
  onReloadToStudio?: (text: string, voiceName?: string, sampleRate?: SampleRate) => void;
}

const CATEGORIES: ('All' | ClipCategory)[] = [
  'All',
  'IVR & Telephony',
  'Voice Assistant',
  'Voicemail & Attendant',
  'Podcast & Narration',
  'Prompts & Soundbites',
  'Conversational Dialogue',
  'Custom',
];

type ViewMode = 'grid' | 'soundboard' | 'table';
type TreeFilterType = 'all' | 'favorites' | 'category' | 'sample_rate' | 'voice' | 'tag';

export const ClipLibraryTab: React.FC<ClipLibraryTabProps> = ({
  clips,
  onPlayClip,
  onToggleFavorite,
  onDeleteClip,
  onUpdateClip,
  onAddClip,
  onImportLibrary,
  onExportLibrary,
  onClearLibrary,
  onReloadToStudio,
}) => {
  // Navigation / Tree Browser Filter State
  const [selectedTreeFilter, setSelectedTreeFilter] = useState<{
    type: TreeFilterType;
    value: string;
  }>({ type: 'all', value: 'all' });

  // Search and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSampleRate, setSelectedSampleRate] = useState<'All' | SampleRate>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'duration_desc' | 'duration_asc' | 'title'>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Active audio player state within the library
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [activeAudioElement, setActiveAudioElement] = useState<HTMLAudioElement | null>(null);

  // Selected clip for Detail / Inspector Drawer
  const [inspectedClipId, setInspectedClipId] = useState<string | null>(null);

  // Batch selection state
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);

  // Edit Clip Modal State
  const [editingClip, setEditingClip] = useState<AudioClip | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<ClipCategory>('IVR & Telephony');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');

  // Upload Custom Clip Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<ClipCategory>('Custom');
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadTagInput, setUploadTagInput] = useState('');
  const [uploadTargetRate, setUploadTargetRate] = useState<SampleRate>(24000);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);

  // Download All ZIP modal state
  const [isDownloadAllModalOpen, setIsDownloadAllModalOpen] = useState(false);
  const [downloadModalClips, setDownloadModalClips] = useState<AudioClip[]>([]);
  const [downloadModalTitle, setDownloadModalTitle] = useState('Download All Audio Clips');

  // Export dropdown state per clip
  const [activeExportMenuId, setActiveExportMenuId] = useState<string | null>(null);
  const [copiedTranscriptId, setCopiedTranscriptId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup audio playback on unmount
  useEffect(() => {
    return () => {
      if (activeAudioElement) {
        activeAudioElement.pause();
        activeAudioElement.src = '';
      }
    };
  }, [activeAudioElement]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalSec = 0;
    let totalBytes = 0;
    let favorites = 0;
    const categoryCounts: Record<string, number> = {};
    const rateCounts: Record<number, number> = { 8000: 0, 16000: 0, 24000: 0 };
    const voiceCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};

    for (const c of clips) {
      totalSec += c.duration || 0;
      totalBytes += c.fileSizeBytes || (c.audioBase64 ? c.audioBase64.length * 0.75 : 0);
      if (c.isFavorite) favorites++;

      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
      if (c.sampleRate) {
        rateCounts[c.sampleRate] = (rateCounts[c.sampleRate] || 0) + 1;
      }
      if (c.voiceName) {
        voiceCounts[c.voiceName] = (voiceCounts[c.voiceName] || 0) + 1;
      }
      if (c.tags) {
        c.tags.forEach((t) => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      }
    }

    const kbUsed = Math.round(totalBytes / 1024);
    const mbUsed = (totalBytes / (1024 * 1024)).toFixed(2);

    return {
      totalCount: clips.length,
      totalDurationFormatted:
        totalSec > 60
          ? `${Math.floor(totalSec / 60)}m ${Math.round(totalSec % 60)}s`
          : `${totalSec.toFixed(1)}s`,
      storageUsage: kbUsed > 1024 ? `${mbUsed} MB` : `${kbUsed} kB`,
      favoritesCount: favorites,
      categoryCounts,
      rateCounts,
      voiceCounts,
      tagCounts,
    };
  }, [clips]);

  // Filter and sort clips based on active tree selection, search term, sample rate, etc.
  const filteredClips = useMemo(() => {
    return clips
      .filter((clip) => {
        // Tree hierarchy filter
        if (selectedTreeFilter.type === 'favorites' && !clip.isFavorite) {
          return false;
        }
        if (
          selectedTreeFilter.type === 'category' &&
          selectedTreeFilter.value !== 'all' &&
          clip.category !== selectedTreeFilter.value
        ) {
          return false;
        }
        if (
          selectedTreeFilter.type === 'sample_rate' &&
          clip.sampleRate !== Number(selectedTreeFilter.value)
        ) {
          return false;
        }
        if (
          selectedTreeFilter.type === 'voice' &&
          clip.voiceName !== selectedTreeFilter.value
        ) {
          return false;
        }
        if (
          selectedTreeFilter.type === 'tag' &&
          (!clip.tags || !clip.tags.includes(selectedTreeFilter.value))
        ) {
          return false;
        }

        // Search text query
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchesTitle = clip.title.toLowerCase().includes(q);
          const matchesTranscript = clip.transcription?.toLowerCase().includes(q);
          const matchesDesc = clip.description?.toLowerCase().includes(q);
          const matchesVoice = clip.voiceName?.toLowerCase().includes(q);
          const matchesTag = clip.tags?.some((t) => t.toLowerCase().includes(q));
          const matchesCategory = clip.category.toLowerCase().includes(q);
          if (
            !matchesTitle &&
            !matchesTranscript &&
            !matchesDesc &&
            !matchesVoice &&
            !matchesTag &&
            !matchesCategory
          ) {
            return false;
          }
        }

        // Sample rate filter dropdown
        if (selectedSampleRate !== 'All' && clip.sampleRate !== selectedSampleRate) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Starred pinned first if sorting by newest or oldest
        if (a.isFavorite !== b.isFavorite) {
          return a.isFavorite ? -1 : 1;
        }

        switch (sortBy) {
          case 'oldest':
            return a.timestamp - b.timestamp;
          case 'duration_desc':
            return (b.duration || 0) - (a.duration || 0);
          case 'duration_asc':
            return (a.duration || 0) - (b.duration || 0);
          case 'title':
            return a.title.localeCompare(b.title);
          case 'newest':
          default:
            return b.timestamp - a.timestamp;
        }
      });
  }, [clips, selectedTreeFilter, searchTerm, selectedSampleRate, sortBy]);

  // Currently inspected clip
  const inspectedClip = useMemo(() => {
    if (!inspectedClipId) return null;
    return clips.find((c) => c.id === inspectedClipId) || null;
  }, [clips, inspectedClipId]);

  // Play audio directly in the library
  const handleTogglePlayInline = (clip: AudioClip) => {
    if (playingClipId === clip.id && activeAudioElement) {
      if (activeAudioElement.paused) {
        activeAudioElement.play();
      } else {
        activeAudioElement.pause();
        setPlayingClipId(null);
      }
      return;
    }

    // Stop previous audio
    if (activeAudioElement) {
      activeAudioElement.pause();
      activeAudioElement.src = '';
    }

    let url = clip.audioUrl;
    if (!url && clip.audioBase64) {
      const bin = atob(clip.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes.buffer], { type: 'audio/wav' });
      url = URL.createObjectURL(blob);
    }

    if (!url) return;

    const audio = new Audio(url);
    setActiveAudioElement(audio);
    setPlayingClipId(clip.id);
    setPlaybackProgress(0);

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.onended = () => {
      setPlayingClipId(null);
      setPlaybackProgress(0);
    };

    audio.onerror = () => {
      setPlayingClipId(null);
      setPlaybackProgress(0);
    };

    audio.play().catch((err) => {
      console.error('Playback error:', err);
      setPlayingClipId(null);
    });
  };

  // Helper for sample rate badge styling
  const getSampleRateBadge = (rate: SampleRate) => {
    switch (rate) {
      case 8000:
        return {
          label: '8 kHz PSTN',
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          dot: 'bg-amber-500',
        };
      case 16000:
        return {
          label: '16 kHz Whisper',
          bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
          dot: 'bg-cyan-500',
        };
      case 24000:
      default:
        return {
          label: '24 kHz Studio',
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          dot: 'bg-emerald-500',
        };
    }
  };

  // Transcode and download
  const handleExportSampleRate = async (clip: AudioClip, targetRate: SampleRate) => {
    try {
      setActiveExportMenuId(null);
      let arrayBuf: ArrayBuffer;
      if (clip.audioUrl) {
        const res = await fetch(clip.audioUrl);
        arrayBuf = await res.arrayBuffer();
      } else if (clip.audioBase64) {
        const bin = atob(clip.audioBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        arrayBuf = bytes.buffer;
      } else {
        return;
      }

      const decoded = decodeWav(arrayBuf);
      const resampled = resampleAudioBuffer(decoded.monoSamples, decoded.sampleRate, targetRate);
      const outBuffer = encode16BitMonoWav(resampled, targetRate);
      const blob = new Blob([outBuffer], { type: 'audio/wav' });

      const safeTitle = clip.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
      triggerAudioDownload(blob, `${safeTitle}_${targetRate}hz_16bit_mono.wav`);
    } catch (e) {
      console.error('Export audio error:', e);
    }
  };

  // Copy transcript
  const handleCopyTranscript = (clip: AudioClip) => {
    if (clip.transcription) {
      navigator.clipboard.writeText(clip.transcription);
      setCopiedTranscriptId(clip.id);
      setTimeout(() => setCopiedTranscriptId(null), 2000);
    }
  };

  // Batch selection handlers
  const handleToggleSelectClip = (id: string) => {
    setSelectedClipIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedClipIds.size === filteredClips.length) {
      setSelectedClipIds(new Set());
    } else {
      setSelectedClipIds(new Set(filteredClips.map((c) => c.id)));
    }
  };

  const handleBatchDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to delete ${selectedClipIds.size} selected audio clips from your library?`
      )
    ) {
      selectedClipIds.forEach((id) => onDeleteClip(id));
      setSelectedClipIds(new Set());
      setIsBatchMode(false);
    }
  };

  const handleBatchDownload = () => {
    const selected = clips.filter((c) => selectedClipIds.has(c.id));
    if (selected.length > 0) {
      setDownloadModalClips(selected);
      setDownloadModalTitle(`Download ${selected.length} Selected Audio Clips`);
      setIsDownloadAllModalOpen(true);
    }
  };

  const handleOpenDownloadAll = (clipsToExport = clips, customTitle = 'Download All Audio Clips (.ZIP)') => {
    setDownloadModalClips(clipsToExport);
    setDownloadModalTitle(customTitle);
    setIsDownloadAllModalOpen(true);
  };

  // Edit Clip Handlers
  const handleOpenEdit = (clip: AudioClip) => {
    setEditingClip(clip);
    setEditTitle(clip.title);
    setEditDescription(clip.description || '');
    setEditCategory(clip.category);
    setEditTags(clip.tags || []);
    setEditTagInput('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClip || !editTitle.trim()) return;

    const updated: AudioClip = {
      ...editingClip,
      title: editTitle.trim(),
      description: editDescription.trim(),
      category: editCategory,
      tags: editTags,
    };

    onUpdateClip(updated);
    setEditingClip(null);
  };

  // Upload Custom File Handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      setUploadTags(['Custom', `${uploadTargetRate / 1000}kHz`]);
    }
  };

  const handleProcessUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) return;

    setIsProcessingUpload(true);
    try {
      const fileBuffer = await uploadFile.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(fileBuffer);

      const numSamples = decodedBuffer.length;
      const monoSamples = new Float32Array(numSamples);
      if (decodedBuffer.numberOfChannels === 1) {
        monoSamples.set(decodedBuffer.getChannelData(0));
      } else {
        const left = decodedBuffer.getChannelData(0);
        const right = decodedBuffer.getChannelData(1);
        for (let i = 0; i < numSamples; i++) {
          monoSamples[i] = (left[i] + right[i]) * 0.5;
        }
      }

      const resampledSamples = resampleAudioBuffer(
        monoSamples,
        decodedBuffer.sampleRate,
        uploadTargetRate
      );

      const outWavBuffer = encode16BitMonoWav(resampledSamples, uploadTargetRate);

      let binary = '';
      const bytes = new Uint8Array(outWavBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const blob = new Blob([outWavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      const newClip: AudioClip = {
        id: `clip-custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: uploadTitle.trim(),
        description: `Uploaded from ${uploadFile.name} (resampled to ${uploadTargetRate} Hz 16-bit mono WAV)`,
        category: uploadCategory,
        tags: uploadTags,
        isFavorite: false,
        voiceName: 'Custom Audio',
        sampleRate: uploadTargetRate,
        duration: decodedBuffer.duration,
        timestamp: Date.now(),
        audioBase64: base64,
        audioUrl: url,
        fileSizeBytes: outWavBuffer.byteLength,
        sourceType: 'uploaded',
      };

      onAddClip(newClip);
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadTags([]);
    } catch (err: any) {
      console.error('Upload conversion error:', err);
    } finally {
      setIsProcessingUpload(false);
    }
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await onImportLibrary(text);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Import error:', err);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-150">
      {/* Top Banner & Stats Overview */}
      <div className="bg-white dark:bg-[#0F0F13] rounded-3xl p-6 border border-slate-200 dark:border-[#1F1F28] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/80">
              <BookmarkCheck className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Audio Clip Library & Soundboard
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80">
              IndexedDB Persisted
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Durable local storage for telephony IVR menus, AI voice prompts, and conversational dialogue scenes
          </p>
        </div>

        {/* Action Buttons & Statistics Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#09090C] px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-[#1F1F28] text-xs font-mono">
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{stats.totalCount} Clips</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 dark:text-slate-400">{stats.totalDurationFormatted}</span>
            <span className="text-slate-400">•</span>
            <span className="text-emerald-600 dark:text-emerald-400">{stats.storageUsage}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenDownloadAll(clips, `Download All ${clips.length} Audio Clips (.ZIP)`)}
              disabled={clips.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              title="Download all clips in library as a compressed ZIP archive"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Download All (.ZIP)</span>
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Clip</span>
            </button>

            <button
              onClick={onExportLibrary}
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-[#262634] transition-colors"
              title="Export Library Archive (.json)"
            >
              <FileDown className="w-4 h-4" />
            </button>

            <button
              onClick={() => importFileInputRef.current?.click()}
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-[#262634] transition-colors"
              title="Import Library Backup (.json)"
            >
              <FileUp className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={importFileInputRef}
              onChange={handleImportJsonFile}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Main Browsable Explorer Layout: Left Tree Sidebar + Right Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Browsable Folder & Facet Tree */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-[#0F0F13] rounded-2xl p-4 border border-slate-200 dark:border-[#1F1F28] shadow-sm space-y-5">
            {/* Tree Section 1: Overview & Favorites */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2 px-1">
                Library Explorer
              </span>
              <div className="space-y-1 text-xs">
                <button
                  onClick={() => setSelectedTreeFilter({ type: 'all', value: 'all' })}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    selectedTreeFilter.type === 'all'
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181822]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4" />
                    <span>All Library Clips</span>
                  </div>
                  <span
                    className={`font-mono text-[11px] px-2 py-0.5 rounded-full ${
                      selectedTreeFilter.type === 'all'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-[#1A1A24] text-slate-500'
                    }`}
                  >
                    {stats.totalCount}
                  </span>
                </button>

                <button
                  onClick={() => setSelectedTreeFilter({ type: 'favorites', value: 'favorites' })}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    selectedTreeFilter.type === 'favorites'
                      ? 'bg-amber-500 text-white font-semibold shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181822]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Star className="w-4 h-4 fill-current text-amber-400" />
                    <span>Starred & Favorites</span>
                  </div>
                  <span
                    className={`font-mono text-[11px] px-2 py-0.5 rounded-full ${
                      selectedTreeFilter.type === 'favorites'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-[#1A1A24] text-slate-500'
                    }`}
                  >
                    {stats.favoritesCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Tree Section 2: Category Folders */}
            <div className="pt-3 border-t border-slate-100 dark:border-[#1A1A24]">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2 px-1">
                Category Folders
              </span>
              <div className="space-y-1 text-xs">
                {CATEGORIES.filter((c) => c !== 'All').map((cat) => {
                  const count = stats.categoryCounts[cat] || 0;
                  const isSelected =
                    selectedTreeFilter.type === 'category' && selectedTreeFilter.value === cat;

                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedTreeFilter({ type: 'category', value: cat })}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181822]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />
                        <span className="truncate">{cat}</span>
                      </div>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full shrink-0 ml-1 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 dark:bg-[#1A1A24] text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tree Section 3: Telephony & Sample Rates */}
            <div className="pt-3 border-t border-slate-100 dark:border-[#1A1A24]">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2 px-1">
                Sample Rates & Codecs
              </span>
              <div className="space-y-1 text-xs font-mono">
                <button
                  onClick={() =>
                    setSelectedTreeFilter({ type: 'sample_rate', value: '8000' })
                  }
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    selectedTreeFilter.type === 'sample_rate' && selectedTreeFilter.value === '8000'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181822]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>8 kHz (PSTN IVR)</span>
                  </div>
                  <span className="text-[10px]">{stats.rateCounts[8000]}</span>
                </button>

                <button
                  onClick={() =>
                    setSelectedTreeFilter({ type: 'sample_rate', value: '16000' })
                  }
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    selectedTreeFilter.type === 'sample_rate' && selectedTreeFilter.value === '16000'
                      ? 'bg-cyan-600 text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181822]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    <span>16 kHz (VoIP / Whisper)</span>
                  </div>
                  <span className="text-[10px]">{stats.rateCounts[16000]}</span>
                </button>

                <button
                  onClick={() =>
                    setSelectedTreeFilter({ type: 'sample_rate', value: '24000' })
                  }
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    selectedTreeFilter.type === 'sample_rate' && selectedTreeFilter.value === '24000'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181822]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>24 kHz (Studio Master)</span>
                  </div>
                  <span className="text-[10px]">{stats.rateCounts[24000]}</span>
                </button>
              </div>
            </div>

            {/* Tree Section 4: Voice Breakdown */}
            {Object.keys(stats.voiceCounts).length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-[#1A1A24]">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2 px-1">
                  Voice Models
                </span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.voiceCounts).map(([voice, count]) => {
                    const isSelected =
                      selectedTreeFilter.type === 'voice' && selectedTreeFilter.value === voice;
                    return (
                      <button
                        key={voice}
                        onClick={() =>
                          setSelectedTreeFilter(
                            isSelected ? { type: 'all', value: 'all' } : { type: 'voice', value: voice }
                          )
                        }
                        className={`text-[11px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-slate-100 dark:bg-[#181822] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#222230]'
                        }`}
                      >
                        <Mic className="w-3 h-3" />
                        <span>{voice}</span>
                        <span className="font-mono text-[9px] opacity-75">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tree Section 5: Tags Cloud */}
            {Object.keys(stats.tagCounts).length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-[#1A1A24]">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2 px-1">
                  Tags Cloud
                </span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.tagCounts)
                    .slice(0, 12)
                    .map(([tag, count]) => {
                      const isSelected =
                        selectedTreeFilter.type === 'tag' && selectedTreeFilter.value === tag;
                      return (
                        <button
                          key={tag}
                          onClick={() =>
                            setSelectedTreeFilter(
                              isSelected ? { type: 'all', value: 'all' } : { type: 'tag', value: tag }
                            )
                          }
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : 'bg-slate-50 dark:bg-[#121217] text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-[#22222E] hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          #{tag} <span className="opacity-60">({count})</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Side: Browsable Content Area */}
        <main className="lg:col-span-9 space-y-4">
          {/* Controls Bar: Search, View Switcher, Batch Mode, Sort */}
          <div className="bg-white dark:bg-[#0F0F13] rounded-2xl p-4 border border-slate-200 dark:border-[#1F1F28] shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter and search clips by title, voice, transcript..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* View Switcher (Grid / Soundboard / Table) */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#14141C] p-1 rounded-xl border border-slate-200/60 dark:border-[#262634] shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-[#20202C] text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Grid Cards View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </button>

                <button
                  onClick={() => setViewMode('soundboard')}
                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                    viewMode === 'soundboard'
                      ? 'bg-white dark:bg-[#20202C] text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Interactive Soundboard Pad"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Soundboard</span>
                </button>

                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-[#20202C] text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Dense Table View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </button>
              </div>

              {/* Sort By Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto text-xs bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="duration_desc">Sort: Longest First</option>
                <option value="duration_asc">Sort: Shortest First</option>
                <option value="title">Sort: Title A-Z</option>
              </select>

              {/* Batch Mode Toggle */}
              <button
                onClick={() => {
                  setIsBatchMode(!isBatchMode);
                  if (isBatchMode) setSelectedClipIds(new Set());
                }}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
                  isBatchMode
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                    : 'bg-slate-100 dark:bg-[#181822] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#262634]'
                }`}
                title="Batch Select & Actions"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isBatchMode ? 'Done' : 'Select'}</span>
              </button>
            </div>

            {/* Batch Action Toolbar */}
            {isBatchMode && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#1A1A24] text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllFiltered}
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    {selectedClipIds.size === filteredClips.length ? 'Deselect All' : 'Select All Filtered'}
                  </button>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono">
                    {selectedClipIds.size} of {filteredClips.length} selected
                  </span>
                </div>

                {selectedClipIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBatchDownload}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download ({selectedClipIds.size})</span>
                    </button>
                    <button
                      onClick={handleBatchDelete}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete ({selectedClipIds.size})</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Tree Filter Badge Indicator */}
          {selectedTreeFilter.type !== 'all' && (
            <div className="flex items-center gap-2 text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/60">
              <Filter className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                Browsing Filter:{' '}
                <strong className="font-semibold">{selectedTreeFilter.type.toUpperCase()}: {selectedTreeFilter.value}</strong>
              </span>
              <button
                onClick={() => setSelectedTreeFilter({ type: 'all', value: 'all' })}
                className="ml-auto text-[11px] underline hover:text-indigo-950 dark:hover:text-white"
              >
                Clear Filter
              </button>
            </div>
          )}

          {/* Empty State */}
          {filteredClips.length === 0 ? (
            <div className="bg-white dark:bg-[#0F0F13] rounded-3xl p-12 border border-slate-200 dark:border-[#1F1F28] text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#181822] text-slate-400 flex items-center justify-center mx-auto border border-slate-200/60 dark:border-[#262634]">
                <BookmarkCheck className="w-8 h-8 text-indigo-500" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">No Matching Clips Found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {searchTerm || selectedTreeFilter.type !== 'all'
                    ? 'No clips match your current search and filter selections.'
                    : 'Your library is empty. Generate voiceovers in Voice Studio or upload audio clips.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                {selectedTreeFilter.type !== 'all' && (
                  <button
                    onClick={() => setSelectedTreeFilter({ type: 'all', value: 'all' })}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#181822] text-slate-700 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-[#262634]"
                  >
                    Reset Explorer Filter
                  </button>
                )}
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow transition-all"
                >
                  Upload Audio Clip
                </button>
              </div>
            </div>
          ) : viewMode === 'soundboard' ? (
            /* ========================================================== */
            /* VIEW MODE: SOUNDBOARD PADS                                 */
            /* ========================================================== */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredClips.map((clip, index) => {
                const isPlaying = playingClipId === clip.id;
                const badge = getSampleRateBadge(clip.sampleRate);
                const isSelected = selectedClipIds.has(clip.id);

                return (
                  <div
                    key={clip.id}
                    onClick={() => {
                      if (isBatchMode) {
                        handleToggleSelectClip(clip.id);
                      } else {
                        handleTogglePlayInline(clip);
                      }
                    }}
                    className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between min-h-[140px] group ${
                      isPlaying
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 scale-[1.02]'
                        : isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400'
                        : 'bg-white dark:bg-[#0F0F13] border-slate-200 dark:border-[#1F1F28] hover:border-indigo-400 dark:hover:border-indigo-600 shadow-sm'
                    }`}
                  >
                    {/* Top Row: Pad Number / Checkbox & Sample Rate */}
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      {isBatchMode ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectClip(clip.id);
                          }}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      ) : (
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono ${
                            isPlaying
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-[#1A1A24] text-slate-400'
                          }`}
                        >
                          PAD #{index + 1}
                        </span>
                      )}

                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          isPlaying ? 'bg-white/20 text-white' : badge.bg
                        }`}
                      >
                        {clip.sampleRate / 1000}k
                      </span>
                    </div>

                    {/* Middle: Title & Voice */}
                    <div className="my-2 space-y-0.5">
                      <h4
                        className={`text-xs font-bold line-clamp-2 leading-snug tracking-tight ${
                          isPlaying ? 'text-white' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {clip.title}
                      </h4>
                      <p
                        className={`text-[10px] line-clamp-1 ${
                          isPlaying ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {clip.voiceName || clip.category}
                      </p>
                    </div>

                    {/* Bottom: Play Trigger & Waveform Meter */}
                    <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5">
                      <span
                        className={`text-[10px] font-mono ${
                          isPlaying ? 'text-indigo-100' : 'text-slate-400'
                        }`}
                      >
                        {clip.duration ? `${clip.duration.toFixed(1)}s` : 'WAV'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isPlaying && (
                          <div className="flex items-end gap-0.5 h-3">
                            <span className="w-0.5 h-2 bg-white animate-pulse"></span>
                            <span className="w-0.5 h-3 bg-white animate-pulse delay-75"></span>
                            <span className="w-0.5 h-1.5 bg-white animate-pulse delay-150"></span>
                          </div>
                        )}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            isPlaying
                              ? 'bg-white text-indigo-600'
                              : 'bg-indigo-50 dark:bg-[#1A1A24] text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white'
                          } transition-colors`}
                        >
                          {isPlaying ? (
                            <Pause className="w-3 h-3 fill-current" />
                          ) : (
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'table' ? (
            /* ========================================================== */
            /* VIEW MODE: DENSE DATA TABLE                                */
            /* ========================================================== */
            <div className="bg-white dark:bg-[#0F0F13] rounded-2xl border border-slate-200 dark:border-[#1F1F28] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#09090C] border-b border-slate-200 dark:border-[#1F1F28] text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      {isBatchMode && <th className="p-3 w-8"></th>}
                      <th className="p-3 w-10">Play</th>
                      <th className="p-3">Title & Transcript</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Voice</th>
                      <th className="p-3">Rate</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1A1A24]">
                    {filteredClips.map((clip) => {
                      const isPlaying = playingClipId === clip.id;
                      const badge = getSampleRateBadge(clip.sampleRate);
                      const isSelected = selectedClipIds.has(clip.id);

                      return (
                        <tr
                          key={clip.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-[#14141C] transition-colors ${
                            isPlaying ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : ''
                          }`}
                        >
                          {isBatchMode && (
                            <td className="p-3">
                              <button onClick={() => handleToggleSelectClip(clip.id)}>
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            </td>
                          )}
                          <td className="p-3">
                            <button
                              onClick={() => handleTogglePlayInline(clip)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                isPlaying
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-slate-100 dark:bg-[#181822] text-slate-600 dark:text-slate-300 hover:bg-indigo-600 hover:text-white'
                              }`}
                            >
                              {isPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              )}
                            </button>
                          </td>
                          <td className="p-3 max-w-xs">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => onToggleFavorite(clip.id)}
                                className="text-slate-300 hover:text-amber-400"
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    clip.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                                  }`}
                                />
                              </button>
                              <span className="font-semibold text-slate-900 dark:text-white truncate">
                                {clip.title}
                              </span>
                            </div>
                            {clip.transcription && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                "{clip.transcription}"
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {clip.category}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                            {clip.voiceName || 'Single'}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${badge.bg}`}>
                              {clip.sampleRate / 1000} kHz
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                            {clip.duration ? `${clip.duration.toFixed(1)}s` : 'WAV'}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onPlayClip(clip)}
                                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#20202A] text-slate-500 hover:text-indigo-500"
                                title="Load into Player Bar"
                              >
                                <Music className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleExportSampleRate(clip, clip.sampleRate)}
                                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#20202A] text-slate-500 hover:text-indigo-500"
                                title="Download WAV"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(clip)}
                                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#20202A] text-slate-500 hover:text-indigo-500"
                                title="Edit Metadata"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteClip(clip.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500"
                                title="Delete Clip"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* VIEW MODE: INTERACTIVE GRID CARDS                          */
            /* ========================================================== */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredClips.map((clip) => {
                const isPlaying = playingClipId === clip.id;
                const badge = getSampleRateBadge(clip.sampleRate);
                const isSelected = selectedClipIds.has(clip.id);
                const isMenuOpen = activeExportMenuId === clip.id;

                return (
                  <div
                    key={clip.id}
                    className={`bg-white dark:bg-[#0F0F13] rounded-2xl p-4 border shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-[#2C2C3A] transition-all space-y-3 group ${
                      isSelected
                        ? 'border-indigo-500 ring-1 ring-indigo-500'
                        : isPlaying
                        ? 'border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-[#1F1F28]'
                    }`}
                  >
                    <div>
                      {/* Top Row: Favorite Star, Checkbox, Title, Category Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          {isBatchMode ? (
                            <button
                              onClick={() => handleToggleSelectClip(clip.id)}
                              className="mt-0.5 text-slate-400"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => onToggleFavorite(clip.id)}
                              className="mt-0.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#181822] text-slate-400 hover:text-amber-400 transition-colors shrink-0"
                              title={clip.isFavorite ? 'Remove favorite' : 'Star favorite'}
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  clip.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                                }`}
                              />
                            </button>
                          )}

                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1 tracking-tight">
                              {clip.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>{clip.category}</span>
                              <span>•</span>
                              <span className="font-mono">
                                {clip.duration ? `${clip.duration.toFixed(1)}s` : 'WAV'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Sample Rate Pill */}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-medium shrink-0 flex items-center gap-1 ${badge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                          {clip.sampleRate / 1000}k
                        </span>
                      </div>

                      {/* Transcription / Notes Preview */}
                      {clip.transcription ? (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-100 dark:border-[#1C1C26] text-xs font-mono text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          "{clip.transcription}"
                        </div>
                      ) : clip.description ? (
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {clip.description}
                        </p>
                      ) : null}

                      {/* Tags List */}
                      {clip.tags && clip.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {clip.tags.slice(0, 4).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#161620] text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-[#22222E]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Inline Playback Controls & Action Triggers */}
                    <div className="pt-3 border-t border-slate-100 dark:border-[#1A1A24] space-y-2">
                      {/* Playback progress bar (if playing) */}
                      {isPlaying && (
                        <div className="w-full bg-slate-100 dark:bg-[#181822] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full transition-all duration-100"
                            style={{ width: `${playbackProgress}%` }}
                          ></div>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        {/* Play/Pause Button */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleTogglePlayInline(clip)}
                            className={`px-3 py-1.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                              isPlaying
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                : 'bg-slate-100 dark:bg-[#181822] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#222230] border border-slate-200/60 dark:border-[#262634]'
                            }`}
                          >
                            {isPlaying ? (
                              <>
                                <Pause className="w-3 h-3 fill-current" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-current" />
                                <span>Play</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => onPlayClip(clip)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#262634] transition-colors"
                            title="Load into Studio Bottom Player"
                          >
                            <Music className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Right Tools (Copy transcript, Export, Edit, Delete) */}
                        <div className="flex items-center gap-1">
                          {clip.transcription && (
                            <button
                              onClick={() => handleCopyTranscript(clip)}
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#262634] transition-colors"
                              title="Copy Speech Transcript"
                            >
                              {copiedTranscriptId === clip.id ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {/* Transcode Export Menu */}
                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveExportMenuId(isMenuOpen ? null : clip.id)
                              }
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#262634] transition-colors"
                              title="Download & Export WAV"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 bottom-full mb-1.5 w-44 bg-white dark:bg-[#181822] rounded-xl shadow-xl border border-slate-200 dark:border-[#262634] py-1.5 z-20 text-xs">
                                <span className="px-3 py-1 text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                                  Export WAV Codec
                                </span>
                                <button
                                  onClick={() => handleExportSampleRate(clip, 8000)}
                                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-[#20202A] text-slate-700 dark:text-slate-300 flex items-center justify-between"
                                >
                                  <span>8 kHz PSTN Telephony</span>
                                  <span className="text-[10px] font-mono text-amber-500">IVR</span>
                                </button>
                                <button
                                  onClick={() => handleExportSampleRate(clip, 16000)}
                                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-[#20202A] text-slate-700 dark:text-slate-300 flex items-center justify-between"
                                >
                                  <span>16 kHz VoIP / Whisper</span>
                                  <span className="text-[10px] font-mono text-cyan-500">AI</span>
                                </button>
                                <button
                                  onClick={() => handleExportSampleRate(clip, 24000)}
                                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-[#20202A] text-slate-700 dark:text-slate-300 flex items-center justify-between"
                                >
                                  <span>24 kHz Studio Master</span>
                                  <span className="text-[10px] font-mono text-emerald-500">HD</span>
                                </button>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleOpenEdit(clip)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#262634] transition-colors"
                            title="Edit Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteClip(clip.id)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 border border-slate-200/60 dark:border-[#262634] transition-colors"
                            title="Delete Clip"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Edit Clip Modal */}
      {editingClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0F0F13] rounded-3xl p-6 border border-slate-200 dark:border-[#1F1F28] shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Edit Clip Metadata</h3>
              <button
                onClick={() => setEditingClip(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Clip Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as ClipCategory)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] text-slate-900 dark:text-slate-100"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Description / Notes
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Tags (Press Enter to add)
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={editTagInput}
                    onChange={(e) => setEditTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (editTagInput.trim() && !editTags.includes(editTagInput.trim())) {
                          setEditTags([...editTags, editTagInput.trim()]);
                          setEditTagInput('');
                        }
                      }
                    }}
                    placeholder="e.g. Telephony, Prompt, Support"
                    className="flex-1 p-2 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (editTagInput.trim() && !editTags.includes(editTagInput.trim())) {
                        setEditTags([...editTags, editTagInput.trim()]);
                        setEditTagInput('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-indigo-600 text-white font-medium"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {editTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1A1A24] text-slate-700 dark:text-slate-300 flex items-center gap-1 font-mono text-[11px]"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => setEditTags(editTags.filter((t) => t !== tag))}
                        className="text-slate-400 hover:text-rose-500 ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#1A1A24]">
                <button
                  type="button"
                  onClick={() => setEditingClip(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#181822] text-slate-700 dark:text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Custom Clip Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0F0F13] rounded-3xl p-6 border border-slate-200 dark:border-[#1F1F28] shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Add Custom Audio Clip
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessUpload} className="space-y-4 text-xs">
              {/* File Dropzone */}
              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Audio File (.wav, .mp3, .ogg, .m4a)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-[#262634] hover:border-indigo-500 text-center cursor-pointer bg-slate-50 dark:bg-[#09090C] transition-colors"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="audio/*"
                    className="hidden"
                  />
                  {uploadFile ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {uploadFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {(uploadFile.size / 1024).toFixed(1)} kB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-500">
                      <p className="font-semibold">Click to browse or drop an audio file</p>
                      <p className="text-[11px]">WAV, MP3, OGG up to 50 MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Clip Title
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Telephony IVR Greeting"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as ClipCategory)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] text-slate-900 dark:text-slate-100"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Target Format
                  </label>
                  <select
                    value={uploadTargetRate}
                    onChange={(e) => setUploadTargetRate(Number(e.target.value) as SampleRate)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] text-slate-900 dark:text-slate-100 font-mono"
                  >
                    <option value="8000">8 kHz (PSTN IVR)</option>
                    <option value="16000">16 kHz (VoIP / Whisper)</option>
                    <option value="24000">24 kHz (Studio Master)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#1A1A24]">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#181822] text-slate-700 dark:text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || !uploadTitle.trim() || isProcessingUpload}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isProcessingUpload ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Transcoding...</span>
                    </>
                  ) : (
                    <span>Add to Library</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Download All Audio Clips Modal */}
      <DownloadAllModal
        isOpen={isDownloadAllModalOpen}
        onClose={() => setIsDownloadAllModalOpen(false)}
        clips={downloadModalClips.length > 0 ? downloadModalClips : clips}
        title={downloadModalTitle}
        subtitle="Package multiple audio outputs into a single compressed ZIP with metadata index"
      />
    </div>
  );
};
