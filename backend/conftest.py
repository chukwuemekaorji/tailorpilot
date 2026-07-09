"""Test configuration for the backend package.

This project uses a src layout, so pytest needs backend/src on sys.path when
tests import tailorpilot directly.
"""

from __future__ import annotations

import sys
from pathlib import Path


SRC_DIR = Path(__file__).resolve().parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))