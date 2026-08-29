import JSZip from 'jszip';
import { AudioClip, GenerationHistoryItem, SampleRate } from '../types';
import { decodeWav, encode16BitMonoWav, resampleAudioBuffer } from './audioDsp';
import { triggerAudioDownload } from './clientAudio';

export interface ZipExportProgress {
  current: number;
  total: number;
  currentTitle: string;
  status: 'resampling' | 'packaging' | 'complete' | 'error';
  error?: string;
}

export type ZipExportFormat = 'original' | 8000 | 16000 | 24000 | 'all_formats';

/**
 * Extracts ArrayBuffer from AudioClip
 */
async function getClipArrayBuffer(clip: {
  audioUrl?: string;
  audioBase64?: string;
}): Promise<ArrayBuffer> {
  if (clip.audioUrl) {
    const res = await fetch(clip.audioUrl);
    return await res.arrayBuffer();
  }
  if (clip.audioBase64) {
    const bin = atob(clip.audioBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  throw new Error('No audio data found for clip');
}

/**
 * Sanitizes filename
 */
function sanitizeFilename(name: string, index: number, maxLen = 40): string {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, maxLen);
  const numPrefix = String(index + 1).padStart(3, '0');
  return `${numPrefix}_${clean || 'audio_clip'}`;
}

/**
 * Downloads a ZIP package of all provided audio clips
 */
export async function downloadClipsZip(
  clips: (AudioClip | GenerationHistoryItem)[],
  options: {
    format?: ZipExportFormat;
    zipFilename?: string;
    onProgress?: (p: ZipExportProgress) => void;
  } = {}
): Promise<void> {
  if (!clips || clips.length === 0) {
    throw new Error('No audio clips to export.');
  }

  const { format = 'original', zipFilename, onProgress } = options;
  const zip = new JSZip();

  const manifestItems: any[] = [];
  let fullTranscriptsText = `====================================================\nVOICE STUDIO - AUDIO CLIPS TRANSCRIPT INDEX\nGenerated: ${new Date().toISOString()}\nTotal Clips: ${clips.length}\n====================================================\n\n`;

  const total = clips.length;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const title = clip.title || `Clip ${i + 1}`;

    onProgress?.({
      current: i + 1,
      total,
      currentTitle: title,
      status: 'resampling',
    });

    try {
      const rawBuffer = await getClipArrayBuffer(clip);
      const decoded = decodeWav(rawBuffer);
      const baseFilename = sanitizeFilename(title, i);

      // Determine formats to pack
      if (format === 'all_formats') {
        // 8kHz PSTN
        const p8k = encode16BitMonoWav(
          resampleAudioBuffer(decoded.monoSamples, decoded.sampleRate, 8000),
          8000
        );
        zip.file(`8khz_telephony/${baseFilename}_8000hz_pstn.wav`, p8k);

        // 16kHz VoIP
        const p16k = encode16BitMonoWav(
          resampleAudioBuffer(decoded.monoSamples, decoded.sampleRate, 16000),
          16000
        );
        zip.file(`16khz_voip/${baseFilename}_16000hz_voip.wav`, p16k);

        // 24kHz HD
        const p24k = encode16BitMonoWav(
          resampleAudioBuffer(decoded.monoSamples, decoded.sampleRate, 24000),
          24000
        );
        zip.file(`24khz_studio/${baseFilename}_24000hz_master.wav`, p24k);
      } else if (typeof format === 'number') {
        const targetRate = format as SampleRate;
        const resampled = resampleAudioBuffer(decoded.monoSamples, decoded.sampleRate, targetRate);
        const wavBytes = encode16BitMonoWav(resampled, targetRate);
        zip.file(`${baseFilename}_${targetRate}hz.wav`, wavBytes);
      } else {
        // Original rate
        const origBytes = encode16BitMonoWav(decoded.monoSamples, decoded.sampleRate as SampleRate);
        zip.file(`${baseFilename}_${decoded.sampleRate}hz.wav`, origBytes);
      }

      const transcript =
        'transcription' in clip ? clip.transcription : 'text' in clip ? (clip as any).text : '';
      const voice =
        'voiceName' in clip ? clip.voiceName : 'isDialogue' in clip && (clip as any).isDialogue ? 'Multi-Speaker' : 'Voice';
      const category = 'category' in clip ? clip.category : 'Generated Audio';

      manifestItems.push({
        index: i + 1,
        id: clip.id,
        title,
        voice,
        category,
        sampleRate: clip.sampleRate,
        durationSeconds: clip.duration,
        timestamp: new Date(clip.timestamp).toISOString(),
        tags: 'tags' in clip ? clip.tags : [],
        transcript,
      });

      fullTranscriptsText += `[CLIP #${i + 1}] ${title}\n`;
      fullTranscriptsText += `Voice: ${voice} | Sample Rate: ${clip.sampleRate} Hz | Duration: ${clip.duration?.toFixed(2) || 'N/A'}s\n`;
      if (transcript) {
        fullTranscriptsText += `Transcript:\n"${transcript}"\n`;
      }
      fullTranscriptsText += `\n----------------------------------------------------\n\n`;
    } catch (clipErr) {
      console.warn(`Failed to package clip #${i + 1} (${title}):`, clipErr);
    }
  }

  onProgress?.({
    current: total,
    total,
    currentTitle: 'Creating ZIP archive...',
    status: 'packaging',
  });

  // Add manifest and documentation
  zip.file('manifest.json', JSON.stringify(manifestItems, null, 2));
  zip.file('transcripts.txt', fullTranscriptsText);
  zip.file(
    'README.txt',
    `VOICE STUDIO EXPORT BUNDLE\n==========================\n\nThis archive contains ${clips.length} audio clips generated or saved in Voice Studio.\n\nAudio Specs:\n- 16-bit Linear PCM Mono WAV\n- Telephony Standard: 8,000 Hz (PSTN / Asterisk PBX / Twilio IVR)\n- VoIP / Whisper Standard: 16,000 Hz (SIP / WebRTC / AI Pipelines)\n- Studio Master: 24,000 Hz Native Studio Speech\n\nIncluded Files:\n- WAV Audio files for every clip\n- manifest.json: Full structured metadata (IDs, categories, tags, timestamps)\n- transcripts.txt: Plaintext script and spoken dialogue index\n`
  );

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const finalName =
    zipFilename ||
    `voice_studio_all_clips_${new Date().toISOString().slice(0, 10)}.zip`;

  triggerAudioDownload(zipBlob, finalName);

  onProgress?.({
    current: total,
    total,
    currentTitle: 'Download Started',
    status: 'complete',
  });
}
