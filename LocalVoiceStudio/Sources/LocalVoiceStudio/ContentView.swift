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
                        RecordingRow(recording: recording)
                            .tag(recording.id)
                            .contextMenu {
                                Button("Play Master") { studio.select(recording); studio.play(url: recording.masterURL) }
                                if let phone = recording.phoneURL {
                                    Button("Play Phone Version") { studio.select(recording, preferPhone: true); studio.play(url: phone) }
                                }
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
                Text("\(studio.wordCount) words · about \(studio.estimatedSeconds) sec")
                    .font(.caption).foregroundStyle(.secondary)
                Menu {
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
        .frame(height: 72)
        .background(.bar)
    }
}

private struct RecordingRow: View {
    let recording: Recording
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(recording.title).font(.subheadline.weight(.medium)).lineLimit(1)
            HStack {
                Text(recording.voiceName)
                Text("·")
                Text(recording.createdAt, style: .relative)
                if recording.phonePath != nil { Image(systemName: "phone.fill").font(.caption2) }
            }
            .font(.caption).foregroundStyle(.secondary)
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
