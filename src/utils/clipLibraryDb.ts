import { AudioClip, ClipCategory, SampleRate } from '../types';

const DB_NAME = 'TTS_AudioClipLibrary_DB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_clips';
const LOCAL_STORAGE_BACKUP_KEY = 'gemini_tts_persisted_clips_meta_v1';

// Starter default library clips for instant demonstration and out-of-the-box utility
export const STARTER_LIBRARY_CLIPS: Omit<AudioClip, 'audioBase64'>[] = [
  {
    id: 'clip-starter-ivr-1',
    title: 'Enterprise IVR Main Attendant',
    description: 'Standard 8 kHz telephony greeting with departmental call routing menu options.',
    category: 'IVR & Telephony',
    tags: ['IVR', 'Telephony', 'PSTN', '8kHz', 'Greeting'],
    isFavorite: true,
    voiceName: 'Puck',
    sampleRate: 8000,
    duration: 5.4,
    timestamp: Date.now() - 86400000 * 2,
    sourceType: 'tts_single',
    transcription: 'Thank you for calling Apex Global Systems. For sales, press one. For customer support, press two. To speak with an operator, please stay on the line.',
    styleDirective: 'telecom_ivr',
  },
  {
    id: 'clip-starter-assistant-2',
    title: 'AI Smart Home Assistant Activation',
    description: '16 kHz wideband acoustic response for low-latency neural assistant interactions.',
    category: 'Voice Assistant',
    tags: ['AI Assistant', '16kHz', 'Whisper', 'Smart Home'],
    isFavorite: true,
    voiceName: 'Aoede',
    sampleRate: 16000,
    duration: 3.8,
    timestamp: Date.now() - 86400000,
    sourceType: 'tts_single',
    transcription: 'Good morning! Your morning briefing is ready. Today will be sunny with a high of 72 degrees.',
    styleDirective: 'warm_intimate',
  },
  {
    id: 'clip-starter-podcast-3',
    title: 'Studio Tech Podcast Introduction',
    description: '24 kHz high-definition studio master voiceover with crisp resonance.',
    category: 'Podcast & Narration',
    tags: ['Podcast', 'Broadcast', '24kHz', 'Studio Master', 'HD'],
    isFavorite: false,
    voiceName: 'Charon',
    sampleRate: 24000,
    duration: 6.2,
    timestamp: Date.now() - 3600000 * 5,
    sourceType: 'tts_single',
    transcription: 'Welcome back to Deep Dive Tech. Today we examine the cutting edge of real-time conversational intelligence and audio digital signal processing.',
    styleDirective: 'news_broadcaster',
  },
  {
    id: 'clip-starter-voicemail-4',
    title: 'Executive Voicemail Dispatch',
    description: 'Concise 8 kHz telephone voicemail recording for off-hours inquiries.',
    category: 'Voicemail & Attendant',
    tags: ['Voicemail', 'After-Hours', '8kHz', 'Business'],
    isFavorite: false,
    voiceName: 'Kore',
    sampleRate: 8000,
    duration: 4.1,
    timestamp: Date.now() - 3600000 * 2,
    sourceType: 'tts_single',
    transcription: 'You have reached the executive offices of Dr. Aris. Please leave your name, phone number, and brief message after the beep.',
    styleDirective: 'neutral',
  },
];

/**
 * Initializes and returns the IndexedDB database instance
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
        store.createIndex('sampleRate', 'sampleRate', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Generate a synthetic placeholder WAV buffer for starter demo clips if needed
 */
function generateStarterToneWavBase64(sampleRate: number, durationSec: number = 3): string {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // Write WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Generate a gentle pleasant chord sequence (F, A, C) with soft decay
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 0.8) * Math.sin(Math.min(1, t * 8) * Math.PI * 0.5);
    const f1 = 349.23; // F4
    const f2 = 440.0;  // A4
    const f3 = 523.25; // C5
    const sample = (
      0.4 * Math.sin(2 * Math.PI * f1 * t) +
      0.3 * Math.sin(2 * Math.PI * f2 * t) +
      0.2 * Math.sin(2 * Math.PI * f3 * t)
    ) * env;
    const clamped = Math.max(-1, Math.min(1, sample));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  // Convert to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Retrieve all persisted audio clips from IndexedDB, initializing defaults if empty
 */
export async function getAllPersistedClips(): Promise<AudioClip[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = async () => {
        const results: AudioClip[] = request.result || [];
        if (results.length === 0) {
          // Initialize with starter clips
          const seededClips: AudioClip[] = STARTER_LIBRARY_CLIPS.map((starter) => {
            const base64 = generateStarterToneWavBase64(starter.sampleRate, starter.duration);
            return {
              ...starter,
              audioBase64: base64,
              fileSizeBytes: Math.floor(starter.sampleRate * 2 * starter.duration + 44),
            };
          });

          try {
            await saveClipsBulk(seededClips);
            resolve(seededClips);
          } catch {
            resolve(seededClips);
          }
        } else {
          // Sort newest first
          results.sort((a, b) => b.timestamp - a.timestamp);
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB unavailable, falling back to localStorage metadata:', err);
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

/**
 * Save or update an audio clip in IndexedDB
 */
export async function savePersistedClip(clip: AudioClip): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(clip);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to save clip to IndexedDB:', err);
    throw err;
  }
}

/**
 * Bulk save multiple clips
 */
export async function saveClipsBulk(clips: AudioClip[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    for (const clip of clips) {
      store.put(clip);
    }
  });
}

/**
 * Delete an audio clip by ID
 */
export async function deletePersistedClip(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to delete clip from IndexedDB:', err);
    throw err;
  }
}

/**
 * Toggle favorite status of a clip
 */
export async function toggleClipFavorite(id: string): Promise<boolean> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const clip: AudioClip | undefined = getRequest.result;
      if (!clip) {
        reject(new Error('Clip not found'));
        return;
      }
      clip.isFavorite = !clip.isFavorite;
      const putRequest = store.put(clip);
      putRequest.onsuccess = () => resolve(clip.isFavorite);
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Clear all persisted clips
 */
export async function clearAllPersistedClips(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Calculate total storage and duration stats
 */
export async function getLibraryStorageStats(): Promise<{
  totalClips: number;
  totalDurationSeconds: number;
  estimatedBytes: number;
  favoritesCount: number;
}> {
  const clips = await getAllPersistedClips();
  let totalDuration = 0;
  let totalBytes = 0;
  let favorites = 0;

  for (const c of clips) {
    totalDuration += c.duration || 0;
    totalBytes += c.fileSizeBytes || (c.audioBase64 ? c.audioBase64.length * 0.75 : 0);
    if (c.isFavorite) favorites++;
  }

  return {
    totalClips: clips.length,
    totalDurationSeconds: totalDuration,
    estimatedBytes: Math.round(totalBytes),
    favoritesCount: favorites,
  };
}

/**
 * Export entire library as JSON payload for backup/migration
 */
export async function exportLibraryArchiveJson(): Promise<string> {
  const clips = await getAllPersistedClips();
  const archive = {
    version: '1.0.0',
    exportTimestamp: Date.now(),
    app: 'AI TTS Studio & Resampler',
    totalClips: clips.length,
    clips,
  };
  return JSON.stringify(archive, null, 2);
}

/**
 * Import library archive from JSON string
 */
export async function importLibraryArchiveJson(jsonString: string): Promise<number> {
  const parsed = JSON.parse(jsonString);
  const clipsToImport: AudioClip[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.clips)
    ? parsed.clips
    : [];

  if (clipsToImport.length === 0) {
    throw new Error('No valid clips found in the imported file.');
  }

  // Validate and sanitize imported clips
  const validClips: AudioClip[] = (clipsToImport as any[]).map((c: any, index: number) => ({
    id: c.id || `imported-clip-${Date.now()}-${index}`,
    title: c.title || `Imported Clip ${index + 1}`,
    description: c.description || '',
    category: (c.category as ClipCategory) || 'Custom',
    tags: Array.isArray(c.tags) ? c.tags : ['Imported'],
    isFavorite: Boolean(c.isFavorite),
    voiceName: c.voiceName || 'Custom',
    sampleRate: (c.sampleRate as SampleRate) || 24000,
    duration: Number(c.duration) || 0,
    timestamp: Number(c.timestamp) || Date.now(),
    audioBase64: c.audioBase64 || '',
    fileSizeBytes: Number(c.fileSizeBytes) || 0,
    sourceType: c.sourceType || 'uploaded',
    transcription: c.transcription || c.text || '',
    styleDirective: c.styleDirective || '',
  }));

  await saveClipsBulk(validClips);
  return validClips.length;
}
