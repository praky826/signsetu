"""One-time maintenance script: re-encode cached CISLR clips to H.264/AAC.

The raw clips under assets/cislr/clips/ (as downloaded from Hugging Face)
are encoded in mpeg4 (DivX-style) video, which Chrome's <video> element
cannot decode - confirmed via ffprobe and a real browser test showing a
black output box despite the backend correctly serving the file. Chrome
supports H.264, so every clip prototype.csv actually references is
re-encoded here into a separate output directory - the raw originals under
clips/ are never modified or deleted.

Resumable: already-transcoded output files are skipped, so this can be
safely re-run or interrupted and restarted.

Usage: python scripts/transcode_cislr_clips.py
"""

import csv
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SOURCE_DIR = BASE_DIR / "assets" / "cislr" / "clips"
OUTPUT_DIR = BASE_DIR / "assets" / "cislr" / "clips_h264"
DATASET_PATH = BASE_DIR / "assets" / "cislr" / "prototype.csv"


def needed_uids() -> list[str]:
    uids = []
    with open(DATASET_PATH, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            uid = row["uid"].strip()
            gloss = row["gloss"].strip()
            if uid and gloss:
                uids.append(uid)
    return uids


def transcode_one(uid: str) -> str:
    src = SOURCE_DIR / f"{uid}.mp4"
    dst = OUTPUT_DIR / f"{uid}.mp4"
    if not src.exists():
        return "missing"
    if dst.exists():
        return "skipped"

    result = subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(src),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-movflags", "+faststart",
            str(dst),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        dst.unlink(missing_ok=True)
        print(f"FAILED {uid}: {result.stderr.strip()[:300]}", file=sys.stderr)
        return "failed"
    return "ok"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    uids = needed_uids()
    counts = {"ok": 0, "skipped": 0, "missing": 0, "failed": 0}

    for i, uid in enumerate(uids, 1):
        status = transcode_one(uid)
        counts[status] += 1
        if i % 200 == 0 or i == len(uids):
            print(f"[{i}/{len(uids)}] ok={counts['ok']} skipped={counts['skipped']} "
                  f"missing={counts['missing']} failed={counts['failed']}", flush=True)

    print("done:", counts)


if __name__ == "__main__":
    main()
