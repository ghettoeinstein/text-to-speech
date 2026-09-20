import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var studio: StudioViewModel
    @State private var selectedRecordingID: Recording.ID?

    var body: some View {
        NavigationSplitView {
            sidebar
                .navigationSplitViewColumnWidth(min: 230, ideal: 270, max: 330)
        } detail: {
            VStack(spacing: 0) {
                header
                Divider()
                ScrollView {
                    VStack(spacing: 18) {
                        backendCard
                        modelStatus
                        scriptCard
                        controlsCard
                    }
                    .padding(24)
                }
                Divider()
                playerBar
            }
            .background(Color(nsColor: .windowBackgroundColor))
        }
        .alert("Local Voice Studio", isPresented: Binding(
            get: { studio.errorMessage != nil },
            set: { if !$0 { studio.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { studio.errorMessage = nil }
        } message: {
            Text(studio.errorMessage ?? "Unknown error")
        }
    }

    private var sidebar: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("LOCAL VOICE")
                        .font(.caption2.weight(.bold))
                        .tracking(1.8)
                        .foregroundStyle(.secondary)
                    Text("Recordings")
                        .font(.title2.weight(.semibold))
                }
                Spacer()
                Button(action: studio.newScript) { Image(systemName: "square.and.pencil") }
                    .buttonStyle(.borderless)
                    .help("New script")
            }
            .padding(18)

            if studio.recordings.isEmpty {
                ContentUnavailableView("No recordings yet", systemImage: "waveform", description: Text("Generated audio will appear here."))
            } else {
                List(selection: $selectedRecordingID) {
                    ForEach(studio.recordings) { recording in
                        RecordingRow(recording: recording, onRemix: { studio.remix(recording) })
                            .tag(recording.id)
                            .contextMenu {
                                Button("Play Master") { studio.select(recording); studio.play(url: recording.masterURL) }
                                if let phone = recording.phoneURL {
                                    Button("Play Phone Version") { studio.select(recording, preferPhone: true); studio.play(url: phone) }
                                }
                                Divider()
                                Button("Remix (load transcript + settings)") { studio.remix(recording) }
                                Button("Copy Transcript") { studio.copyTranscript(recording) }
                                Divider()
                                Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting([recording.masterURL]) }
                                Button("Delete", role: .destructive) { studio.delete(recording) }
                            }
                    }
                }
                .onChange(of: selectedRecordingID) { _, id in
                    if let id, let recording = studio.recordings.first(where: { $0.id == id }) { studio.select(recording) }
                }
            }

            Divider()
            HStack(spacing: 8) {
                Circle().fill(studio.modelReady ? .green : .orange).frame(width: 8, height: 8)
                Text(studio.modelReady ? "Kokoro ready · Offline" : "Model needs attention")
                    .font(.caption)
                Spacer()
            }
            .padding(14)
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            Image(systemName: "waveform.badge.mic")
                .font(.system(size: 23, weight: .medium))
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 1) {
                Text("ForgeOS Voice Studio").font(.headline)
                Text("Natural speech, generated privately on this Mac").font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(studio.statusMessage).font(.caption).foregroundStyle(.secondary).lineLimit(1)
        }
        .padding(.horizontal, 22)
        .frame(height: 64)
        .background(.bar)
    }

    private var backendCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Speech Backend", systemImage: "cpu").font(.headline)
                Spacer()
                Picker("", selection: Binding(
                    get: { studio.backend },
                    set: { studio.setBackend($0) }
                )) {
                    ForEach(SpeechBackend.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .frame(width: 280)
            }
            if studio.backend == .voiceStudio {
                HStack(spacing: 10) {
                    Circle().fill(studio.voiceStudioReachable ? .green : .red).frame(width: 8, height: 8)
                    Text(studio.voiceStudioReachable ? "VoiceStudio reachable" : "VoiceStudio not reachable — is it running?")
                        .font(.caption).foregroundStyle(.secondary)
                    TextField("http://localhost:3900", text: Binding(
                        get: { studio.voiceStudioURLString },
                        set: { studio.updateVoiceStudioURL($0) }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 220)
                    .font(.caption)
                    Button("Check Again") { Task { await studio.refreshVoiceStudioStatus() } }
                        .controlSize(.small)
                    Spacer()
                }
            }
        }
        .cardStyle()
    }

    private var modelStatus: some View {
        Group {
            if !studio.modelReady {
                HStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                    VStack(alignment: .leading) {
                        Text("Kokoro model not found").font(.headline)
                        Text(studio.modelDirectory.path).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer()
                    Button("Choose Folder…") { studio.chooseModelDirectory() }
                }
                .padding(14)
                .background(.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private var scriptCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("Script", systemImage: "text.alignleft").font(.headline)
                Spacer()
                if studio.isTranscribing {
                    ProgressView().controlSize(.small)
                    Text("Transcribing…").font(.caption).foregroundStyle(.secondary)
                } else {
                    Text("\(studio.wordCount) words · about \(studio.estimatedSeconds) sec")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Button {
                    studio.importAudio()
                } label: {
                    Label("Import Audio…", systemImage: "waveform.badge.magnifyingglass")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(!studio.transcriptionReady || studio.isTranscribing)
                .help(studio.transcriptionReady
                      ? "Upload a WAV/MP3 and transcribe it locally into an editable script"
                      : "transcribe.py or the local Python environment is missing")
                Menu {
                    Button("Import Audio & Transcribe…") { studio.importAudio() }
                        .disabled(!studio.transcriptionReady || studio.isTranscribing)
                    Divider()
                    Button("Restore USSA call menu") { studio.restoreStarterScript() }
                    Button("Clear") { studio.script = "" }
                } label: { Image(systemName: "ellipsis.circle") }
                .menuStyle(.borderlessButton)
            }
            TextField("Recording title", text: $studio.title)
                .textFieldStyle(.roundedBorder)
                .font(.title3.weight(.medium))
            TextEditor(text: $studio.script)
                .font(.system(size: 15, design: .rounded))
                .scrollContentBackground(.hidden)
                .padding(10)
                .frame(minHeight: 280)
                .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(.quaternary))
            Text("Tip: leave a blank line between menu options to create a natural pause.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .cardStyle()
    }

    private var controlsCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            Label("Voice & Output", systemImage: "slider.horizontal.3").font(.headline)
            HStack(alignment: .top, spacing: 26) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("VOICE").controlLabel()
                    Picker("Voice", selection: $studio.selectedVoiceID) {
                        ForEach(studio.voices) { voice in
                            Text("\(voice.name) — \(voice.description)").tag(voice.id)
                        }
                    }
                    .labelsHidden()
                    .frame(maxWidth: .infinity)
                }
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text("SPEED").controlLabel(); Spacer(); Text(String(format: "%.2f×", studio.speed)).monospacedDigit().font(.caption) }
                    Slider(value: $studio.speed, in: 0.75...1.25, step: 0.01)
                }
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text("PAUSE").controlLabel(); Spacer(); Text(String(format: "%.1f sec", studio.paragraphPause)).monospacedDigit().font(.caption) }
                    Slider(value: $studio.paragraphPause, in: 0.2...1.8, step: 0.1)
                }
            }
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text("LEAD-IN SILENCE").controlLabel(); Spacer(); Text(String(format: "%.1f sec", studio.leadInPause)).monospacedDigit().font(.caption) }
                    Slider(value: $studio.leadInPause, in: 0.0...2.0, step: 0.1)
                }
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text("LEAD-OUT SILENCE").controlLabel(); Spacer(); Text(String(format: "%.1f sec", studio.leadOutPause)).monospacedDigit().font(.caption) }
                    Slider(value: $studio.leadOutPause, in: 0.0...2.0, step: 0.1)
                }
            }
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text("GAIN").controlLabel(); Spacer(); Text(String(format: "%.1f dB", studio.gainDB)).monospacedDigit().font(.caption) }
                    Slider(value: $studio.gainDB, in: 0.0...10.0, step: 0.5)
                }
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text("PRESENCE").controlLabel(); Spacer(); Text(String(format: "%.2f", studio.presence)).monospacedDigit().font(.caption) }
                    Slider(value: $studio.presence, in: 0.0...0.5, step: 0.02)
                }
            }
            HStack {
                Picker("Output preset", selection: $studio.outputMode) {
                    ForEach(OutputMode.allCases) { mode in Text(mode.rawValue).tag(mode) }
                }
                .frame(maxWidth: 230)
                Spacer()
                Button {
                    studio.generate()
                } label: {
                    HStack(spacing: 8) {
                        if studio.isGenerating { ProgressView().controlSize(.small) }
                        Image(systemName: "waveform.badge.plus")
                        Text(studio.isGenerating ? "Generating…" : "Generate Speech")
                    }
                    .frame(minWidth: 150)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!studio.canGenerate)
                .keyboardShortcut(.return, modifiers: [.command])
            }
        }
        .cardStyle()
    }

    private var playerBar: some View {
        VStack(spacing: 4) {
            HStack(spacing: 8) {
                Text(formatTime(studio.playbackTime))
                    .font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                    .frame(width: 40, alignment: .trailing)
                Slider(
                    value: Binding(
                        get: { studio.playbackTime },
                        set: { studio.seek(to: $0) }
                    ),
                    in: 0...max(studio.playbackDuration, 0.01)
                )
                .disabled(studio.currentAudioURL == nil || studio.playbackDuration <= 0)
                Text(formatTime(studio.playbackDuration))
                    .font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                    .frame(width: 40, alignment: .leading)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            HStack(spacing: 12) {
                Button(action: studio.togglePlayback) {
                    Image(systemName: studio.isPlaying ? "pause.fill" : "play.fill").frame(width: 18)
                }
                .buttonStyle(.borderedProminent)
                .disabled(studio.currentAudioURL == nil)
                Button(action: studio.stopPlayback) { Image(systemName: "stop.fill") }
                    .buttonStyle(.borderless)
                    .disabled(studio.currentAudioURL == nil)
                VStack(alignment: .leading, spacing: 2) {
                    Text(studio.currentAudioURL?.lastPathComponent ?? "No recording selected")
                        .font(.subheadline.weight(.medium)).lineLimit(1)
                    Text(studio.currentAudioURL == nil ? "Generate a recording to begin" : "Local WAV audio")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Show in Finder", systemImage: "folder") { studio.revealCurrent() }
                    .disabled(studio.currentAudioURL == nil)
                Button("Export…", systemImage: "square.and.arrow.up") { studio.exportCurrent() }
                    .disabled(studio.currentAudioURL == nil)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
        }
        .background(.bar)
    }

    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "0:00" }
        let total = Int(seconds.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

private struct RecordingRow: View {
    let recording: Recording
    var onRemix: () -> Void
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 5) {
                Text(recording.title).font(.subheadline.weight(.medium)).lineLimit(1)
                if !recording.previewText.isEmpty {
                    Text(recording.previewText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .help("Copy transcript: right-click → Copy Transcript")
                }
                HStack {
                    Text(recording.voiceName)
                    Text("·")
                    Text(recording.createdAt, style: .relative)
                    if recording.phonePath != nil { Image(systemName: "phone.fill").font(.caption2) }
                }
                .font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            Button(action: onRemix) { Image(systemName: "arrow.triangle.2.circlepath") }
                .buttonStyle(.borderless)
                .help("Load this transcript and its settings back into the editor to remix")
        }
        .padding(.vertical, 5)
    }
}

private struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(18)
            .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(.quaternary))
    }
}

private extension View {
    func cardStyle() -> some View { modifier(CardModifier()) }
    func controlLabel() -> some View { font(.caption2.weight(.bold)).tracking(1.2).foregroundStyle(.secondary) }
}
