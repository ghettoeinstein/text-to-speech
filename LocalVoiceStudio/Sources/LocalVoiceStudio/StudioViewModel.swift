import AppKit
import AVFoundation
import Foundation

struct VoiceChoice: Identifiable, Hashable {
    let id: String
    let name: String
    let description: String
}

struct Recording: Identifiable, Codable, Hashable {
    let id: UUID
    let createdAt: Date
    let title: String
    let voiceName: String
    let masterPath: String
    let phonePath: String?
    var transcript: String?
    var voiceID: String?
    var speed: Double?
    var pause: Double?
    var leadIn: Double?
    var leadOut: Double?
    var gain: Double?
    var presence: Double?
    var outputModeRaw: String?

    var masterURL: URL { URL(fileURLWithPath: masterPath) }
    var phoneURL: URL? { phonePath.map(URL.init(fileURLWithPath:)) }

    /// The saved source-text file sits alongside the master recording (same stem, ".txt").
    var sourceURL: URL {
        let stem = masterURL.lastPathComponent.replacingOccurrences(of: "-master.wav", with: "")
        return masterURL.deletingLastPathComponent().appendingPathComponent("\(stem).txt")
    }

    var previewText: String {
        let text = transcript ?? (try? String(contentsOf: sourceURL, encoding: .utf8)) ?? ""
        let collapsed = text.replacingOccurrences(of: "\n", with: " ")
        return collapsed.count > 90 ? String(collapsed.prefix(90)) + "…" : collapsed
    }
}

enum SpeechBackend: String, CaseIterable, Identifiable {
    case localKokoro = "Local Kokoro"
    case voiceStudio = "VoiceStudio API"
    var id: String { rawValue }
}

enum OutputMode: String, CaseIterable, Identifiable {
    case master = "Studio master"
    case phone = "8 kHz PCM"
    case wideband = "16 kHz HD"
    case muLaw = "G.711 μ-law"
    case aLaw = "G.711 a-law"
    var id: String { rawValue }

    var suffix: String {
        switch self {
        case .master: "master"
        case .phone: "8khz-pcm"
        case .wideband: "16khz-hd"
        case .muLaw: "8khz-mulaw"
        case .aLaw: "8khz-alaw"
        }
    }

    var conversionArguments: [String]? {
        switch self {
        case .master: nil
        case .phone: ["--file", "WAVE", "--data", "LEI16@8000", "--channels", "1"]
        case .wideband: ["--file", "WAVE", "--data", "LEI16@16000", "--channels", "1"]
        case .muLaw: ["--file", "WAVE", "--data", "ulaw@8000", "--channels", "1"]
        case .aLaw: ["--file", "WAVE", "--data", "alaw@8000", "--channels", "1"]
        }
    }
}

@MainActor
final class StudioViewModel: ObservableObject {
    static let starterScript = """
    Hi, and thank you for calling U S S A.

    If this is a medical, mental health, or life-threatening emergency, please hang up and call nine one one immediately.

    Please listen carefully, as our menu options have changed.

    Press 1 for housing programs, including sober living, recuperative care, short-term post-housing, and transitional housing. This does not include emergency shelter housing.

    Press 2 for Molina housing navigation and case management services. This option is for people who have already been assigned a housing navigator through Molina.

    If you are calling about other case management services not previously listed, please press 3.

    If you are currently living at the emergency housing shelter and are trying to reach the front desk staff, please press 4.

    If you are calling to reach someone at four one five, nine zero six, zero eight four seven, please press 9.

    To leave a voicemail, press 0.
    """

    let voices: [VoiceChoice] = [
        .init(id: "af_heart", name: "Heart", description: "Warm, polished American female"),
        .init(id: "af_bella", name: "Bella", description: "Clear American female"),
        .init(id: "af_nicole", name: "Nicole", description: "Calm American female"),
        .init(id: "af_sarah", name: "Sarah", description: "Professional American female"),
        .init(id: "af_sky", name: "Sky", description: "Bright American female"),
        .init(id: "am_adam", name: "Adam", description: "Natural American male"),
        .init(id: "am_michael", name: "Michael", description: "Professional American male"),
        .init(id: "bf_emma", name: "Emma", description: "Natural British female"),
        .init(id: "bm_george", name: "George", description: "Natural British male")
    ]

    @Published var script = StudioViewModel.starterScript
    @Published var selectedVoiceID = "af_heart"
    @Published var speed = 0.94
    @Published var paragraphPause = 0.72
    @Published var leadInPause = 0.6
    @Published var leadOutPause = 0.4
    @Published var gainDB = 4.0
    @Published var presence = 0.18
    @Published var outputMode: OutputMode = .phone
    @Published var title = "USSA Call Menu"
    @Published var isGenerating = false
    @Published var isTranscribing = false
    @Published var statusMessage = "Ready"
    @Published var errorMessage: String?
    @Published var recordings: [Recording] = []
    @Published var currentAudioURL: URL?
    @Published var isPlaying = false
    @Published var playbackTime: Double = 0
    @Published var playbackDuration: Double = 0
    @Published var modelDirectory: URL
    @Published var backend: SpeechBackend = .localKokoro
    @Published var voiceStudioURLString = "http://localhost:3900"
    @Published var voiceStudioReachable = false

    private var player: AVAudioPlayer?
    private var playbackTimer: Timer?
    private let workspace = URL(fileURLWithPath: "/Users/emperorpierre/text-to-speech")
    private var recordingsDirectory: URL { workspace.appendingPathComponent("Recordings", isDirectory: true) }
    private var historyFile: URL { recordingsDirectory.appendingPathComponent("history.json") }

    init() {
        let saved = UserDefaults.standard.string(forKey: "modelDirectory")
        modelDirectory = saved.map(URL.init(fileURLWithPath:))
            ?? URL(fileURLWithPath: "/Users/emperorpierre/text-to-speech/local-kokoro")
        if let savedBackend = UserDefaults.standard.string(forKey: "speechBackend").flatMap(SpeechBackend.init(rawValue:)) {
            backend = savedBackend
        }
        if let savedURL = UserDefaults.standard.string(forKey: "voiceStudioURL") {
            voiceStudioURLString = savedURL
        }
        loadHistory()
        Task { await refreshVoiceStudioStatus() }
    }

    var voiceStudioBaseURL: URL? { URL(string: voiceStudioURLString) }

    func setBackend(_ newBackend: SpeechBackend) {
        backend = newBackend
        UserDefaults.standard.set(newBackend.rawValue, forKey: "speechBackend")
        if newBackend == .voiceStudio { Task { await refreshVoiceStudioStatus() } }
    }

    func updateVoiceStudioURL(_ newValue: String) {
        voiceStudioURLString = newValue
        UserDefaults.standard.set(newValue, forKey: "voiceStudioURL")
        Task { await refreshVoiceStudioStatus() }
    }

    @MainActor
    func refreshVoiceStudioStatus() async {
        guard let base = voiceStudioBaseURL else { voiceStudioReachable = false; return }
        var request = URLRequest(url: base.appendingPathComponent("v1/audio/voices"))
        request.timeoutInterval = 3
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            voiceStudioReachable = (response as? HTTPURLResponse).map { $0.statusCode < 500 } ?? false
        } catch {
            voiceStudioReachable = false
        }
    }

    var modelReady: Bool {
        let fm = FileManager.default
        return fm.fileExists(atPath: modelDirectory.appendingPathComponent("kokoro-v1.0.int8.onnx").path)
            && fm.fileExists(atPath: modelDirectory.appendingPathComponent("voices-v1.0.bin").path)
            && fm.fileExists(atPath: modelDirectory.appendingPathComponent("generate.py").path)
            && fm.isExecutableFile(atPath: modelDirectory.appendingPathComponent(".venv/bin/python").path)
    }

    var activeBackendReady: Bool { backend == .localKokoro ? modelReady : voiceStudioReachable }
    var canGenerate: Bool { activeBackendReady && !script.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isGenerating }
    var selectedVoice: VoiceChoice { voices.first { $0.id == selectedVoiceID } ?? voices[0] }
    var wordCount: Int { script.split(whereSeparator: { $0.isWhitespace }).count }
    var estimatedSeconds: Int { max(1, Int(Double(wordCount) / (150.0 * speed) * 60.0)) }

    func newScript() {
        script = ""
        title = "Untitled Greeting"
        currentAudioURL = nil
        statusMessage = "New script"
    }

    func restoreStarterScript() {
        script = Self.starterScript
        title = "USSA Call Menu"
    }

    var transcriptionReady: Bool {
        backend == .voiceStudio
            ? voiceStudioReachable
            : FileManager.default.fileExists(atPath: modelDirectory.appendingPathComponent("transcribe.py").path)
                && FileManager.default.isExecutableFile(atPath: modelDirectory.appendingPathComponent(".venv/bin/python").path)
    }

    func importAudio() {
        guard transcriptionReady, !isTranscribing else { return }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = false
        panel.prompt = "Transcribe"
        panel.allowedContentTypes = [.audio, .wav, .mp3, .mpeg4Audio]
        guard panel.runModal() == .OK, let sourceURL = panel.url else { return }

        isTranscribing = true
        errorMessage = nil
        statusMessage = "Transcribing \(sourceURL.lastPathComponent)…"
        let modelDirectory = self.modelDirectory
        let currentBackend = backend
        let voiceStudioBase = voiceStudioBaseURL

        Task {
            do {
                let text: String
                switch currentBackend {
                case .localKokoro:
                    text = try await Self.transcribe(audioURL: sourceURL, modelDirectory: modelDirectory)
                case .voiceStudio:
                    guard let base = voiceStudioBase else {
                        throw NSError(domain: "LocalVoiceStudio", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid VoiceStudio URL."])
                    }
                    text = try await Self.transcribeViaVoiceStudio(audioURL: sourceURL, baseURL: base)
                }
                script = text
                title = sourceURL.deletingPathExtension().lastPathComponent
                statusMessage = "Transcribed \(sourceURL.lastPathComponent) — edit away"
                isTranscribing = false
            } catch {
                errorMessage = error.localizedDescription
                statusMessage = "Transcription failed"
                isTranscribing = false
            }
        }
    }

    nonisolated private static func transcribeViaVoiceStudio(audioURL: URL, baseURL: URL) async throws -> String {
        var request = URLRequest(url: baseURL.appendingPathComponent("v1/audio/transcriptions"))
        request.httpMethod = "POST"
        let boundary = "----VoiceStudio-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        let audioData = try Data(contentsOf: audioURL)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(audioURL.lastPathComponent)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/octet-stream\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"response_format\"\r\n\r\n".data(using: .utf8)!)
        body.append("json\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let detail = String(data: data, encoding: .utf8) ?? "Unknown VoiceStudio error"
            throw NSError(domain: "LocalVoiceStudio", code: (response as? HTTPURLResponse)?.statusCode ?? 0, userInfo: [NSLocalizedDescriptionKey: detail])
        }
        guard let parsed = try? JSONDecoder().decode([String: String].self, from: data), let text = parsed["text"] else {
            throw NSError(domain: "LocalVoiceStudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not parse VoiceStudio transcription response."])
        }
        return text
    }

    nonisolated private static func transcribe(audioURL: URL, modelDirectory: URL) async throws -> String {
        try await Task.detached(priority: .userInitiated) {
            let process = Process()
            process.executableURL = modelDirectory.appendingPathComponent(".venv/bin/python")
            process.arguments = [
                modelDirectory.appendingPathComponent("transcribe.py").path,
                "--source", audioURL.path
            ]
            let outputPipe = Pipe()
            let errorPipe = Pipe()
            process.standardOutput = outputPipe
            process.standardError = errorPipe
            try process.run()
            process.waitUntilExit()
            if process.terminationStatus != 0 {
                let data = errorPipe.fileHandleForReading.readDataToEndOfFile()
                let detail = String(data: data, encoding: .utf8) ?? "Unknown transcription error"
                throw NSError(domain: "LocalVoiceStudio", code: Int(process.terminationStatus), userInfo: [NSLocalizedDescriptionKey: detail])
            }
            let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
            guard let lastLine = String(data: outputData, encoding: .utf8)?
                    .split(separator: "\n")
                    .last,
                  let jsonData = String(lastLine).data(using: .utf8),
                  let parsed = try? JSONDecoder().decode([String: String].self, from: jsonData),
                  let text = parsed["text"] else {
                throw NSError(domain: "LocalVoiceStudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not parse transcription output."])
            }
            return text
        }.value
    }

    func chooseModelDirectory() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.prompt = "Choose Model Folder"
        if panel.runModal() == .OK, let url = panel.url {
            modelDirectory = url
            UserDefaults.standard.set(url.path, forKey: "modelDirectory")
            statusMessage = modelReady ? "Local model ready" : "Required model files were not found"
        }
    }

    func generate() {
        guard canGenerate else { return }
        isGenerating = true
        errorMessage = nil
        statusMessage = backend == .voiceStudio
            ? "Generating via VoiceStudio with \(selectedVoice.name)…"
            : "Generating locally with \(selectedVoice.name)…"

        let script = self.script
        let voice = selectedVoice
        let speed = self.speed
        let pause = paragraphPause
        let leadIn = leadInPause
        let leadOut = leadOutPause
        let gain = gainDB
        let presence = self.presence
        let mode = outputMode
        let title = self.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Recording" : self.title
        let modelDirectory = self.modelDirectory
        let recordingsDirectory = self.recordingsDirectory
        let currentBackend = backend
        let voiceStudioBase = voiceStudioBaseURL

        Task {
            do {
                let recording: Recording
                switch currentBackend {
                case .localKokoro:
                    recording = try await Self.render(
                        script: script,
                        title: title,
                        voice: voice,
                        speed: speed,
                        pause: pause,
                        leadIn: leadIn,
                        leadOut: leadOut,
                        gain: gain,
                        presence: presence,
                        mode: mode,
                        modelDirectory: modelDirectory,
                        recordingsDirectory: recordingsDirectory
                    )
                case .voiceStudio:
                    guard let base = voiceStudioBase else {
                        throw NSError(domain: "LocalVoiceStudio", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid VoiceStudio URL."])
                    }
                    recording = try await Self.renderViaVoiceStudio(
                        script: script,
                        title: title,
                        voice: voice,
                        speed: speed,
                        mode: mode,
                        baseURL: base,
                        recordingsDirectory: recordingsDirectory
                    )
                }
                recordings.insert(recording, at: 0)
                saveHistory()
                currentAudioURL = mode == .master ? recording.masterURL : (recording.phoneURL ?? recording.masterURL)
                statusMessage = "Created \(recording.title)"
                isGenerating = false
                play(url: currentAudioURL)
            } catch {
                errorMessage = error.localizedDescription
                statusMessage = "Generation failed"
                isGenerating = false
            }
        }
    }

    nonisolated private static func render(
        script: String,
        title: String,
        voice: VoiceChoice,
        speed: Double,
        pause: Double,
        leadIn: Double,
        leadOut: Double,
        gain: Double,
        presence: Double,
        mode: OutputMode,
        modelDirectory: URL,
        recordingsDirectory: URL
    ) async throws -> Recording {
        try await Task.detached(priority: .userInitiated) {
            let fm = FileManager.default
            try fm.createDirectory(at: recordingsDirectory, withIntermediateDirectories: true)
            let id = UUID()
            let safeTitle = title.replacingOccurrences(of: "[^A-Za-z0-9_-]+", with: "-", options: .regularExpression)
                .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
            let stem = "\(safeTitle.isEmpty ? "Recording" : safeTitle)-\(id.uuidString.prefix(8))"
            let sourceURL = recordingsDirectory.appendingPathComponent("\(stem).txt")
            let masterURL = recordingsDirectory.appendingPathComponent("\(stem)-master.wav")
            let phoneURL = recordingsDirectory.appendingPathComponent("\(stem)-\(mode.suffix).wav")
            try script.write(to: sourceURL, atomically: true, encoding: .utf8)

            let process = Process()
            process.executableURL = modelDirectory.appendingPathComponent(".venv/bin/python")
            process.arguments = [
                modelDirectory.appendingPathComponent("generate.py").path,
                "--source", sourceURL.path,
                "--output", masterURL.path,
                "--voice", voice.id,
                "--speed", String(format: "%.2f", speed),
                "--pause", String(format: "%.2f", pause),
                "--lead-in", String(format: "%.2f", leadIn),
                "--lead-out", String(format: "%.2f", leadOut),
                "--gain", String(format: "%.2f", gain),
                "--presence", String(format: "%.2f", presence)
            ]
            let errorPipe = Pipe()
            process.standardError = errorPipe
            try process.run()
            process.waitUntilExit()
            if process.terminationStatus != 0 {
                let data = errorPipe.fileHandleForReading.readDataToEndOfFile()
                let detail = String(data: data, encoding: .utf8) ?? "Unknown model error"
                throw NSError(domain: "LocalVoiceStudio", code: Int(process.terminationStatus), userInfo: [NSLocalizedDescriptionKey: detail])
            }

            var finalPhonePath: String?
            if let conversionArguments = mode.conversionArguments {
                let converter = Process()
                converter.executableURL = URL(fileURLWithPath: "/usr/bin/afconvert")
                converter.arguments = conversionArguments + [masterURL.path, phoneURL.path]
                try converter.run()
                converter.waitUntilExit()
                guard converter.terminationStatus == 0 else {
                    throw NSError(domain: "LocalVoiceStudio", code: 2, userInfo: [NSLocalizedDescriptionKey: "The phone-format conversion failed."])
                }
                finalPhonePath = phoneURL.path
            }

            return Recording(
                id: id,
                createdAt: Date(),
                title: title,
                voiceName: voice.name,
                masterPath: masterURL.path,
                phonePath: finalPhonePath,
                transcript: script,
                voiceID: voice.id,
                speed: speed,
                pause: pause,
                leadIn: leadIn,
                leadOut: leadOut,
                gain: gain,
                presence: presence,
                outputModeRaw: mode.rawValue
            )
        }.value
    }

    nonisolated private static func renderViaVoiceStudio(
        script: String,
        title: String,
        voice: VoiceChoice,
        speed: Double,
        mode: OutputMode,
        baseURL: URL,
        recordingsDirectory: URL
    ) async throws -> Recording {
        let fm = FileManager.default
        try fm.createDirectory(at: recordingsDirectory, withIntermediateDirectories: true)
        let id = UUID()
        let safeTitle = title.replacingOccurrences(of: "[^A-Za-z0-9_-]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        let stem = "\(safeTitle.isEmpty ? "Recording" : safeTitle)-\(id.uuidString.prefix(8))"
        let masterURL = recordingsDirectory.appendingPathComponent("\(stem)-master.wav")
        let phoneURL = recordingsDirectory.appendingPathComponent("\(stem)-\(mode.suffix).wav")

        var request = URLRequest(url: baseURL.appendingPathComponent("v1/audio/speech"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let payload: [String: Any] = [
            "model": "tts-1",
            "input": script,
            "voice": voice.id,
            "response_format": "wav",
            "speed": speed
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let detail = String(data: data, encoding: .utf8) ?? "Unknown VoiceStudio error"
            throw NSError(domain: "LocalVoiceStudio", code: (response as? HTTPURLResponse)?.statusCode ?? 0, userInfo: [NSLocalizedDescriptionKey: detail])
        }
        try data.write(to: masterURL)

        var finalPhonePath: String?
        if let conversionArguments = mode.conversionArguments {
            let converter = Process()
            converter.executableURL = URL(fileURLWithPath: "/usr/bin/afconvert")
            converter.arguments = conversionArguments + [masterURL.path, phoneURL.path]
            try converter.run()
            converter.waitUntilExit()
            guard converter.terminationStatus == 0 else {
                throw NSError(domain: "LocalVoiceStudio", code: 2, userInfo: [NSLocalizedDescriptionKey: "The phone-format conversion failed."])
            }
            finalPhonePath = phoneURL.path
        }

        return Recording(
            id: id,
            createdAt: Date(),
            title: title,
            voiceName: voice.name,
            masterPath: masterURL.path,
            phonePath: finalPhonePath,
            transcript: script,
            voiceID: voice.id,
            speed: speed,
            pause: nil,
            leadIn: nil,
            leadOut: nil,
            gain: nil,
            presence: nil,
            outputModeRaw: mode.rawValue
        )
    }

    func select(_ recording: Recording, preferPhone: Bool = false) {
        currentAudioURL = preferPhone ? (recording.phoneURL ?? recording.masterURL) : recording.masterURL
        statusMessage = "Selected \(recording.title)"
    }

    /// Loads a past recording's transcript and generation settings back into the editor so it can be tweaked and re-rendered.
    func remix(_ recording: Recording) {
        script = recording.transcript ?? (try? String(contentsOf: recording.sourceURL, encoding: .utf8)) ?? script
        title = recording.title
        if let voiceID = recording.voiceID, voices.contains(where: { $0.id == voiceID }) {
            selectedVoiceID = voiceID
        }
        if let speed = recording.speed { self.speed = speed }
        if let pause = recording.pause { paragraphPause = pause }
        if let leadIn = recording.leadIn { leadInPause = leadIn }
        if let leadOut = recording.leadOut { leadOutPause = leadOut }
        if let gain = recording.gain { gainDB = gain }
        if let presence = recording.presence { self.presence = presence }
        if let modeRaw = recording.outputModeRaw, let mode = OutputMode(rawValue: modeRaw) { outputMode = mode }
        statusMessage = "Loaded \"\(recording.title)\" for remixing"
    }

    func copyTranscript(_ recording: Recording) {
        let text = recording.transcript ?? (try? String(contentsOf: recording.sourceURL, encoding: .utf8)) ?? ""
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
        statusMessage = "Copied transcript for \"\(recording.title)\""
    }

    func play(url: URL?) {
        guard let url else { return }
        do {
            player = try AVAudioPlayer(contentsOf: url)
            player?.play()
            isPlaying = true
            playbackDuration = player?.duration ?? 0
            playbackTime = 0
            statusMessage = "Playing \(url.lastPathComponent)"
            startPlaybackTimer()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func togglePlayback() {
        if let player, player.isPlaying {
            player.pause()
            isPlaying = false
            statusMessage = "Paused"
            stopPlaybackTimer()
        } else if let player {
            player.play()
            isPlaying = true
            statusMessage = "Playing"
            startPlaybackTimer()
        } else {
            play(url: currentAudioURL)
        }
    }

    func seek(to time: Double) {
        guard let player else { return }
        let clamped = max(0, min(time, player.duration))
        player.currentTime = clamped
        playbackTime = clamped
    }

    private func startPlaybackTimer() {
        stopPlaybackTimer()
        playbackTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let player = self.player else { return }
                self.playbackTime = player.currentTime
                if !player.isPlaying && self.isPlaying {
                    self.isPlaying = false
                    self.statusMessage = "Finished"
                    self.stopPlaybackTimer()
                }
            }
        }
    }

    private func stopPlaybackTimer() {
        playbackTimer?.invalidate()
        playbackTimer = nil
    }

    func stopPlayback() {
        player?.stop()
        isPlaying = false
        playbackTime = 0
        stopPlaybackTimer()
        statusMessage = "Stopped"
    }

    func exportCurrent() {
        guard let source = currentAudioURL else { return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = source.lastPathComponent
        panel.allowedContentTypes = [.wav]
        if panel.runModal() == .OK, let destination = panel.url {
            do {
                if FileManager.default.fileExists(atPath: destination.path) {
                    try FileManager.default.removeItem(at: destination)
                }
                try FileManager.default.copyItem(at: source, to: destination)
                statusMessage = "Exported \(destination.lastPathComponent)"
            } catch { errorMessage = error.localizedDescription }
        }
    }

    func revealCurrent() {
        if let url = currentAudioURL { NSWorkspace.shared.activateFileViewerSelecting([url]) }
    }

    func delete(_ recording: Recording) {
        if currentAudioURL == recording.masterURL || currentAudioURL == recording.phoneURL {
            stopPlayback()
            currentAudioURL = nil
        }
        try? FileManager.default.removeItem(at: recording.masterURL)
        if let phone = recording.phoneURL { try? FileManager.default.removeItem(at: phone) }
        recordings.removeAll { $0.id == recording.id }
        saveHistory()
    }

    private func loadHistory() {
        guard let data = try? Data(contentsOf: historyFile),
              let decoded = try? JSONDecoder().decode([Recording].self, from: data) else { return }
        recordings = decoded.filter { FileManager.default.fileExists(atPath: $0.masterPath) }
    }

    private func saveHistory() {
        try? FileManager.default.createDirectory(at: recordingsDirectory, withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(recordings) { try? data.write(to: historyFile, options: .atomic) }
    }
}
