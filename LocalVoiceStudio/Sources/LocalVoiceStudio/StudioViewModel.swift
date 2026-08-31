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

    var masterURL: URL { URL(fileURLWithPath: masterPath) }
    var phoneURL: URL? { phonePath.map(URL.init(fileURLWithPath:)) }
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
    @Published var outputMode: OutputMode = .phone
    @Published var title = "USSA Call Menu"
    @Published var isGenerating = false
    @Published var statusMessage = "Ready"
    @Published var errorMessage: String?
    @Published var recordings: [Recording] = []
    @Published var currentAudioURL: URL?
    @Published var isPlaying = false
    @Published var modelDirectory: URL

    private var player: AVAudioPlayer?
    private let workspace = URL(fileURLWithPath: "/Users/emperorpierre/text-to-speech")
    private var recordingsDirectory: URL { workspace.appendingPathComponent("Recordings", isDirectory: true) }
    private var historyFile: URL { recordingsDirectory.appendingPathComponent("history.json") }

    init() {
        let saved = UserDefaults.standard.string(forKey: "modelDirectory")
        modelDirectory = saved.map(URL.init(fileURLWithPath:))
            ?? URL(fileURLWithPath: "/Users/emperorpierre/text-to-speech/local-kokoro")
        loadHistory()
    }

    var modelReady: Bool {
        let fm = FileManager.default
        return fm.fileExists(atPath: modelDirectory.appendingPathComponent("kokoro-v1.0.int8.onnx").path)
            && fm.fileExists(atPath: modelDirectory.appendingPathComponent("voices-v1.0.bin").path)
            && fm.fileExists(atPath: modelDirectory.appendingPathComponent("generate.py").path)
            && fm.isExecutableFile(atPath: modelDirectory.appendingPathComponent(".venv/bin/python").path)
    }

    var canGenerate: Bool { modelReady && !script.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isGenerating }
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
        statusMessage = "Generating locally with \(selectedVoice.name)…"

        let script = self.script
        let voice = selectedVoice
        let speed = self.speed
        let pause = paragraphPause
        let mode = outputMode
        let title = self.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Recording" : self.title
        let modelDirectory = self.modelDirectory
        let recordingsDirectory = self.recordingsDirectory

        Task {
            do {
                let recording = try await Self.render(
                    script: script,
                    title: title,
                    voice: voice,
                    speed: speed,
                    pause: pause,
                    mode: mode,
                    modelDirectory: modelDirectory,
                    recordingsDirectory: recordingsDirectory
                )
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
                "--pause", String(format: "%.2f", pause)
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

            return Recording(id: id, createdAt: Date(), title: title, voiceName: voice.name, masterPath: masterURL.path, phonePath: finalPhonePath)
        }.value
    }

    func select(_ recording: Recording, preferPhone: Bool = false) {
        currentAudioURL = preferPhone ? (recording.phoneURL ?? recording.masterURL) : recording.masterURL
        statusMessage = "Selected \(recording.title)"
    }

    func play(url: URL?) {
        guard let url else { return }
        do {
            player = try AVAudioPlayer(contentsOf: url)
            player?.play()
            isPlaying = true
            statusMessage = "Playing \(url.lastPathComponent)"
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func togglePlayback() {
        if let player, player.isPlaying {
            player.pause()
            isPlaying = false
            statusMessage = "Paused"
        } else if let player {
            player.play()
            isPlaying = true
            statusMessage = "Playing"
        } else {
            play(url: currentAudioURL)
        }
    }

    func stopPlayback() {
        player?.stop()
        isPlaying = false
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
