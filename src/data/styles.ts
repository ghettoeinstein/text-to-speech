import { VocalStyleDirective } from '../types';

export const VOCAL_STYLES: VocalStyleDirective[] = [
  {
    id: 'natural',
    name: 'Natural & Balanced',
    description: 'Conversational, fluent speech with balanced pacing and natural cadence.',
    promptPrefix: 'Speak in a natural, clear, and relaxed conversational tone: ',
    category: 'Standard',
  },
  {
    id: 'cheerful',
    name: 'Cheerful & Upbeat',
    description: 'Warm, smiling, and optimistic tone with lively inflection.',
    promptPrefix: 'Say cheerfully and warmly with an uplifting positive energy: ',
    category: 'Emotion',
  },
  {
    id: 'broadcaster',
    name: 'Professional Broadcaster',
    description: 'Crisp enunciation, steady projection, and authoritative radio delivery.',
    promptPrefix: 'Deliver in a professional studio news broadcaster style with crisp enunciation: ',
    category: 'Broadcast',
  },
  {
    id: 'whispering',
    name: 'Soft Whisper / ASMR',
    description: 'Intimate, breathy, quiet voice suitable for ASMR and calm intros.',
    promptPrefix: 'Whisper softly and gently in an intimate, relaxing breathy voice: ',
    category: 'Specialty',
  },
  {
    id: 'storyteller',
    name: 'Expressive Storyteller',
    description: 'Dramatic pauses, dynamic emotional arc, and theatrical narration.',
    promptPrefix: 'Narrate like an engaging theatrical storyteller with expressive pacing and nuance: ',
    category: 'Specialty',
  },
  {
    id: 'energetic',
    name: 'High-Energy Promo',
    description: 'Fast, hype, and exciting delivery for commercials and teasers.',
    promptPrefix: 'Say enthusiastically with high energy, punchy emphasis, and excitement: ',
    category: 'Emotion',
  },
  {
    id: 'empathetic',
    name: 'Empathetic Customer Care',
    description: 'Gentle, understanding, patient, and reassuring tone.',
    promptPrefix: 'Speak with deep empathy, patient understanding, and reassuring warmth: ',
    category: 'Emotion',
  },
  {
    id: 'telephony_ivr',
    name: 'Telephony IVR & PBX Prompt',
    description: 'Clean, direct, perfectly enunciated phone menu announcement.',
    promptPrefix: 'Speak clearly and concisely for an automated telephony phone menu prompt: ',
    category: 'Broadcast',
  },
  {
    id: 'serious_doc',
    name: 'Serious Documentary',
    description: 'Thoughtful, sober, and articulate delivery with deliberate pacing.',
    promptPrefix: 'Deliver in a grave, thoughtful, and articulate documentary narration tone: ',
    category: 'Standard',
  },
];
