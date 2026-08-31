// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "LocalVoiceStudio",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "LocalVoiceStudio", targets: ["LocalVoiceStudio"])
    ],
    targets: [
        .executableTarget(name: "LocalVoiceStudio")
    ],
    swiftLanguageModes: [.v5]
)
