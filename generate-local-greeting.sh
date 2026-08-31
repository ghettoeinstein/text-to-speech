#!/bin/zsh

set -euo pipefail

if (( $# < 2 || $# > 3 )); then
  print -u2 'Usage: ./generate-local-greeting.sh input.txt output.wav [voice]'
  exit 2
fi

input_path="$1"
output_path="$2"
voice_name="${3:-Samantha}"
temporary_audio="$(mktemp -t phone-greeting).aiff"
trap 'rm -f "$temporary_audio"' EXIT

say --voice "$voice_name" --rate 155 --output-file "$temporary_audio" --input-file "$input_path"
afconvert --file WAVE --data LEI16@8000 --channels 1 "$temporary_audio" "$output_path"

print "Created $output_path"
