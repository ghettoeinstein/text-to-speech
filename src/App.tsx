import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, StudioTab } from './components/Navbar';
import { SingleSpeakerStudio } from './components/SingleSpeakerStudio';
import { MultiSpeakerStudio } from './components/MultiSpeakerStudio';
import { UploadConvertStudio } from './components/UploadConvertStudio';
import { ClipLibraryTab } from './components/ClipLibraryTab';
import { PhoneticDictionaryModal } from './components/PhoneticDictionaryModal';
import { ScriptAssistantModal } from './components/ScriptAssistantModal';
import { SaveToLibraryModal } from './components/SaveToLibraryModal';
import { HistoryTab } from './components/HistoryTab';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import {
  SampleRate,
  PhoneticRule,
  GenerationHistoryItem,
  DialogueTurn,
  AudioClip,
  ClipCategory,
} from './types';
import { DEFAULT_PHONETIC_RULES } from './utils/phoneticEngine';
import { base64ToArrayBuffer } from './utils/audioDsp';
import { triggerAudioDownload } from './utils/clientAudio';
import {
  getAllPersistedClips,
  savePersistedClip,
  deletePersistedClip,
  toggleClipFavorite,
  clearAllPersistedClips,
  exportLibraryArchiveJson,
  importLibraryArchiveJson,
} from './utils/clipLibraryDb';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const LOCAL_STORAGE_RULES_KEY = 'gemini_tts_phonetic_rules_v1';
const LOCAL_STORAGE_HISTORY_KEY = 'gemini_tts_history_v1';
const LOCAL_STORAGE_THEME_KEY = 'gemini_tts_theme_v1';

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
    if (saved !== null) return saved === 'true';
    return true; // default dark theme for studio vibe
  });

  // Tab state (defaults to library of all previous outputs and clips)
  const [activeTab, setActiveTab] = useState<StudioTab>('library');

  // Phonetic Rules state
  const [phoneticRules, setPhoneticRules] = useState<PhoneticRule[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_RULES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_PHONETIC_RULES;
  });

  // History state
  const [history, setHistory] = useState<GenerationHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  // Persisted Clips Library State (IndexedDB backed)
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [isClipsLoading, setIsClipsLoading] = useState(true);

  // Save to Library Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveModalInitialData, setSaveModalInitialData] = useState<{
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
  } | null>(null);

  // Persistent Player Audio State
  const [playerAudioUrl, setPlayerAudioUrl] = useState<string | null>(null);
  const [playerAudioBase64, setPlayerAudioBase64] = useState<string | null>(null);
  const [playerSampleRate, setPlayerSampleRate] = useState<SampleRate>(24000);
  const [playerTitle, setPlayerTitle] = useState<string>('TTS Audio Stream');
  const [playerSubtitle, setPlayerSubtitle] = useState<string | undefined>(undefined);
  const [playerTranscription, setPlayerTranscription] = useState<string | undefined>(undefined);

  // Synthesis loading states
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Modals state
  const [isPhoneticModalOpen, setIsPhoneticModalOpen] = useState(false);
  const [isScriptAssistantOpen, setIsScriptAssistantOpen] = useState(false);
  const [scriptAssistantInitialText, setScriptAssistantInitialText] = useState('');

  // Toast notifications
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Load persisted clips from IndexedDB on startup & migrate any unmigrated history
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let loadedClips = await getAllPersistedClips();
        
        // Check if there are history items in localStorage that should be backfilled into IndexedDB
        if (history.length > 0) {
          const existingIds = new Set(loadedClips.map((c) => c.id));
          const toMigrate: AudioClip[] = [];
          for (const item of history) {
            if (item.audioBase64 && !existingIds.has(item.id)) {
              const migratedClip: AudioClip = {
                id: item.id,
                title: item.title,
                description: item.isDialogue ? 'Multi-Speaker Dialogue' : `Voice: ${item.voiceName}`,
                category: item.isDialogue ? 'Conversational Dialogue' : 'IVR & Telephony',
                tags: [`${item.sampleRate / 1000}kHz`, item.voiceName, 'Vault Output'],
                isFavorite: false,
                voiceName: item.voiceName,
                sampleRate: item.sampleRate,
                duration: item.duration,
                timestamp: item.timestamp,
                audioBase64: item.audioBase64,
                audioUrl: item.audioUrl,
                fileSizeBytes: item.fileSizeBytes,
                sourceType: item.isDialogue ? 'tts_dialogue' : 'tts_single',
                transcription: item.text,
                styleDirective: item.styleDirective,
              };
              toMigrate.push(migratedClip);
              await savePersistedClip(migratedClip);
            }
          }
          if (toMigrate.length > 0) {
            loadedClips = await getAllPersistedClips();
          }
        }

        if (mounted) {
          setClips(loadedClips);
        }
      } catch (err) {
        console.error('Failed to load persisted audio clips from IndexedDB:', err);
      } finally {
        if (mounted) setIsClipsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Sync theme class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(LOCAL_STORAGE_THEME_KEY, String(isDarkMode));
  }, [isDarkMode]);

  // Sync phonetic rules to localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(phoneticRules));
  }, [phoneticRules]);

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
  };

  // Synthesize Single Speaker
  const handleSynthesizeSingle = async (params: {
    text: string;
    voiceName: string;
    styleDirectiveId: string;
    sampleRate: SampleRate;
  }) => {
    setIsSynthesizing(true);
    try {
      const response = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          phoneticRules,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Speech synthesis failed.');
      }

      // Create Blob URL from returned 16-bit PCM WAV base64
      const arrayBuf = base64ToArrayBuffer(data.audioBase64);
      const blob = new Blob([arrayBuf], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      setPlayerAudioUrl(url);
      setPlayerAudioBase64(data.audioBase64);
      setPlayerSampleRate(data.sampleRate);
      setPlayerTitle(`Voice: ${params.voiceName} (${params.sampleRate / 1000} kHz)`);
      setPlayerSubtitle(
        `Normalized: "${data.transformedText.slice(0, 45)}..." • ${(data.durationSeconds).toFixed(
          1
        )}s`
      );
      setPlayerTranscription(params.text);

      // Save to history
      const historyItem: GenerationHistoryItem = {
        id: `gen-${Date.now()}`,
        title: `${params.voiceName} - ${params.sampleRate / 1000} kHz Voice Clip`,
        text: params.text,
        voiceName: params.voiceName,
        styleDirective: params.styleDirectiveId,
        sampleRate: params.sampleRate,
        duration: data.durationSeconds,
        timestamp: Date.now(),
        audioBase64: data.audioBase64,
        audioUrl: url,
        fileSizeBytes: data.fileSizeBytes,
      };

      setHistory((prev) => [historyItem, ...prev]);

      // Auto-persist directly into IndexedDB Clip Library
      const persistedClip: AudioClip = {
        id: `clip-tts-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: `${params.voiceName} - ${params.sampleRate / 1000} kHz Voice Clip`,
        description: `Synthesized speech (${params.voiceName}, ${params.sampleRate} Hz 16-bit PCM WAV)`,
        category: params.sampleRate === 8000 ? 'IVR & Telephony' : 'Voice Assistant',
        tags: [`${params.sampleRate / 1000}kHz`, params.voiceName, 'Generated'],
        isFavorite: false,
        voiceName: params.voiceName,
        sampleRate: params.sampleRate,
        duration: data.durationSeconds,
        timestamp: Date.now(),
        audioBase64: data.audioBase64,
        audioUrl: url,
        fileSizeBytes: data.fileSizeBytes,
        sourceType: 'tts_single',
        transcription: params.text,
        styleDirective: params.styleDirectiveId,
      };

      savePersistedClip(persistedClip).catch((e) => console.error('Failed to auto-persist clip to IndexedDB:', e));
      setClips((prev) => [persistedClip, ...prev.filter((c) => c.id !== persistedClip.id)]);

      showToast(
        'success',
        `Synthesized & saved "${params.voiceName}" (${params.sampleRate / 1000} kHz) to Clip Library!`
      );
    } catch (err: any) {
      console.error(err);
      showToast('error', err.message || 'Speech synthesis failed. Check your connection or API key.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Synthesize Dialogue
  const handleSynthesizeDialogue = async (params: {
    turns: DialogueTurn[];
    sampleRate: SampleRate;
  }) => {
    setIsSynthesizing(true);
    try {
      const response = await fetch('/api/tts/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          phoneticRules,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Dialogue synthesis failed.');
      }

      const arrayBuf = base64ToArrayBuffer(data.audioBase64);
      const blob = new Blob([arrayBuf], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      setPlayerAudioUrl(url);
      setPlayerAudioBase64(data.audioBase64);
      setPlayerSampleRate(data.sampleRate);
      setPlayerTitle(`Multi-Speaker Dialogue (${params.sampleRate / 1000} kHz)`);
      setPlayerSubtitle(`${params.turns.length} conversational turns • ${(data.durationSeconds).toFixed(1)}s`);
      setPlayerTranscription(params.turns.map((t) => `${t.speaker}: ${t.text}`).join('\n'));

      // Save to history
      const historyItem: GenerationHistoryItem = {
        id: `gen-dialogue-${Date.now()}`,
        title: `Dialogue (${params.turns.length} turns) - ${params.sampleRate / 1000} kHz`,
        text: params.turns.map((t) => `${t.speaker}: ${t.text}`).join('\n'),
        voiceName: 'Multi-Speaker',
        sampleRate: params.sampleRate,
        duration: data.durationSeconds,
        timestamp: Date.now(),
        audioBase64: data.audioBase64,
        audioUrl: url,
        isDialogue: true,
        speakerCount: new Set(params.turns.map((t) => t.speaker)).size,
        fileSizeBytes: data.fileSizeBytes,
      };

      setHistory((prev) => [historyItem, ...prev]);

      // Auto-persist dialogue directly into IndexedDB Clip Library
      const persistedDialogueClip: AudioClip = {
        id: `clip-dialogue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: `Dialogue (${params.turns.length} turns) - ${params.sampleRate / 1000} kHz`,
        description: `Multi-speaker conversational dialogue (${new Set(params.turns.map((t) => t.speaker)).size} speakers, ${params.turns.length} turns)`,
        category: 'Conversational Dialogue',
        tags: [`${params.sampleRate / 1000}kHz`, 'Dialogue', 'Multi-Speaker'],
        isFavorite: false,
        voiceName: 'Multi-Speaker',
        sampleRate: params.sampleRate,
        duration: data.durationSeconds,
        timestamp: Date.now(),
        audioBase64: data.audioBase64,
        audioUrl: url,
        fileSizeBytes: data.fileSizeBytes,
        sourceType: 'tts_dialogue',
        transcription: params.turns.map((t) => `${t.speaker}: ${t.text}`).join('\n'),
      };

      savePersistedClip(persistedDialogueClip).catch((e) => console.error('Failed to auto-persist dialogue to IndexedDB:', e));
      setClips((prev) => [persistedDialogueClip, ...prev.filter((c) => c.id !== persistedDialogueClip.id)]);

      showToast('success', `Synthesized dialogue (${params.turns.length} turns) and saved to Clip Library!`);
    } catch (err: any) {
      console.error(err);
      showToast('error', err.message || 'Dialogue synthesis failed.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Load an audio URL into persistent player
  const handleLoadIntoPlayer = (url: string, sampleRate: SampleRate, title: string, base64?: string) => {
    setPlayerAudioUrl(url);
    if (base64) setPlayerAudioBase64(base64);
    setPlayerSampleRate(sampleRate);
    setPlayerTitle(title);
    setPlayerSubtitle(`${sampleRate / 1000} kHz 16-bit Mono Linear PCM WAV`);
    setPlayerTranscription(undefined);
    showToast('info', `Loaded into Studio Player: ${title}`);
  };

  // Play history item
  const handlePlayHistoryItem = (item: GenerationHistoryItem) => {
    let url = item.audioUrl;
    if (!url && item.audioBase64) {
      const arrayBuf = base64ToArrayBuffer(item.audioBase64);
      const blob = new Blob([arrayBuf], { type: 'audio/wav' });
      url = URL.createObjectURL(blob);
    }
    if (url) {
      setPlayerAudioUrl(url);
      setPlayerAudioBase64(item.audioBase64);
      setPlayerSampleRate(item.sampleRate);
      setPlayerTitle(item.title);
      setPlayerSubtitle(`${item.sampleRate / 1000} kHz 16-bit Mono Linear PCM WAV`);
      setPlayerTranscription(item.text);
      showToast('info', `Playing: ${item.title}`);
    }
  };

  // Play a Clip from Library
  const handlePlayClip = (clip: AudioClip) => {
    let url = clip.audioUrl;
    if (!url && clip.audioBase64) {
      const arrayBuf = base64ToArrayBuffer(clip.audioBase64);
      const blob = new Blob([arrayBuf], { type: 'audio/wav' });
      url = URL.createObjectURL(blob);
    }
    if (url) {
      setPlayerAudioUrl(url);
      setPlayerAudioBase64(clip.audioBase64);
      setPlayerSampleRate(clip.sampleRate);
      setPlayerTitle(clip.title);
      setPlayerSubtitle(`${clip.category} • ${clip.sampleRate / 1000} kHz WAV`);
      setPlayerTranscription(clip.transcription);
      showToast('info', `Loaded from Clip Library: ${clip.title}`);
    }
  };

  // Reload history item text into Studio
  const handleReloadToStudio = (item: GenerationHistoryItem) => {
    setActiveTab('single_speaker');
    showToast('info', `Loaded "${item.title}" text into Voice Studio.`);
  };

  // Open Save to Library Modal from current active player
  const handleOpenSaveCurrentToLibrary = () => {
    if (!playerAudioBase64 && !playerAudioUrl) {
      showToast('info', 'Synthesize or load audio before saving to library.');
      return;
    }
    setSaveModalInitialData({
      title: playerTitle.replace('Voice: ', '').replace('TTS Audio Stream', 'Saved Studio Clip'),
      category: 'IVR & Telephony',
      tags: [`${playerSampleRate / 1000}kHz`, 'Studio'],
      sampleRate: playerSampleRate,
      audioBase64: playerAudioBase64 || '',
      audioUrl: playerAudioUrl || undefined,
      transcription: playerTranscription,
      sourceType: 'tts_single',
    });
    setIsSaveModalOpen(true);
  };

  // Open Save to Library Modal from a history item
  const handleOpenSaveHistoryToLibrary = (item: GenerationHistoryItem) => {
    setSaveModalInitialData({
      title: item.title,
      category: item.isDialogue ? 'Conversational Dialogue' : 'IVR & Telephony',
      tags: [`${item.sampleRate / 1000}kHz`, item.voiceName],
      voiceName: item.voiceName,
      sampleRate: item.sampleRate,
      duration: item.duration,
      audioBase64: item.audioBase64,
      audioUrl: item.audioUrl,
      transcription: item.text,
      sourceType: item.isDialogue ? 'tts_dialogue' : 'tts_single',
      styleDirective: item.styleDirective,
    });
    setIsSaveModalOpen(true);
  };

  // Persist a new clip into IndexedDB
  const handleSaveClipToLibrary = async (clip: AudioClip) => {
    try {
      await savePersistedClip(clip);
      setClips((prev) => [clip, ...prev.filter((c) => c.id !== clip.id)]);
      showToast('success', `Saved "${clip.title}" to Clip Library!`);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to persist clip to IndexedDB.');
    }
  };

  // Toggle favorite in IndexedDB
  const handleToggleFavoriteClip = async (id: string) => {
    try {
      const isFav = await toggleClipFavorite(id);
      setClips((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isFavorite: isFav } : c))
      );
      showToast('info', isFav ? 'Pinned to favorites ★' : 'Removed from favorites');
    } catch (err: any) {
      console.error(err);
    }
  };

  // Delete clip from IndexedDB
  const handleDeleteClip = async (id: string) => {
    try {
      await deletePersistedClip(id);
      setClips((prev) => prev.filter((c) => c.id !== id));
      showToast('info', 'Clip deleted from library.');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to delete clip.');
    }
  };

  // Update clip metadata
  const handleUpdateClip = async (updated: AudioClip) => {
    try {
      await savePersistedClip(updated);
      setClips((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast('success', 'Clip metadata updated.');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to update clip.');
    }
  };

  // Import JSON library backup
  const handleImportLibrary = async (jsonStr: string): Promise<number> => {
    try {
      const count = await importLibraryArchiveJson(jsonStr);
      const reloaded = await getAllPersistedClips();
      setClips(reloaded);
      showToast('success', `Successfully imported ${count} audio clips into Library!`);
      return count;
    } catch (err: any) {
      console.error(err);
      showToast('error', err.message || 'Failed to import clip archive.');
      throw err;
    }
  };

  // Export JSON library backup
  const handleExportLibrary = async () => {
    try {
      const json = await exportLibraryArchiveJson();
      const blob = new Blob([json], { type: 'application/json' });
      triggerAudioDownload(blob, `tts_clip_library_backup_${new Date().toISOString().slice(0, 10)}.json`);
      showToast('success', 'Exported library backup archive (.json)');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to export library.');
    }
  };

  // Clear all clips
  const handleClearLibrary = async () => {
    if (window.confirm('Are you sure you want to clear all persisted clips from the library?')) {
      try {
        await clearAllPersistedClips();
        setClips([]);
        showToast('info', 'Clip library cleared.');
      } catch (err: any) {
        console.error(err);
      }
    }
  };

  // Open script assistant modal
  const handleOpenScriptAssistant = (initialText: string) => {
    setScriptAssistantInitialText(initialText);
    setIsScriptAssistantOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0A0A0C] text-slate-800 dark:text-slate-200 flex flex-col transition-colors selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        activePhoneticCount={phoneticRules.filter((r) => r.enabled).length}
        historyCount={history.length}
        libraryCount={clips.length}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 pb-32">
        {activeTab === 'single_speaker' && (
          <SingleSpeakerStudio
            onSynthesize={handleSynthesizeSingle}
            isSynthesizing={isSynthesizing}
            activeRules={phoneticRules}
            onOpenPhoneticModal={() => setIsPhoneticModalOpen(true)}
            onOpenScriptAssistant={handleOpenScriptAssistant}
          />
        )}

        {activeTab === 'multi_speaker' && (
          <MultiSpeakerStudio
            onSynthesizeDialogue={handleSynthesizeDialogue}
            isSynthesizing={isSynthesizing}
            activeRules={phoneticRules}
            onOpenScriptAssistant={handleOpenScriptAssistant}
          />
        )}

        {activeTab === 'upload_convert' && (
          <UploadConvertStudio
            onLoadIntoPlayer={handleLoadIntoPlayer}
            onSaveToLibrary={handleSaveClipToLibrary}
          />
        )}

        {activeTab === 'library' && (
          <ClipLibraryTab
            clips={clips}
            onPlayClip={handlePlayClip}
            onToggleFavorite={handleToggleFavoriteClip}
            onDeleteClip={handleDeleteClip}
            onUpdateClip={handleUpdateClip}
            onAddClip={handleSaveClipToLibrary}
            onImportLibrary={handleImportLibrary}
            onExportLibrary={handleExportLibrary}
            onClearLibrary={handleClearLibrary}
            onReloadToStudio={(text) => {
              setActiveTab('single_speaker');
              showToast('info', 'Loaded script into Voice Studio.');
            }}
          />
        )}

        {activeTab === 'phonetic_dict' && (
          <div className="bg-white dark:bg-[#0F0F13] rounded-2xl p-6 border border-slate-200 dark:border-[#1F1F28] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Phonetic Pronunciation Dictionary
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure text replacements and acronym expansions for natural acoustic output
                </p>
              </div>
              <button
                onClick={() => setIsPhoneticModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition-all active:scale-95"
              >
                Open Full Dictionary Manager
              </button>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
              <p>
                Default active normalization includes <strong className="text-slate-800 dark:text-slate-200">jcod / JCOD ➔ jay-cod</strong>,{' '}
                <strong className="text-slate-800 dark:text-slate-200">API ➔ A-P-I</strong>, <strong className="text-slate-800 dark:text-slate-200">TTS ➔ T-T-S</strong>, <strong className="text-slate-800 dark:text-slate-200">SQL ➔ sequel</strong>, and more.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryTab
            history={history}
            onPlayItem={handlePlayHistoryItem}
            onDeleteItem={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
            onClearAll={() => setHistory([])}
            onReloadToStudio={handleReloadToStudio}
            onSaveToLibrary={handleOpenSaveHistoryToLibrary}
          />
        )}
      </main>

      {/* Persistent Bottom Waveform Audio Player */}
      <AudioPlayerBar
        audioUrl={playerAudioUrl}
        audioBase64={playerAudioBase64}
        sampleRate={playerSampleRate}
        title={playerTitle}
        subtitle={playerSubtitle}
        onSaveToLibrary={playerAudioBase64 || playerAudioUrl ? handleOpenSaveCurrentToLibrary : undefined}
      />

      {/* Save To Clip Library Modal */}
      <SaveToLibraryModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveClipToLibrary}
        initialData={saveModalInitialData}
      />

      {/* Phonetic Dictionary Modal */}
      <PhoneticDictionaryModal
        rules={phoneticRules}
        onSaveRules={setPhoneticRules}
        isOpen={isPhoneticModalOpen}
        onClose={() => setIsPhoneticModalOpen(false)}
      />

      {/* AI Script Assistant Modal */}
      <ScriptAssistantModal
        isOpen={isScriptAssistantOpen}
        onClose={() => setIsScriptAssistantOpen(false)}
        initialText={scriptAssistantInitialText}
        onApplyScript={(script) => {
          showToast('success', 'Script applied from AI Assistant!');
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-medium backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/80 shadow-emerald-950/50'
                : toast.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-800/80 shadow-rose-950/50'
                : 'bg-[#121217]/95 text-slate-200 border-[#262634] shadow-black/60'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

