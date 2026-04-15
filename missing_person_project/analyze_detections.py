#!/usr/bin/env python
"""
Analyze detection results and display statistics.
Shows which cameras detected the person and when.
"""

from pathlib import Path
from datetime import datetime
import sys
from collections import defaultdict

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR


def parse_log_file(log_file: Path):
    """Parse the detection log file and extract useful information."""
    
    if not log_file.exists():
        print(f"Log file not found: {log_file}")
        return None
    
    with open(log_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    detections = []
    for line in lines:
        line = line.strip()
        if not line.startswith("ALERT"):
            continue
        
        # Parse the detection line
        # Format: ALERT | CAM-1 | VIDEO_TIME=01:23:45 | EVENT_TIME=... | SCORE=... | ...
        parts = [p.strip() for p in line.split("|")]
        
        detection = {"raw": line}
        for part in parts:
            if "=" in part:
                key, value = part.split("=", 1)
                detection[key.strip()] = value.strip()
            elif part.startswith("CAM-"):
                detection["CAMERA"] = part.split()[0]
        
        detections.append(detection)
    
    return detections


def show_statistics(detections):
    """Display statistics about the detections."""
    
    if not detections:
        print("No detections found in the log.")
        return
    
    print("\n" + "=" * 80)
    print("DETECTION STATISTICS")
    print("=" * 80)
    
    # By camera
    by_camera = defaultdict(list)
    for det in detections:
        camera = det.get("CAMERA", "UNKNOWN")
        by_camera[camera].append(det)
    
    print(f"\nTotal Detections: {len(detections)}\n")
    
    for camera in sorted(by_camera.keys()):
        dets = by_camera[camera]
        scores = [float(d.get("SCORE", "0")) for d in dets if "SCORE" in d]
        
        print(f"\n{camera}:")
        print(f"  - Count: {len(dets)}")
        if scores:
            print(f"  - Avg Score: {sum(scores)/len(scores):.3f}")
            print(f"  - Max Score: {max(scores):.3f}")
            print(f"  - Min Score: {min(scores):.3f}")
    
    # Time based analysis
    print(f"\n\nDetections by Video Time:")
    times = []
    for det in detections:
        video_time = det.get("VIDEO_TIME", "")
        camera = det.get("CAMERA", "")
        score = det.get("SCORE", "0")
        if video_time:
            times.append((video_time, camera, score))
    
    if times:
        times.sort()
        for video_time, camera, score in times[:10]:  # Show first 10
            print(f"  {video_time} - {camera} (Score: {score})")
        
        if len(times) > 10:
            print(f"  ... and {len(times) - 10} more detections")


def show_recent_detections(detections, count=5):
    """Show the most recent detections."""
    
    if not detections:
        return
    
    print("\n" + "=" * 80)
    print(f"MOST RECENT DETECTIONS (Last {count})")
    print("=" * 80)
    
    recent = detections[-count:]
    
    for i, det in enumerate(recent, 1):
        camera = det.get("CAMERA", "?")
        video_time = det.get("VIDEO_TIME", "?")
        event_time = det.get("EVENT_TIME", "?")
        score = det.get("SCORE", "?")
        cosine = det.get("COSINE", "?")
        euclidean = det.get("EUCLIDEAN", "?")
        snapshot = det.get("SNAPSHOT", "?")
        
        print(f"\n[{i}] {camera} @ {video_time}")
        print(f"    Event Time : {event_time}")
        print(f"    Score      : {score}")
        print(f"    Cosine     : {cosine}")
        print(f"    Euclidean  : {euclidean}")
        print(f"    Snapshot   : {snapshot}")


def main():
    """Main analysis function."""
    
    log_file = PROJECT_ROOT / "output" / "logs" / "detections.txt"
    
    print("\n" + "=" * 80)
    print("DETECTION ANALYSIS REPORT")
    print("=" * 80)
    
    detections = parse_log_file(log_file)
    
    if detections is None:
        sys.exit(1)
    
    if not detections:
        print("\nNo detections recorded yet.")
        print("Run the surveillance system first: python run.py")
    else:
        show_recent_detections(detections)
        show_statistics(detections)
    
    print("\n" + "=" * 80)
    print("SNAPSHOT DIRECTORY")
    print("=" * 80)
    
    snapshot_dir = PROJECT_ROOT / "output" / "snapshots"
    if snapshot_dir.exists():
        snapshots = sorted(snapshot_dir.glob("*.jpg"))
        print(f"\nTotal snapshots: {len(snapshots)}")
        
        if snapshots:
            print("\nLatest snapshots:")
            for snapshot in snapshots[-5:]:
                stat = snapshot.stat()
                size_kb = stat.st_size / 1024
                print(f"  - {snapshot.name} ({size_kb:.1f} KB)")
    else:
        print(f"Snapshot directory not found: {snapshot_dir}")
    
    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    main()
