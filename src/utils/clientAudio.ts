import { SampleRate, AudioFileMetadata } from '../types';
import { encode16BitMonoWav, resampleAudioBuffer } from './audioDsp';

/**
 * Decodes any audio file (WAV, MP3, M4A, OGG, WebM) using browser Web Audio API
 */
export async function decodeAudioFileWithWebAudio(
  file: File
): Promise<{
  audioBuffer: AudioBuffer;
  monoSamples: Float32Array;
  metadata: AudioFileMetadata;
}> {
  const arrayBuffer = await file.arrayBuffer();
  // Create an AudioContext
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const durationSeconds = audioBuffer.duration;
    const totalFrames = audioBuffer.length;

    // Mix down to mono
    const monoSamples = new Float32Array(totalFrames);
    for (let c = 0; c < channels; c++) {
      const chData = audioBuffer.getChannelData(c);
      for (let i = 0; i < totalFrames; i++) {
        monoSamples[i] += chData[i] / channels;
      }
    }

    const metadata: AudioFileMetadata = {
      fileName: file.name,
      fileSizeBytes: file.size,
      format: file.type || file.name.split('.').pop()?.toUpperCase() || 'AUDIO',
      sampleRate,
      channels,
      bitDepth: 16, // typical representation
      durationSeconds,
    };

    return { audioBuffer, monoSamples, metadata };
  } finally {
    audioCtx.close();
  }
}

/**
 * Resamples mono Float32Array samples directly in client and packages into a 16-bit PCM WAV Blob
 */
export function convertSamplesToWavBlob(
  samples: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: SampleRate
): { blob: Blob; url: string; durationSeconds: number; byteLength: number } {
  const resampled = resampleAudioBuffer(samples, sourceSampleRate, targetSampleRate);
  const wavBuffer = encode16BitMonoWav(resampled, targetSampleRate);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  return {
    blob,
    url,
    durationSeconds: resampled.length / targetSampleRate,
    byteLength: wavBuffer.byteLength,
  };
}

/**
 * Downloads a Blob with a specific filename
 */
export function triggerAudioDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
