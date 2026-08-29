export type SampleRate = 8000 | 16000 | 24000;

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Female' | 'Male' | 'Neutral';
  timbre: string;
  pitch: string;
  tone: string;
  personality: string[];
  recommendedFor: string[];
  description: string;
}

export interface VocalStyleDirective {
  id: string;
  name: string;
  description: string;
  promptPrefix: string;
  icon?: string;
  category: 'Standard' | 'Emotion' | 'Broadcast' | 'Specialty';
}

export interface PhoneticRule {
  id: string;
  target: string;
  replacement: string;
  caseSensitive: boolean;
  matchWholeWord: boolean;
  category: 'Acronym' | 'Brand' | 'Technical' | 'Custom';
  description?: string;
  enabled: boolean;
}

export interface DialogueTurn {
  id: string;
  speaker: string;
  voiceName: string;
  styleDirectiveId?: string;
  text: string;
}

export interface DialoguePreset {
  id: string;
  title: string;
  description: string;
  speakers: { name: string; voiceName: string }[];
  turns: Omit<DialogueTurn, 'id'>[];
}

export interface GenerationHistoryItem {
  id: string;
  title: string;
  text: string;
  voiceName: string;
  styleDirective?: string;
  sampleRate: SampleRate;
  duration: number;
  timestamp: number;
  audioBase64: string;
  audioUrl?: string;
  isDialogue?: boolean;
  speakerCount?: number;
  fileSizeBytes?: number;
}

export type ClipCategory =
  | 'IVR & Telephony'
  | 'Voice Assistant'
  | 'Voicemail & Attendant'
  | 'Podcast & Narration'
  | 'Prompts & Soundbites'
  | 'Conversational Dialogue'
  | 'Custom';

export interface AudioClip {
  id: string;
  title: string;
  description?: string;
  category: ClipCategory;
  tags: string[];
  isFavorite: boolean;
  voiceName?: string;
  sampleRate: SampleRate;
  duration: number;
  timestamp: number;
  audioBase64: string;
  audioUrl?: string;
  fileSizeBytes?: number;
  sourceType: 'tts_single' | 'tts_dialogue' | 'uploaded' | 'resampled';
  transcription?: string;
  styleDirective?: string;
}

export interface AudioFileMetadata {
  fileName: string;
  fileSizeBytes: number;
  format: string;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  durationSeconds: number;
}

export interface ResampleJobResult {
  originalMetadata: AudioFileMetadata;
  targetSampleRate: SampleRate;
  resampledBase64: string;
  resampledSizeBytes: number;
  durationSeconds: number;
}
