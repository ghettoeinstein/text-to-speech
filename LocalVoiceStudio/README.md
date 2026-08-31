# ForgeOS Voice Studio

Native SwiftUI frontend for private, offline Kokoro speech synthesis on Apple
Silicon. The current build is a functional v1 foundation for the attached PRD.

## Included now

- Native SwiftUI editor with autosaved recording history
- Nine factory Kokoro voices
- Voice speed and paragraph-pause controls
- 24 kHz studio master generation
- 8 kHz linear PCM, G.711 mu-law, G.711 a-law, and 16 kHz HD presets
- Automatic playback, recent-recording library, Finder reveal, and export
- Local model health detection and configurable model folder
- No telemetry, API keys, or network calls during synthesis
- Ad-hoc-signed macOS application bundle

## Build

```sh
./build-app.sh
```

The app bundle is created at `../ForgeOS Voice Studio.app`.

## PRD roadmap not yet represented as complete

- Native CoreML/Metal inference replacing the local Python/ONNX bridge
- App Sandbox distribution profile and bundled model/G2P runtime
- Per-punctuation timing controls and pronunciation-tag parser
- Dual-voice embedding interpolation and saved blend profiles
- Multi-actor scripts and CSV batch queue
- Waveform editor, scrub regions, and live telephony preview
- vDSP filtering, silence trim, LUFS normalization, G.722, AAC, and MP3
- SwiftData draft autosave, performance profiling, notarization, and DMG packaging
