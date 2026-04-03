from __future__ import annotations

from pathlib import Path
import sys

QA_DIR = Path(__file__).resolve().parent
ROOT = QA_DIR.parent
if str(QA_DIR) not in sys.path:
    sys.path.insert(0, str(QA_DIR))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from launcher_core import launch_gui

if __name__ == '__main__':
    launch_gui()
