import { DialoguePreset } from '../types';

export const DIALOGUE_PRESETS: DialoguePreset[] = [
  {
    id: 'podcast_cohosts',
    title: 'AI Tech Podcast Co-Hosts',
    description: 'An engaging discussion between two hosts exploring modern neural speech engines.',
    speakers: [
      { name: 'Alex', voiceName: 'Puck' },
      { name: 'Maya', voiceName: 'Kore' },
    ],
    turns: [
      {
        speaker: 'Alex',
        voiceName: 'Puck',
        styleDirectiveId: 'energetic',
        text: 'Welcome back to Audio Horizons! Today we are diving into full-bandwidth neural speech synthesis and high-efficiency audio codecs.',
      },
      {
        speaker: 'Maya',
        voiceName: 'Kore',
        styleDirectiveId: 'natural',
        text: 'Thanks Alex! It is astonishing how modern models can seamlessly transition from 24 kHz high-definition studio fidelity down to 8 kHz telecommunication streams without losing phonetic clarity.',
      },
      {
        speaker: 'Alex',
        voiceName: 'Puck',
        styleDirectiveId: 'cheerful',
        text: 'Exactly. Especially for enterprise PBX systems and Asterisk IVR deployments where 8 kHz mono 16-bit PCM remains the golden standard.',
      },
      {
        speaker: 'Maya',
        voiceName: 'Kore',
        styleDirectiveId: 'natural',
        text: 'And with custom phonetic normalization, acronyms like JCOD and API are pronounced with absolute perfection.',
      },
    ],
  },
  {
    id: 'customer_support',
    title: 'Telephony Customer Support Call',
    description: 'A polite customer service interaction with an automated IVR assistant.',
    speakers: [
      { name: 'Agent (IVR)', voiceName: 'Zephyr' },
      { name: 'Customer', voiceName: 'Charon' },
    ],
    turns: [
      {
        speaker: 'Agent (IVR)',
        voiceName: 'Zephyr',
        styleDirectiveId: 'telephony_ivr',
        text: 'Thank you for calling Nova Cloud Services. To expedite your request, please state the service you need assistance with.',
      },
      {
        speaker: 'Customer',
        voiceName: 'Charon',
        styleDirectiveId: 'natural',
        text: 'Hi there, I need help configuring our telephony gateway for 8 kHz and 16 kHz SIP trunking.',
      },
      {
        speaker: 'Agent (IVR)',
        voiceName: 'Zephyr',
        styleDirectiveId: 'empathetic',
        text: 'I understand completely. I am routing your connection to a certified voice network specialist right away. Please hold for one brief moment.',
      },
    ],
  },
  {
    id: 'job_interview',
    title: 'Executive Technical Interview',
    description: 'A structured interview exploring audio engineering and real-time DSP pipelines.',
    speakers: [
      { name: 'Interviewer', voiceName: 'Fenrir' },
      { name: 'Candidate', voiceName: 'Aoede' },
    ],
    turns: [
      {
        speaker: 'Interviewer',
        voiceName: 'Fenrir',
        styleDirectiveId: 'broadcaster',
        text: 'Good morning. Could you walk us through the mathematical considerations when downsampling 24 kHz audio to 8 kHz telephony format?',
      },
      {
        speaker: 'Candidate',
        voiceName: 'Aoede',
        styleDirectiveId: 'natural',
        text: 'Certainly! When downsampling by a 3 to 1 ratio, an anti-aliasing lowpass filter with a cutoff near 3.8 kHz is essential to prevent high-frequency spectral components from folding back into the audible baseband.',
      },
      {
        speaker: 'Interviewer',
        voiceName: 'Fenrir',
        styleDirectiveId: 'natural',
        text: 'Spot on. And how do you maintain sample-accurate 16-bit PCM RIFF headers across variable buffer chunks?',
      },
      {
        speaker: 'Candidate',
        voiceName: 'Aoede',
        styleDirectiveId: 'cheerful',
        text: 'By calculating the exact byte rate and block alignment corresponding to the single-channel 16-bit layout, ensuring zero audio drift across playback devices.',
      },
    ],
  },
];
