"""
Missing Person Detection System - Main Entry Point

This script starts the missing person detection system.
It processes one or more CCTV video streams and logs detections.

Usage:
    python run.py                  # Start detection with default settings
    python run.py --help          # Show help message

Environment:
    - Reference image:   data/input/missing.jpg
    - Video sources:     data/input/cam*.mp4
    - Output logs:       output/logs/detections.txt
    - Snapshots:         output/snapshots/

Configuration:
    Edit src/config.py to adjust detection parameters

Exit codes:
    0: Successful completion
    1: Configuration error
    2: Missing required files
    3: Runtime error
"""

from __future__ import annotations

import sys
import logging
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
SRC_PATH = PROJECT_ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from main import run


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> int:
    """Main entry point for the application."""
    try:
        logger.info("Starting Missing Person Detection System")
        run()
        logger.info("Detection completed successfully")
        return 0
        
    except FileNotFoundError as e:
        logger.error(f"Required file not found: {e}")
        print("\n❌ ERROR: Missing required files")
        print(f"   {e}")
        print("\nPlease ensure:")
        print("  1. Reference image: data/input/missing.jpg")
        print("  2. Video sources: data/input/cam1.mp4, data/input/cam2.mp4")
        print("\nRun diagnostics: python scripts/diagnose_system.py")
        return 2
        
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        print("\n\n⚠️  Detection stopped by user")
        return 0
        
    except Exception as exc:
        logger.error(f"Fatal error: {exc}", exc_info=True)
        print("\n❌ FATAL ERROR")
        print(f"   {exc}")
        print("\nFor debugging:")
        print("  1. Check logs: output/logs/detections.txt")
        print("  2. Run diagnostics: python scripts/diagnose_system.py")
        print("  3. Review src/config.py settings")
        return 3


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

