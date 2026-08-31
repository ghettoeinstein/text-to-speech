import argparse
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


BASE = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate speech locally with Kokoro ONNX")
    parser.add_argument("--source", type=Path, default=BASE.parent / "ussa-call-menu.txt")
    parser.add_argument("--output", type=Path, default=BASE.parent / "kokoro-output.wav")
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--speed", type=float, default=0.94)
    parser.add_argument("--pause", type=float, default=0.72)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model = Kokoro(
        str(BASE / "kokoro-v1.0.int8.onnx"),
        str(BASE / "voices-v1.0.bin"),
    )
    paragraphs = [part.strip() for part in args.source.read_text().split("\n\n") if part.strip()]
    if not paragraphs:
        raise ValueError("The source text is empty")
    rendered: list[np.ndarray] = []
    sample_rate = 24000

    for index, paragraph in enumerate(paragraphs):
        samples, sample_rate = model.create(
            paragraph,
            voice=args.voice,
            speed=args.speed,
            lang="en-us",
        )
        rendered.append(samples)
        if index < len(paragraphs) - 1:
            rendered.append(np.zeros(int(sample_rate * args.pause), dtype=np.float32))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.output, np.concatenate(rendered), sample_rate, subtype="PCM_16")
    print(f"Created {args.output} with voice {args.voice}")


if __name__ == "__main__":
    main()
