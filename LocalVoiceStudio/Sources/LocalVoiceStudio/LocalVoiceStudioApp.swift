import SwiftUI

@main
struct LocalVoiceStudioApp: App {
    @StateObject private var studio = StudioViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(studio)
                .frame(minWidth: 980, minHeight: 680)
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Script") { studio.newScript() }
                    .keyboardShortcut("n")
            }
            CommandGroup(after: .saveItem) {
                Button("Generate Speech") { studio.generate() }
                    .keyboardShortcut(.return, modifiers: [.command])
                    .disabled(!studio.canGenerate)
                Button(studio.isPlaying ? "Pause" : "Play") { studio.togglePlayback() }
                    .keyboardShortcut(.space, modifiers: [])
                    .disabled(studio.currentAudioURL == nil)
            }
        }
    }
}
