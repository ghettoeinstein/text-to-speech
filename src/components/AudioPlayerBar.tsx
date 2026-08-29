import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Repeat,
  Download,
  Activity,
  Layers,
  ChevronUp,
  Sparkles,
  BookmarkPlus,
} from 'lucide-react';
import { SampleRate } from '../types';
import { decodeWav, encode16BitMonoWav, resampleAudioBuffer } from '../utils/audioDsp';
import { triggerAudioDownload } from '../utils/clientAudio';

interface AudioPlayerBarProps {
  audioUrl: string | null;
  audioBase64?: string | null;
  sampleRate?: SampleRate;
  title?: string;
  subtitle?: string;
  onEnded?: () => void;
  onSaveToLibrary?: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  audioUrl,
  audioBase64,
  sampleRate = 24000,
  title = 'TTS Audio Stream',
  subtitle,
  onEnded,
  onSaveToLibrary,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isTranscoding, setIsTranscoding] = useState(false);

  // Audio decoded samples for waveform rendering
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

  // Load and decode waveform whenever audioUrl changes
  useEffect(() => {
    if (!audioUrl) {
      setWaveformPeaks([]);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const fetchAndDecode = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuf = await response.arrayBuffer();
        const decoded = decodeWav(arrayBuf);
        const samples = decoded.monoSamples;
        
        // Downsample to 120 visual peak bars
        const barCount = 96;
        const blockSize = Math.floor(samples.length / barCount) || 1;
        const peaks: number[] = [];
        for (let i = 0; i < barCount; i++) {
          const start = i * blockSize;
          let max = 0;
          for (let j = 0; j < blockSize && start + j < samples.length; j++) {
            const val = Math.abs(samples[start + j]);
            if (val > max) max = val;
          }
          peaks.push(Math.min(1.0, max * 1.3)); // Slight boost for visibility
        }
        setWaveformPeaks(peaks);
      } catch (err) {
        // Fallback default waveform
        const dummy = Array.from({ length: 96 }, (_, i) =>
          Math.sin(i * 0.15) * 0.4 + 0.5 + Math.random() * 0.2
        );
        setWaveformPeaks(dummy);
      }
    };

    fetchAndDecode();
  }, [audioUrl]);

  // Audio element listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      audio.playbackRate = playbackRate;
      audio.volume = isMuted ? 0 : volume;
      audio.loop = isLooping;
    };
    const handleAudioEnded = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleAudioEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleAudioEnded);
    };
  }, [audioUrl, isLooping, isMuted, onEnded, playbackRate, volume]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = pct * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleRestart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(console.error);
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : val;
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) {
      audioRef.current.volume = newMuted ? 0 : volume;
    }
  };

  const toggleLoop = () => {
    const newLoop = !isLooping;
    setIsLooping(newLoop);
    if (audioRef.current) {
      audioRef.current.loop = newLoop;
    }
  };

  // Transcode and download
  const handleExportSampleRate = async (targetRate: SampleRate) => {
    if (!audioUrl) return;
    setIsTranscoding(true);
    try {
      const response = await fetch(audioUrl);
      const arrayBuf = await response.arrayBuffer();
      const decoded = decodeWav(arrayBuf);

      const resampled = resampleAudioBuffer(decoded.monoSamples, decoded.sampleRate, targetRate);
      const outBuffer = encode16BitMonoWav(resampled, targetRate);
      const blob = new Blob([outBuffer], { type: 'audio/wav' });

      const safeTitle = (title || 'tts_export').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
      triggerAudioDownload(blob, `${safeTitle}_${targetRate}hz_16bit_mono.wav`);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsTranscoding(false);
      setShowExportMenu(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const getSampleRateBadge = (rate: SampleRate | number = 24000) => {
    switch (rate) {
      case 8000:
        return {
          label: '8 kHz Telephony / PSTN',
          desc: 'IVR / Asterisk PBX',
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          dot: 'bg-amber-500',
        };
      case 16000:
        return {
          label: '16 kHz AI & VoIP',
          desc: 'Whisper / SIP Audio',
          bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
          dot: 'bg-cyan-500',
        };
      case 24000:
      default:
        return {
          label: '24 kHz Studio HD',
          desc: 'Full-Bandwidth Neural',
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          dot: 'bg-emerald-500',
        };
    }
  };

  const currentBadge = getSampleRateBadge(sampleRate);

  if (!audioUrl) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0A0A0E]/95 backdrop-blur-xl border-t border-slate-200 dark:border-[#1F1F28] text-slate-500 dark:text-slate-400 px-4 py-3 shadow-[0_-8px_25px_rgba(0,0,0,0.3)] transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#181822] flex items-center justify-center text-indigo-500 border border-slate-200/60 dark:border-[#262634]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">Audio Synthesis Engine Ready</p>
              <p className="text-slate-500 dark:text-slate-400">Generate speech above or upload an audio file to inspect & resample</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#14141A] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#22222E] font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              24 kHz Native
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#14141A] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#22222E] font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
              16 kHz VoIP/AI
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#14141A] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#22222E] font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              8 kHz Telephony
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="persistent-audio-player"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0A0A0E]/95 backdrop-blur-xl border-t border-slate-200 dark:border-[#1F1F28] text-slate-900 dark:text-slate-100 px-4 py-3 shadow-[0_-10px_35px_rgba(0,0,0,0.5)] transition-all"
    >
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      <div className="max-w-7xl mx-auto space-y-2">
        {/* Main Bar Top: Title, Meta, Waveform, Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left Info */}
          <div className="flex items-center gap-3 min-w-[220px]">
            <button
              id="player-play-toggle-btn"
              onClick={togglePlay}
              className="w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/30 transition-all shrink-0 active:scale-95"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 dark:text-white truncate tracking-tight">{title}</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border font-mono ${currentBadge.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${currentBadge.dot}`}></span>
                  {sampleRate / 1000} kHz
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {subtitle || `${currentBadge.label} • 16-bit Mono PCM WAV`}
              </p>
            </div>
          </div>

          {/* Interactive Waveform Visualizer & Scrub Track */}
          <div className="flex-1 max-w-2xl px-2">
            <div
              id="waveform-scrub-area"
              onClick={handleSeek}
              className="relative h-10 w-full bg-slate-50 dark:bg-[#060608] rounded-xl p-1.5 flex items-center gap-[2px] cursor-pointer group border border-slate-200 dark:border-[#1F1F28] hover:border-slate-300 dark:hover:border-[#2E2E3C] transition-colors"
            >
              {/* Dynamic Waveform Bars */}
              {waveformPeaks.length > 0 ? (
                waveformPeaks.map((peak, idx) => {
                  const barProgress = (idx / waveformPeaks.length) * 100;
                  const isPassed = barProgress <= progressPercent;
                  const heightPct = Math.max(12, Math.round(peak * 100));

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex items-center justify-center h-full"
                    >
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[4px] rounded-full transition-all duration-75 ${
                          isPassed
                            ? 'bg-indigo-500 group-hover:bg-indigo-400'
                            : 'bg-slate-300 dark:bg-[#20202A] group-hover:bg-slate-400 dark:group-hover:bg-[#2A2A38]'
                        }`}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="w-full h-1 bg-slate-200 dark:bg-[#181822] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              {/* Playhead Indicator Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-indigo-400 dark:bg-white shadow-[0_0_8px_rgba(99,102,241,0.8)] pointer-events-none transition-all duration-75"
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            {/* Time Stamp */}
            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 px-1 mt-1 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-400 dark:text-slate-500">
                {formatTime(duration)} ({duration > 0 ? `${(duration).toFixed(1)}s` : '0s'})
              </span>
            </div>
          </div>

          {/* Right Controls: Restart, Loop, Speed, Volume, Export */}
          <div className="flex items-center gap-2 justify-end">
            <button
              id="player-restart-btn"
              onClick={handleRestart}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#181822] transition-colors"
              title="Replay from start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              id="player-loop-btn"
              onClick={toggleLoop}
              className={`p-2 rounded-xl transition-colors ${
                isLooping
                  ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/30'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#181822]'
              }`}
              title={isLooping ? 'Looping enabled' : 'Enable repeat loop'}
            >
              <Repeat className="w-4 h-4" />
            </button>

            {/* Speed Control Pill */}
            <div className="flex items-center bg-slate-100 dark:bg-[#111116] border border-slate-200 dark:border-[#22222E] rounded-xl p-0.5 text-xs font-mono">
              {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleSpeedChange(rate)}
                  className={`px-1.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    playbackRate === rate
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="hidden sm:flex items-center gap-1.5 pl-1">
              <button
                onClick={toggleMute}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-slate-300 dark:bg-[#262634] rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Save to Library Button */}
            {onSaveToLibrary && (
              <button
                id="save-current-audio-to-library-btn"
                onClick={onSaveToLibrary}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-[#262634] font-medium text-xs shadow-sm transition-all active:scale-95"
                title="Save current playback audio to Clip Library"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Save Clip</span>
              </button>
            )}

            {/* Export / Transcode Dropdown */}
            <div className="relative">
              <button
                id="export-audio-dropdown-btn"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/25 ring-1 ring-indigo-400/30 transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export WAV</span>
                <ChevronUp
                  className={`w-3.5 h-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showExportMenu && (
                <div
                  id="export-dropdown-menu"
                  className="absolute bottom-full right-0 mb-2 w-64 bg-white dark:bg-[#111116] border border-slate-200 dark:border-[#262634] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 px-2 py-1 uppercase tracking-wider font-mono">
                    Download / Transcode Sample Rate
                  </p>

                  <button
                    onClick={() => handleExportSampleRate(24000)}
                    disabled={isTranscoding}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#181822] flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 transition-colors group"
                  >
                    <div>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">24 kHz WAV (24,000 Hz)</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Studio Master HD Audio (16-bit Mono)</p>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                      48 kB/s
                    </span>
                  </button>

                  <button
                    onClick={() => handleExportSampleRate(16000)}
                    disabled={isTranscoding}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#181822] flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 transition-colors group mt-1"
                  >
                    <div>
                      <p className="font-semibold text-cyan-600 dark:text-cyan-400">16 kHz WAV (16,000 Hz)</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">AI Speech, Whisper, VoIP & SIP</p>
                    </div>
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20 font-mono">
                      32 kB/s
                    </span>
                  </button>

                  <button
                    onClick={() => handleExportSampleRate(8000)}
                    disabled={isTranscoding}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#181822] flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 transition-colors group mt-1"
                  >
                    <div>
                      <p className="font-semibold text-amber-600 dark:text-amber-400">8 kHz WAV (8,000 Hz)</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Telephony IVR, Asterisk PBX, PSTN</p>
                    </div>
                    <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">
                      16 kB/s
                    </span>
                  </button>

                  {isTranscoding && (
                    <div className="p-2 text-center text-xs text-indigo-500 dark:text-indigo-400 animate-pulse">
                      Resampling audio buffer with anti-aliasing filter...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
