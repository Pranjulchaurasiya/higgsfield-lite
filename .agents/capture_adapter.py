"""Launcher for Antigravity capture adapter from within .agents directory."""

import sys
from pathlib import Path

# Add repo root and scripts/ to sys.path
AGENTS_DIR = Path(__file__).resolve().parent
ROOT = AGENTS_DIR.parent
SCRIPTS_DIR = ROOT / "scripts"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import antigravity_capture

if __name__ == "__main__":
    antigravity_capture.main()
