import { SampleRate } from '../types';

/**
 * Parses a WAV ArrayBuffer and returns samples as Float32Array (-1.0 to 1.0)
 * alongside sample rate, channel count, and bit depth.
 */
export interface DecodedWav {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  durationSeconds: number;
  channelData: Float32Array[]; // channel index -> samples
  monoSamples: Float32Array;   // mixed-down mono samples
}

export function decodeWav(buffer: ArrayBuffer): DecodedWav {
  const dataView = new DataView(buffer);
  
  // Read RIFF chunk descriptor
  const riff = String.fromCharCode(
    dataView.getUint8(0),
    dataView.getUint8(1),
    dataView.getUint8(2),
    dataView.getUint8(3)
  );
  if (riff !== 'RIFF') {
    throw new Error('Invalid WAV: Missing RIFF signature');
  }

  const wave = String.fromCharCode(
    dataView.getUint8(8),
    dataView.getUint8(9),
    dataView.getUint8(10),
    dataView.getUint8(11)
  );
  if (wave !== 'WAVE') {
    throw new Error('Invalid WAV: Missing WAVE format tag');
  }

  let offset = 12;
  let audioFormat = 1;
  let channels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataSize = 0;

  // Traverse chunks
  while (offset < buffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      dataView.getUint8(offset),
      dataView.getUint8(offset + 1),
      dataView.getUint8(offset + 2),
      dataView.getUint8(offset + 3)
    );
    const chunkSize = dataView.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      audioFormat = dataView.getUint16(offset + 8, true);
      channels = dataView.getUint16(offset + 10, true);
      sampleRate = dataView.getUint32(offset + 12, true);
      bitsPerSample = dataView.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
  }

  if (dataOffset === 0) {
    // If no explicit data chunk found, assume standard 44 byte header
    dataOffset = 44;
    dataSize = buffer.byteLength - 44;
  }

  if (audioFormat !== 1 && audioFormat !== 3) {
    // 1 = PCM, 3 = IEEE Float
    // We will still attempt standard 16-bit PCM interpretation if possible
  }

  const bytesPerSample = bitsPerSample / 8;
  const totalFrames = Math.floor(dataSize / (channels * bytesPerSample));
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    channelData.push(new Float32Array(totalFrames));
  }

  const monoSamples = new Float32Array(totalFrames);

  for (let i = 0; i < totalFrames; i++) {
    let frameSum = 0;
    for (let c = 0; c < channels; c++) {
      const sampleOffset = dataOffset + (i * channels + c) * bytesPerSample;
      let sampleVal = 0;

      if (sampleOffset + bytesPerSample <= buffer.byteLength) {
        if (bitsPerSample === 16) {
          sampleVal = dataView.getInt16(sampleOffset, true) / 32768.0;
        } else if (bitsPerSample === 8) {
          sampleVal = (dataView.getUint8(sampleOffset) - 128) / 128.0;
        } else if (bitsPerSample === 24) {
          const b0 = dataView.getUint8(sampleOffset);
          const b1 = dataView.getUint8(sampleOffset + 1);
          const b2 = dataView.getInt8(sampleOffset + 2);
          const val24 = (b2 << 16) | (b1 << 8) | b0;
          sampleVal = val24 / 8388608.0;
        } else if (bitsPerSample === 32) {
          if (audioFormat === 3) {
            sampleVal = dataView.getFloat32(sampleOffset, true);
          } else {
            sampleVal = dataView.getInt32(sampleOffset, true) / 2147483648.0;
          }
        }
      }

      channelData[c][i] = sampleVal;
      frameSum += sampleVal;
    }
    monoSamples[i] = frameSum / channels;
  }

  const durationSeconds = totalFrames / sampleRate;

  return {
    sampleRate,
    channels,
    bitDepth: bitsPerSample,
    durationSeconds,
    channelData,
    monoSamples,
  };
}

/**
 * Creates a standard 44-byte canonical RIFF 16-bit mono PCM WAV ArrayBuffer.
 */
export function encode16BitMonoWav(samples: Float32Array, sampleRate: SampleRate): ArrayBuffer {
  const numSamples = samples.length;
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample; // 2 bytes
  const byteRate = sampleRate * blockAlign;        // e.g. 16000 bytes/sec for 8kHz
  const dataByteLength = numSamples * blockAlign;
  const totalFileLength = 44 + dataByteLength;

  const buffer = new ArrayBuffer(totalFileLength);
  const view = new DataView(buffer);

  // RIFF identifier 'RIFF'
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'

  // file length - 8
  view.setUint32(4, 36 + dataByteLength, true);

  // 'WAVE'
  view.setUint8(8, 0x57);  // 'W'
  view.setUint8(9, 0x41);  // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'

  // 'fmt ' chunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6d); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '

  // Subchunk1Size = 16 for PCM
  view.setUint32(16, 16, true);
  // AudioFormat = 1 (Linear PCM)
  view.setUint16(20, 1, true);
  // NumChannels = 1 (Mono)
  view.setUint16(22, numChannels, true);
  // SampleRate
  view.setUint32(24, sampleRate, true);
  // ByteRate
  view.setUint32(28, byteRate, true);
  // BlockAlign
  view.setUint16(32, blockAlign, true);
  // BitsPerSample
  view.setUint16(34, bitsPerSample, true);

  // 'data' chunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'

  // Subchunk2Size
  view.setUint32(40, dataByteLength, true);

  // Write 16-bit signed PCM samples with soft clipping protection
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    let s = samples[i];
    // Soft limiter / clamp
    if (s > 1.0) s = 1.0;
    else if (s < -1.0) s = -1.0;

    const pcm16 = s < 0 ? s * 32768 : s * 32767;
    view.setInt16(offset, Math.round(pcm16), true);
    offset += 2;
  }

  return buffer;
}

/**
 * High-Quality Bandlimited Audio Resampler
 * Uses sinc interpolation with Lanczos/Blackman windowing and anti-aliasing lowpass filtering
 * when downsampling to prevent Nyquist foldback and aliasing artifacts.
 */
export function resampleAudioBuffer(
  inputSamples: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: SampleRate
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return new Float32Array(inputSamples);
  }

  const ratio = targetSampleRate / sourceSampleRate;
  const outputLength = Math.max(1, Math.round(inputSamples.length * ratio));
  const output = new Float32Array(outputLength);

  // Anti-aliasing filter cutoff
  const isDownsampling = targetSampleRate < sourceSampleRate;
  const cutoff = isDownsampling ? (targetSampleRate / 2) * 0.9 / (sourceSampleRate / 2) : 1.0;
  const filterKernelRadius = isDownsampling ? Math.ceil(8 / cutoff) : 8;

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i / ratio;
    const center = Math.floor(srcIndex);
    let sampleSum = 0;
    let weightSum = 0;

    const start = Math.max(0, center - filterKernelRadius);
    const end = Math.min(inputSamples.length - 1, center + filterKernelRadius);

    for (let j = start; j <= end; j++) {
      const x = (srcIndex - j) * (isDownsampling ? cutoff : 1.0);
      if (Math.abs(x) < 0.0001) {
        sampleSum += inputSamples[j];
        weightSum += 1.0;
      } else if (Math.abs(x) < filterKernelRadius) {
        // Lanczos / Sinc windowed kernel
        const piX = Math.PI * x;
        const sinc = Math.sin(piX) / piX;
        const windowVal = 0.5 * (1 + Math.cos((Math.PI * x) / filterKernelRadius)); // Hann/Cosine window
        const weight = sinc * windowVal * (isDownsampling ? cutoff : 1.0);

        sampleSum += inputSamples[j] * weight;
        weightSum += weight;
      }
    }

    output[i] = weightSum !== 0 ? sampleSum / weightSum : 0;
  }

  return output;
}

/**
 * Converts ArrayBuffer to Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Extracts raw 16-bit PCM from base64 string (either WAV or raw 24kHz PCM)
 * and resamples it to target sample rate, returning a standard WAV ArrayBuffer.
 */
export function processTtsAudioPayload(
  base64Audio: string,
  targetSampleRate: SampleRate,
  assumedSourceSampleRate: number = 24000
): { wavBuffer: ArrayBuffer; durationSeconds: number } {
  const rawBuffer = base64ToArrayBuffer(base64Audio);
  let monoSamples: Float32Array;
  let sourceRate = assumedSourceSampleRate;

  // Check if it's already a valid WAV container
  const headerCheck = new Uint8Array(rawBuffer.slice(0, 4));
  const isRiff =
    headerCheck[0] === 0x52 &&
    headerCheck[1] === 0x49 &&
    headerCheck[2] === 0x46 &&
    headerCheck[3] === 0x46;

  if (isRiff) {
    const decoded = decodeWav(rawBuffer);
    monoSamples = decoded.monoSamples;
    sourceRate = decoded.sampleRate;
  } else {
    // Treat as raw 16-bit PCM (standard Gemini Live/TTS raw stream format)
    const view = new DataView(rawBuffer);
    const totalSamples = Math.floor(rawBuffer.byteLength / 2);
    monoSamples = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      monoSamples[i] = view.getInt16(i * 2, true) / 32768.0;
    }
  }

  // Resample
  const resampled = resampleAudioBuffer(monoSamples, sourceRate, targetSampleRate);
  const wavBuffer = encode16BitMonoWav(resampled, targetSampleRate);
  const durationSeconds = resampled.length / targetSampleRate;

  return { wavBuffer, durationSeconds };
}
