#!/usr/bin/env python
"""Setup configuration for Missing Person Detection System."""

from setuptools import setup, find_packages
from pathlib import Path

# Read requirements
requirements_path = Path(__file__).parent / "requirements.txt"
requirements = [
    line.strip()
    for line in requirements_path.read_text().splitlines()
    if line.strip() and not line.startswith("#")
]

setup(
    name="missing-person-detector",
    version="1.1.0",
    description="Automated missing person detection from CCTV video streams using face recognition",
    author="Surveillance Team",
    python_requires=">=3.9",
    packages=find_packages(exclude=["tests", "scripts", "docs"]),
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "mpd-diagnose=scripts.diagnose_system:main",
            "mpd-analyze=scripts.analyze_results:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Information Technology",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Topic :: Multimedia :: Video",
        "Topic :: Scientific/Engineering :: Image Recognition",
    ],
    keywords="cctv face-recognition missing-person detection surveillance",
    project_urls={
        "Documentation": "https://github.com/your-repo/docs",
        "Source": "https://github.com/your-repo",
        "Tracker": "https://github.com/your-repo/issues",
    },
)
