# ForgeOS Voice Studio

A private text-to-speech studio for macOS. Write a script, generate a voice,
ship it. Everything runs on your machine — no accounts, no API keys, no
network calls at synthesis time.

Software should do one thing and get out of your way. This does: turn text
into a phone-ready recording, fast, with nothing leaving your Mac.

## Why local

Cloud TTS means your call scripts sit on someone else's server, metered by
usage, gated by an API key you didn't ask for. That's a rent you don't need
to pay for a solved problem. Kokoro and Whisper run fine on Apple Silicon —
so the models live on disk, the compute happens here, and the only thing
that leaves this machine is the file you choose to export.

## What it does

- **Write or import.** Type a script, or drop in an existing recording and
  get a locally-transcribed, fully editable transcript back.
- **Generate.** Nine Kokoro voices, speed control, natural paragraph pauses,
  lead-in/lead-out silence so phone systems don't clip the first word, gain
  and presence controls for a cleaner, less muffled voice.
- **Remix.** Every recording keeps its transcript and settings. Pull any
  past recording back into the editor, tweak it, regenerate.
- **Export for the phone.** Studio master plus 8 kHz PCM, G.711 µ-law/a-law,
  and 16 kHz HD presets — pick whatever your PBX actually wants.
- **Play it back properly.** Scrubbable playback, a real recordings library,
  Finder reveal, one-click export.
- **Swap the engine.** Local Kokoro by default. Point it at a running
  [VoiceStudio](https://github.com/debpalash/VoiceStudio) instance instead,
  and it speaks OpenAI-compatible REST underneath — same UI, different
  backend.

## How it's built

A native SwiftUI app ([`LocalVoiceStudio/`](LocalVoiceStudio)) drives a small
local Python bridge ([`local-kokoro/`](local-kokoro)) that wraps
[Kokoro](https://github.com/thewh1teagle/kokoro-onnx) for synthesis and
[Whisper](https://github.com/openai/whisper) for transcription. No servers,
no daemons — the app shells out to a script, gets a file back.

```
LocalVoiceStudio/   SwiftUI app (Package.swift, Sources/)
local-kokoro/        generate.py, transcribe.py — the synthesis bridge
Recordings/           your output, never committed
```

## Setup

```sh
cd local-kokoro
python3 -m venv .venv
.venv/bin/pip install kokoro-onnx soundfile numpy openai-whisper
```

Download `kokoro-v1.0.int8.onnx` and `voices-v1.0.bin` from the
[kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx) into
`local-kokoro/`.

```sh
cd LocalVoiceStudio
./build-app.sh
```

Open the resulting `ForgeOS Voice Studio.app`.

## Requirements

- macOS on Apple Silicon
- Python 3.10+
- Xcode command line tools

## Principles

- **Local first.** The default path never touches the network. Anything
  that does (like the VoiceStudio backend) is an explicit, visible switch.
- **Files, not lock-in.** Every recording is a plain WAV on disk. No
  database you can't read, no format you can't open elsewhere.
- **Edit the source, not the output.** Transcripts are the source of truth.
  Fix the words, regenerate the audio — don't patch a waveform.
- **Small surface.** One app, one job. No dashboard, no plugin system, no
  settings you'll never touch.

## Roadmap

- Native CoreML/Metal inference, replacing the Python/ONNX bridge
- App Sandbox distribution, bundled model + G2P runtime, notarized DMG
- Per-punctuation timing and a pronunciation-tag parser
- Dual-voice interpolation and saved blend profiles
- Multi-actor scripts, CSV batch queue
- Waveform editor with scrub regions and live telephony preview
- Silence trim, LUFS normalization, G.722/AAC/MP3 export
