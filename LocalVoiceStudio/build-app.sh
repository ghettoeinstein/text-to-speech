#!/bin/zsh

set -euo pipefail

project_dir="${0:A:h}"
destination="${project_dir:h}/ForgeOS Voice Studio.app"

cd "$project_dir"
swift build -c release

mkdir -p "$destination/Contents/MacOS" "$destination/Contents/Resources"
cp "$project_dir/.build/release/LocalVoiceStudio" "$destination/Contents/MacOS/LocalVoiceStudio"
cp "$project_dir/Info.plist" "$destination/Contents/Info.plist"
codesign --force --deep --sign - "$destination"

print "Built $destination"
