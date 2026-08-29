import React, { useState, useEffect } from 'react';
import {
  BookmarkPlus,
  X,
  Sparkles,
  Tag,
  Folder,
  Volume2,
  Check,
  Radio,
} from 'lucide-react';
import { AudioClip, ClipCategory, SampleRate } from '../types';

interface SaveToLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clip: AudioClip) => Promise<void>;
  initialData?: {
    title?: string;
    description?: string;
    category?: ClipCategory;
    tags?: string[];
    voiceName?: string;
    sampleRate?: SampleRate;
    duration?: number;
    audioBase64: string;
    audioUrl?: string;
    sourceType?: 'tts_single' | 'tts_dialogue' | 'uploaded' | 'resampled';
    transcription?: string;
    styleDirective?: string;
  } | null;
}

const CATEGORIES: ClipCategory[] = [
  'IVR & Telephony',
  'Voice Assistant',
  'Voicemail & Attendant',
  'Podcast & Narration',
  'Prompts & Soundbites',
  'Conversational Dialogue',
  'Custom',
];

const POPULAR_TAGS = [
  'IVR',
  '8kHz',
  '16kHz',
  '24kHz',
  'Greeting',
  'Voicemail',
  'Customer Support',
  'AI Agent',
  'Podcast',
  'Announcement',
  'Whisper',
  'Studio HD',
];

export const SaveToLibraryModal: React.FC<SaveToLibraryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ClipCategory>('IVR & Telephony');
  const [tags, setTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || 'Saved Voice Clip');
      setDescription(initialData.description || '');
      setCategory(initialData.category || 'IVR & Telephony');
      setTags(
        initialData.tags && initialData.tags.length > 0
          ? initialData.tags
          : [
              `${(initialData.sampleRate || 24000) / 1000}kHz`,
              initialData.voiceName || 'TTS',
            ]
      );
      setIsFavorite(false);
    }
  }, [initialData, isOpen]);

  if (!isOpen || !initialData) return null;

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setCustomTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(customTagInput);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const newClip: AudioClip = {
        id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: title.trim(),
        description: description.trim(),
        category,
        tags,
        isFavorite,
        voiceName: initialData.voiceName || 'Gemini TTS',
        sampleRate: initialData.sampleRate || 24000,
        duration: initialData.duration || 0,
        timestamp: Date.now(),
        audioBase64: initialData.audioBase64,
        audioUrl: initialData.audioUrl,
        fileSizeBytes: initialData.audioBase64
          ? Math.round(initialData.audioBase64.length * 0.75)
          : undefined,
        sourceType: initialData.sourceType || 'tts_single',
        transcription: initialData.transcription,
        styleDirective: initialData.styleDirective,
      };

      await onSave(newClip);
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0F0F13] border border-slate-200 dark:border-[#1F1F28] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1F1F28] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/80">
              <BookmarkPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                Save Audio Clip to Library
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Persist into high-capacity browser database with categorization
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#181822] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Audio Overview Tag */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#1F1F28] text-xs">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {initialData.voiceName || 'Audio Clip'}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 dark:text-slate-400">
                {initialData.duration ? `${initialData.duration.toFixed(1)}s` : 'WAV'}
              </span>
            </div>

            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono text-[11px]">
              {(initialData.sampleRate || 24000) / 1000} kHz WAV
            </span>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Clip Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sales Department IVR Greeting"
              className="w-full text-xs rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] px-3.5 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-indigo-500" />
              Category / Folder
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ClipCategory)}
              className="w-full text-xs rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] px-3.5 py-2.5 text-slate-900 dark:text-slate-100"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description or Script Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about intended telephony channel, extension, or cue..."
              className="w-full text-xs rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] p-3 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-indigo-500" />
              Tags & Labels
            </label>

            {/* Current Tags Chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-[11px] font-medium border border-indigo-200 dark:border-indigo-800/60"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-rose-500 text-slate-400 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* Tag Input */}
            <input
              type="text"
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={handleKeyDownTag}
              placeholder="Type tag and press Enter..."
              className="w-full text-xs rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            {/* Quick Popular Tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-[10px] text-slate-400 mr-1 self-center">Suggestions:</span>
              {POPULAR_TAGS.slice(0, 6).map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleAddTag(sug)}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-[#262634] transition-colors"
                >
                  +{sug}
                </button>
              ))}
            </div>
          </div>

          {/* Favorite Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="favClipCheck"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="favClipCheck" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Star as favorite clip (pin to top)
            </label>
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-[#1F1F28] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#181822]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-[#1C1C26] text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/25 transition-all active:scale-95"
            >
              {isSaving ? (
                <span>Saving to IndexedDB...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Clip to Library</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
