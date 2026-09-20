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
    parser.add_argument("--lead-in", type=float, default=0.6, help="Seconds of silence before the audio starts")
    parser.add_argument("--lead-out", type=float, default=0.4, help="Seconds of silence after the audio ends")
    parser.add_argument("--gain", type=float, default=4.0, help="Extra gain in dB applied after normalization")
    parser.add_argument("--presence", type=float, default=0.18, help="High-shelf boost (0-0.5) to cut through muffled tone")
    return parser.parse_args()


def apply_presence(samples: np.ndarray, amount: float) -> np.ndarray:
    """Simple pre-emphasis high-shelf filter: boosts high frequencies to reduce a muffled/dull tone."""
    if amount <= 0:
        return samples
    emphasized = np.empty_like(samples)
    emphasized[0] = samples[0]
    emphasized[1:] = samples[1:] + amount * (samples[1:] - samples[:-1])
    return emphasized


def normalize_and_boost(samples: np.ndarray, gain_db: float, target_peak: float = 0.97) -> np.ndarray:
    peak = np.max(np.abs(samples))
    if peak > 0:
        samples = samples * (target_peak / peak)
    gain_linear = 10 ** (gain_db / 20)
    samples = samples * gain_linear
    return np.tanh(samples) if np.max(np.abs(samples)) > 1.0 else samples


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

    audio = np.concatenate(rendered)
    audio = apply_presence(audio, args.presence)
    audio = normalize_and_boost(audio, args.gain)

    lead_in = [np.zeros(int(sample_rate * args.lead_in), dtype=np.float32)] if args.lead_in > 0 else []
    lead_out = [np.zeros(int(sample_rate * args.lead_out), dtype=np.float32)] if args.lead_out > 0 else []
    audio = np.concatenate(lead_in + [audio] + lead_out)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.output, audio, sample_rate, subtype="PCM_16")
    print(f"Created {args.output} with voice {args.voice}")


if __name__ == "__main__":
    main()
