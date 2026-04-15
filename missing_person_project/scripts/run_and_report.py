#!/usr/bin/env python
"""Run detection headless and print a one-line result summary."""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
LOG_FILE = PROJECT_ROOT / "output" / "logs" / "detections.txt"


def _to_min_sec(video_time: str) -> str:
    parts = video_time.strip().split(":")
    if len(parts) != 3:
        return video_time

    try:
        hh, mm, ss = [int(p) for p in parts]
    except ValueError:
        return video_time

    total_seconds = (hh * 3600) + (mm * 60) + ss
    mins = total_seconds // 60
    secs = total_seconds % 60
    return f"{mins}:{secs:02d}"


def _parse_alerts() -> list[dict[str, str]]:
    if not LOG_FILE.exists():
        return []

    alerts: list[dict[str, str]] = []
    for line in LOG_FILE.read_text(encoding="utf-8").splitlines():
        if not line.startswith("ALERT"):
            continue

        camera_match = re.search(r"\|\s*(CAM-\d+)\s*\|", line)
        video_match = re.search(r"VIDEO_TIME=([^|]+)", line)
        score_match = re.search(r"SCORE=([^|]+)", line)

        alerts.append(
            {
                "camera": camera_match.group(1).strip() if camera_match else "UNKNOWN",
                "video_time": video_match.group(1).strip() if video_match else "00:00:00",
                "score": score_match.group(1).strip() if score_match else "0.000",
            }
        )

    return alerts


def _best_cam1_or_first(alerts: list[dict[str, str]]) -> dict[str, str] | None:
    if not alerts:
        return None

    cam1_alerts = [a for a in alerts if a.get("camera") == "CAM-1"]
    if cam1_alerts:
        return sorted(cam1_alerts, key=lambda x: x.get("video_time", "99:99:99"))[0]

    return sorted(alerts, key=lambda x: x.get("video_time", "99:99:99"))[0]


def _run_detection() -> int:
    env = os.environ.copy()

    # Reliable defaults for scripted runs; can be overridden before command execution.
    env.setdefault("MP_SHOW_WINDOWS", "0")
    env.setdefault("MP_USE_MULTITHREADING", "0")
    env.setdefault("MP_MODEL_PREFERENCE", "hog")
    env.setdefault("MP_UPSAMPLE_TIMES", "1")
    env.setdefault("MP_PROCESS_SCALE", "0.5")
    env.setdefault("MP_STABILITY_FRAMES", "2")
    env.setdefault("MP_INITIAL_FRAME_SKIP", "1")
    env.setdefault("MP_MAX_FRAME_SKIP", "3")

    print("Running detection...")
    result = subprocess.run(
        [sys.executable, "run.py"],
        cwd=str(PROJECT_ROOT),
        env=env,
        check=False,
    )
    return int(result.returncode)


def _print_summary_from_alerts(alerts: list[dict[str, str]]) -> int:
    best = _best_cam1_or_first(alerts)

    if best is None:
        print("No confirmed detection found in the provided videos.")
        return 1

    cam = best["camera"].replace("CAM-", "cam ")
    at_time = _to_min_sec(best["video_time"])
    print(f"missing person is found in {cam} at {at_time}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run detection and print one-line result summary."
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Force a fresh detection run before printing summary.",
    )
    args = parser.parse_args()

    if not args.fresh:
        cached_alerts = _parse_alerts()
        if cached_alerts:
            return _print_summary_from_alerts(cached_alerts)

    run_code = _run_detection()

    if run_code != 0:
        print(f"Detection run failed with exit code {run_code}.")
        return run_code

    alerts = _parse_alerts()
    return _print_summary_from_alerts(alerts)


if __name__ == "__main__":
    raise SystemExit(main())
