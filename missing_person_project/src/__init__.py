"""Missing Person Detection System - Core Package.

This package provides tools for detecting missing persons in CCTV video streams
using facial recognition and deep learning techniques.

Key Components:
    - FaceEngine: Face detection and encoding
    - VideoEngine: Per-camera video processing
    - AlertSystem: Detection logging and alerts
    - Settings: System configuration

"""

__version__ = "1.1.0"
__author__ = "Surveillance Team"
__description__ = "Automated missing person detection from CCTV video streams"

__all__ = [
    "FaceEngine",
    "VideoEngine",
    "AlertSystem",
    "Settings",
]
