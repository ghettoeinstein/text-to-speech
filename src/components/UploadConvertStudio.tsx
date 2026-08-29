import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileAudio,
  Activity,
  CheckCircle2,
  Radio,
  Download,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  BookmarkPlus,
} from 'lucide-react';
import { SampleRate, AudioFileMetadata, AudioClip } from '../types';
import { decodeAudioFileWithWebAudio, convertSamplesToWavBlob, triggerAudioDownload } from '../utils/clientAudio';

interface UploadConvertStudioProps {
  onLoadIntoPlayer: (url: string, sampleRate: SampleRate, title: string, base64?: string) => void;
  onSaveToLibrary?: (clip: AudioClip) => void;
}

export const UploadConvertStudio: React.FC<UploadConvertStudioProps> = ({ onLoadIntoPlayer, onSaveToLibrary }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<AudioFileMetadata | null>(null);
  const [monoSamples, setMonoSamples] = useState<Float32Array | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);

  const [targetSampleRate, setTargetSampleRate] = useState<SampleRate>(8000);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedResult, setConvertedResult] = useState<{
    blob: Blob;
    url: string;
    durationSeconds: number;
    byteLength: number;
    sampleRate: SampleRate;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileProcess = async (file: File) => {
    setErrorMessage(null);
    setIsConverting(true);
    setConvertedResult(null);

    try {
      const { audioBuffer, monoSamples: decodedMono, metadata: meta } =
        await decodeAudioFileWithWebAudio(file);

      setUploadedFile(file);
      setMetadata(meta);
      setMonoSamples(decodedMono);
      setOriginalAudioUrl(URL.createObjectURL(file));

      // Auto convert to selected sample rate
      const res = convertSamplesToWavBlob(decodedMono, meta.sampleRate, targetSampleRate);
      setConvertedResult({
        ...res,
        sampleRate: targetSampleRate,
      });
    } catch (err: any) {
      console.error('File decode failed:', err);
      setErrorMessage(
        'Failed to decode audio file. Please ensure it is a valid WAV, MP3, M4A, OGG, or WebM audio file.'
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleReConvert = (newTargetRate: SampleRate) => {
    setTargetSampleRate(newTargetRate);
    if (!monoSamples || !metadata) return;

    setIsConverting(true);
    setTimeout(() => {
      try {
        const res = convertSamplesToWavBlob(monoSamples, metadata.sampleRate, newTargetRate);
        setConvertedResult({
          ...res,
          sampleRate: newTargetRate,
        });
      } catch (err: any) {
        console.error(err);
      } finally {
        setIsConverting(false);
      }
    }, 50);
  };

  const handleDownloadConverted = () => {
    if (!convertedResult || !metadata) return;
    const baseName = metadata.fileName.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}_converted_${convertedResult.sampleRate}hz_16bit_mono.wav`;
    triggerAudioDownload(convertedResult.blob, filename);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSaveToLibraryClick = async () => {
    if (!convertedResult || !metadata) return;
    try {
      const arrayBuf = await convertedResult.blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuf);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const newClip: AudioClip = {
        id: `clip-converted-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: `Resampled: ${metadata.fileName.replace(/\.[^/.]+$/, '')}`,
        description: `Source: ${metadata.fileName} (${metadata.sampleRate} Hz) resampled to ${convertedResult.sampleRate} Hz 16-bit Mono WAV.`,
        category: convertedResult.sampleRate === 8000 ? 'IVR & Telephony' : 'Custom',
        tags: [`${convertedResult.sampleRate / 1000}kHz`, 'Resampled', metadata.format],
        isFavorite: false,
        voiceName: 'Converted Audio',
        sampleRate: convertedResult.sampleRate,
        duration: convertedResult.durationSeconds,
        timestamp: Date.now(),
        audioBase64: base64,
        audioUrl: convertedResult.url,
        fileSizeBytes: convertedResult.byteLength,
        sourceType: 'resampled',
      };

      if (onSaveToLibrary) {
        onSaveToLibrary(newClip);
      }
    } catch (e) {
      console.error('Failed to convert blob to base64 for library:', e);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Overview Banner */}
      <div className="bg-white dark:bg-[#0F0F13] rounded-2xl p-6 border border-slate-200 dark:border-[#1F1F28] shadow-sm">
        <div className="max-w-3xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            <Activity className="w-5 h-5 text-indigo-500" />
            Audio Inspector & Telephony Resampler (8k / 16k / 24k)
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Upload any source audio file (WAV, MP3, M4A, OGG, WebM) to inspect its exact RIFF metadata
            and convert it into a sample-accurate <strong>16-bit Mono Linear PCM WAV</strong> with
            anti-aliasing bandlimited lowpass filtering.
          </p>
        </div>
      </div>

      {/* Upload Drag & Drop Zone */}
      <div
        id="audio-upload-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-4 ring-indigo-500/10'
            : 'border-slate-300 dark:border-[#22222E] bg-white dark:bg-[#0F0F13] hover:border-indigo-400 dark:hover:border-[#2C2C3A] hover:bg-slate-50/50 dark:hover:bg-[#131319]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,.m4a,.ogg,.webm,audio/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/80 shadow-inner">
            <UploadCloud className="w-7 h-7" />
          </div>

          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              Drag and drop your audio file here, or click to browse
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports .wav, .mp3, .m4a, .ogg, .webm (Up to 50MB)
            </p>
          </div>

          {uploadedFile && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Loaded: {uploadedFile.name} ({formatFileSize(uploadedFile.size)})
            </span>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Audio Inspector & Conversion Workspace */}
      {metadata && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Original Audio Metadata Inspector */}
          <div className="bg-white dark:bg-[#0F0F13] rounded-2xl p-5 border border-slate-200 dark:border-[#1F1F28] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E1E28] pb-3">
              <div className="flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-indigo-500" />
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  Source Audio Inspection
                </h4>
              </div>
              <span className="text-[10px] font-mono bg-slate-100 dark:bg-[#181822] px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-[#242432]">
                {metadata.format}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#1F1F28]">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Original Sample Rate</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white font-mono mt-0.5">
                  {(metadata.sampleRate / 1000).toFixed(1)} kHz
                </p>
                <span className="text-[10px] text-slate-400">{metadata.sampleRate} Hz</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#1F1F28]">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Audio Channels</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white font-mono mt-0.5">
                  {metadata.channels === 1 ? '1 (Mono)' : `${metadata.channels} (Stereo)`}
                </p>
                <span className="text-[10px] text-slate-400">Mixdown to Mono on export</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#1F1F28]">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Duration</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white font-mono mt-0.5">
                  {metadata.durationSeconds.toFixed(2)}s
                </p>
                <span className="text-[10px] text-slate-400">
                  {Math.round(metadata.durationSeconds * metadata.sampleRate).toLocaleString()}{' '}
                  samples
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#1F1F28]">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Source File Size</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white font-mono mt-0.5">
                  {formatFileSize(metadata.fileSizeBytes)}
                </p>
                <span className="text-[10px] text-slate-400 truncate block">{metadata.fileName}</span>
              </div>
            </div>

            {/* Original Preview Player */}
            {originalAudioUrl && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Original Source Playback:
                </p>
                <audio controls src={originalAudioUrl} className="w-full h-9 rounded-lg" />
              </div>
            )}
          </div>

          {/* Right: Resampling Target Selector & Converted Output */}
          <div className="bg-white dark:bg-[#0F0F13] rounded-2xl p-5 border border-slate-200 dark:border-[#1F1F28] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E1E28] pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-500" />
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  Target Telephony / AI Standard
                </h4>
              </div>
              <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
                Anti-Aliasing Sinc
              </span>
            </div>

            {/* Target Sample Rate Selection Buttons */}
            <div className="space-y-2">
              {/* 8 kHz */}
              <div
                onClick={() => handleReConvert(8000)}
                className={`p-3 rounded-xl cursor-pointer border transition-all text-left ${
                  targetSampleRate === 8000
                    ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                    : 'bg-slate-50 dark:bg-[#09090C] border-slate-200 dark:border-[#1F1F28] hover:border-slate-300 dark:hover:border-[#2C2C3A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    8,000 Hz (8 kHz) Telephony IVR / PBX
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">16 kB/s byte rate</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Standard for Asterisk PBX, FreePBX, PSTN telephone networks, and Cisco IVR.
                </p>
              </div>

              {/* 16 kHz */}
              <div
                onClick={() => handleReConvert(16000)}
                className={`p-3 rounded-xl cursor-pointer border transition-all text-left ${
                  targetSampleRate === 16000
                    ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30'
                    : 'bg-slate-50 dark:bg-[#09090C] border-slate-200 dark:border-[#1F1F28] hover:border-slate-300 dark:hover:border-[#2C2C3A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    16,000 Hz (16 kHz) AI Speech & VoIP
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">32 kB/s byte rate</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Optimized for OpenAI Whisper, WebRTC voice pipelines, and modern wideband telephony.
                </p>
              </div>

              {/* 24 kHz */}
              <div
                onClick={() => handleReConvert(24000)}
                className={`p-3 rounded-xl cursor-pointer border transition-all text-left ${
                  targetSampleRate === 24000
                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                    : 'bg-slate-50 dark:bg-[#09090C] border-slate-200 dark:border-[#1F1F28] hover:border-slate-300 dark:hover:border-[#2C2C3A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    24,000 Hz (24 kHz) Studio Audio
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">48 kB/s byte rate</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Full bandwidth studio audio with maximum dynamic headroom.
                </p>
              </div>
            </div>

            {/* Converted Playback & Download */}
            {convertedResult && (
              <div className="border-t border-slate-100 dark:border-[#1E1E28] pt-3 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Converted WAV Output ({convertedResult.sampleRate / 1000} kHz Mono 16-bit):
                  </span>
                  <span className="font-mono text-slate-400">
                    {formatFileSize(convertedResult.byteLength)}
                  </span>
                </div>

                <audio controls src={convertedResult.url} className="w-full h-9 rounded-lg" />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleDownloadConverted}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/25 ring-1 ring-indigo-400/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download {convertedResult.sampleRate / 1000} kHz WAV
                  </button>

                  {onSaveToLibrary && (
                    <button
                      onClick={handleSaveToLibraryClick}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-slate-200 dark:border-[#262634] flex items-center gap-1.5 transition-colors"
                      title="Persist to Clip Library"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>Save to Library</span>
                    </button>
                  )}

                  <button
                    onClick={() =>
                      onLoadIntoPlayer(
                        convertedResult.url,
                        convertedResult.sampleRate,
                        `Converted: ${metadata.fileName}`
                      )
                    }
                    className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-[#262634] transition-colors"
                    title="Load into persistent player"
                  >
                    Send to Studio Player
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
