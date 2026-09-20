import argparse
import json
from pathlib import Path

import whisper

BASE = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transcribe an audio file locally with Whisper")
    parser.add_argument("--source", type=Path, required=True, help="Path to the audio file (wav, mp3, m4a, etc.)")
    parser.add_argument("--model", default="base.en", help="Whisper model size, e.g. tiny.en, base.en, small.en")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model = whisper.load_model(args.model)
    result = model.transcribe(str(args.source))
    print(json.dumps({"text": result["text"].strip()}))


if __name__ == "__main__":
    main()
