# ForgeOS Voice Studio

A native macOS app for generating business voicemail greetings with
private, fully offline text-to-speech — no API keys, no telemetry, no
network calls at synthesis time.

It's a SwiftUI frontend ([`LocalVoiceStudio/`](LocalVoiceStudio)) that drives a
local Python bridge ([`local-kokoro/`](local-kokoro)) running
[Kokoro](https://github.com/thewh1teagle/kokoro-onnx) speech synthesis
entirely on-device on Apple Silicon.

## Features

- Nine factory Kokoro voices
- Voice speed and paragraph-pause controls
- 24 kHz studio master generation
- 8 kHz linear PCM, G.711 mu-law, G.711 a-law, and 16 kHz HD export presets
  for phone system compatibility
- Automatic playback, recent-recording library, and Finder reveal
- Unlimited local saves — recordings stay on disk, nothing is uploaded
- Local model health detection and configurable model folder
- No telemetry, API keys, or network calls during synthesis

## Setup

1. Set up the local Python environment for the Kokoro synthesis bridge,
   and download the model files into `local-kokoro/` (`kokoro-v1.0.int8.onnx`
   and `voices-v1.0.bin` from the
   [kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx)).

2. Build the native SwiftUI app:

   ```sh
   cd LocalVoiceStudio
   ./build-app.sh
   ```

   This produces `ForgeOS Voice Studio.app` in the repo root — open it to
   launch the app.

## Requirements

- macOS on Apple Silicon
- Python 3 (for the local Kokoro synthesis bridge in `local-kokoro/`)
- Xcode command line tools (to build the SwiftUI app via `build-app.sh`)

## Project layout

- `LocalVoiceStudio/` — SwiftUI app source (`Package.swift`, `Sources/`)
- `local-kokoro/` — Python/ONNX Kokoro synthesis bridge (`generate.py`);
  model files (`*.onnx`, `*.bin`) are downloaded locally and gitignored
- `Recordings/` — generated voicemail output (gitignored, kept as an
  empty folder via `.gitkeep`)

## Roadmap

- Native CoreML/Metal inference replacing the local Python/ONNX bridge
- App Sandbox distribution profile and bundled model/G2P runtime
- Per-punctuation timing controls and pronunciation-tag parser
- Dual-voice embedding interpolation and saved blend profiles
- Multi-actor scripts and CSV batch queue
- Waveform editor, scrub regions, and live telephony preview
- vDSP filtering, silence trim, LUFS normalization, G.722, AAC, and MP3
- SwiftData draft autosave, performance profiling, notarization, and DMG packaging
