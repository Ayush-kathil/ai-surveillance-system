from __future__ import annotations

import os
import sys
from pathlib import Path

from loguru import logger

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_DIR = Path(os.getenv("LOG_DIR", "output/logs"))


def configure_logging() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logger.remove()
    logger.add(
        sys.stdout,
        level=LOG_LEVEL,
        enqueue=True,
        serialize=True,
        backtrace=False,
        diagnose=False,
    )
    logger.add(
        LOG_DIR / "backend_audit.log",
        level=LOG_LEVEL,
        enqueue=True,
        serialize=True,
        rotation="25 MB",
        retention="72 hours",
        backtrace=False,
        diagnose=False,
    )


configure_logging()
