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


def _time_to_seconds(time_value: str) -> int | None:
    value = time_value.strip()
    if not value:
        return None

    hhmmss = value.split(":")
    if len(hhmmss) == 3:
        try:
            hh, mm, ss = [int(p) for p in hhmmss]
        except ValueError:
            return None
        return (hh * 3600) + (mm * 60) + ss

    mmss = value.split(":")
    if len(mmss) == 2:
        try:
            mm, ss = [int(p) for p in mmss]
        except ValueError:
            return None
        return (mm * 60) + ss

    return None


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


def _pick_alert(
    alerts: list[dict[str, str]], target_camera: str, target_time: str | None
) -> dict[str, str] | None:
    if not alerts:
        return None

    camera_alerts = [a for a in alerts if a.get("camera") == target_camera]
    selected_pool = camera_alerts if camera_alerts else alerts

    if target_time:
        target_seconds = _time_to_seconds(target_time)
        if target_seconds is not None:
            with_seconds: list[tuple[int, dict[str, str]]] = []
            for alert in selected_pool:
                sec = _time_to_seconds(alert.get("video_time", ""))
                if sec is not None:
                    with_seconds.append((sec, alert))
            if with_seconds:
                return min(with_seconds, key=lambda item: abs(item[0] - target_seconds))[1]

    return sorted(selected_pool, key=lambda x: x.get("video_time", "99:99:99"))[0]


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


def _print_summary_from_alerts(
    alerts: list[dict[str, str]], target_camera: str, target_time: str | None
) -> int:
    best = _pick_alert(alerts, target_camera=target_camera, target_time=target_time)

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
    parser.add_argument(
        "--camera",
        default="CAM-1",
        help="Preferred camera in CAM-X format (default: CAM-1).",
    )
    parser.add_argument(
        "--time",
        default=None,
        help="Preferred video time (mm:ss or hh:mm:ss), e.g. 1:01.",
    )
    args = parser.parse_args()
    target_camera = args.camera.strip().upper()

    if not args.fresh:
        cached_alerts = _parse_alerts()
        if cached_alerts:
            return _print_summary_from_alerts(cached_alerts, target_camera, args.time)

    run_code = _run_detection()

    if run_code != 0:
        print(f"Detection run failed with exit code {run_code}.")
        return run_code

    alerts = _parse_alerts()
    return _print_summary_from_alerts(alerts, target_camera, args.time)


if __name__ == "__main__":
    raise SystemExit(main())
