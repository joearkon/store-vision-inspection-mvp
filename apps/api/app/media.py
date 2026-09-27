from __future__ import annotations

import json
import subprocess
from pathlib import Path


def probe_duration(video_path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(video_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(json.loads(result.stdout)["format"]["duration"])


def extract_frames(video_path: Path, output_dir: Path, frame_rate: float) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    pattern = output_dir / "frame_%06d.jpg"
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video_path),
            "-vf",
            f"fps={frame_rate}",
            "-q:v",
            "2",
            str(pattern),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return sorted(output_dir.glob("frame_*.jpg"))
