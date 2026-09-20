# ForgeOS Voice Studio

A simple app that turns typed words into a spoken recording — like a
phone greeting or an answering machine message — right on this Mac.
Nothing is sent over the internet. Your words and your recordings stay
on this computer.

## How to open the app

1. Look on the **Desktop** for an icon called **ForgeOS Voice Studio**
   (it has a little microphone picture on it).
2. **Double-click** it to open.
3. The first time you open it, the Mac may show a warning that it
   doesn't recognize the app. That's normal — this app was made just
   for you, not downloaded from a store. To open it anyway:
   - Right-click (or hold Control and click) the icon
   - Choose **Open** from the menu
   - Click **Open** again to confirm

You only have to do that once. After that, double-clicking works
normally.

## How to make a recording

1. **Type or paste your words** into the big box in the middle of the
   window, where it says "Script." You can also click the pencil
   icon to clear it and start fresh, or use the menu to bring back
   the sample greeting.
2. Give it a **title** in the box above the script — this is just the
   file name it will be saved under.
3. Pick a **voice** from the dropdown list near the top (try a few —
   you can always change your mind).
4. Click the big **Generate** button.
5. Wait a few seconds. The recording will play automatically when
   it's ready.

That's it — you've made a voice recording.

## Listening back

- Every recording you make is saved in the list on the left, with the
  words shown underneath the title so you can remember what's in it.
- Click any recording in that list to select it, then use the
  **Play / Pause** button and the sliding bar at the bottom of the
  window to listen and skip around.

## Fixing or changing a recording

- Didn't like how it sounded? Click the **circular arrow icon** next
  to any past recording. This loads the words and settings back into
  the editor so you can change something and make it again.
- Want to type out something you already have as a sound file? Click
  **Import Audio…** near the top of the script box, choose the sound
  file, and the app will listen to it and type out the words for you
  to edit.

## Getting a recording off the computer

- Click **Export…** at the bottom of the window to save a copy
  anywhere you like (like a USB drive or a folder to email).
- Click **Show in Finder** to see the file sitting on your computer
  and drag it wherever you need it — for example, into your phone
  system's website.

## If something looks wrong

If the app shows an orange warning at the top saying it can't find
its voice files, ask whoever set this up for you to check — it just
means a folder or file has moved.

---

## For whoever maintains this app

The sections below are for setting the app up or rebuilding it after
a code change. Everyday use only needs the instructions above.

### What it is

A native SwiftUI app ([`LocalVoiceStudio/`](LocalVoiceStudio)) that drives a
small local Python bridge ([`local-kokoro/`](local-kokoro)) wrapping
[Kokoro](https://github.com/thewh1teagle/kokoro-onnx) for speech synthesis
and [Whisper](https://github.com/openai/whisper) for transcription. No
servers, no daemons, no accounts — the app runs a script and gets a file
back.

```
LocalVoiceStudio/   SwiftUI app (Package.swift, Sources/)
local-kokoro/        generate.py, transcribe.py — the synthesis bridge
Recordings/           output, never committed to git
```

### One-time setup

```sh
cd local-kokoro
python3 -m venv .venv
.venv/bin/pip install kokoro-onnx soundfile numpy openai-whisper
```

Download `kokoro-v1.0.int8.onnx` and `voices-v1.0.bin` from the
[kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx) into
`local-kokoro/`.

### Building the app after a code change

```sh
cd LocalVoiceStudio
swift build -c release
```

Then copy the fresh binary into the app bundle(s) and re-sign, e.g.:

```sh
BIN="LocalVoiceStudio/.build/release/LocalVoiceStudio"
APP="ForgeOS Voice Studio.app"
cp "$BIN" "$APP/Contents/MacOS/LocalVoiceStudio"
codesign --force --deep --sign - "$APP"
```

Copy that same `.app` to the Desktop (or wherever it's launched from)
so the person using it always gets the latest build.

### Requirements

- macOS on Apple Silicon
- Python 3.10+
- Xcode command line tools

### Principles

- **Local first.** The default path never touches the network. An optional
  switch can point synthesis at a running
  [VoiceStudio](https://github.com/debpalash/VoiceStudio) server instead,
  but that's opt-in and visible in the UI.
- **Files, not lock-in.** Every recording is a plain WAV on disk.
- **Edit the source, not the output.** Transcripts are the source of
  truth — fix the words, regenerate the audio.
- **Small surface.** One app, one job.

### Roadmap

- Native CoreML/Metal inference, replacing the Python/ONNX bridge
- App Sandbox distribution, bundled model + G2P runtime, notarized DMG
- Per-punctuation timing and a pronunciation-tag parser
- Dual-voice interpolation and saved blend profiles
- Multi-actor scripts, CSV batch queue
- Waveform editor with scrub regions and live telephony preview
- Silence trim, LUFS normalization, G.722/AAC/MP3 export
