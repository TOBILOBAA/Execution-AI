#!/usr/bin/env python3
"""Start the FastAPI server from the monorepo root (fixes wrong cwd / import errors).

Usage (repo root):  python run_backend.py

Uses backend/.env after chdir. If backend/venv exists and your current Python
is missing backend deps, re-execs that venv automatically (same as backend/run.py).
Override with: EXECUTION_AI_RUN_NO_VENV_FALLBACK=1
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
BACKEND_ROOT = REPO_ROOT / "backend"

if not BACKEND_ROOT.is_dir():
    sys.exit(f"Expected backend at {BACKEND_ROOT}")

os.chdir(BACKEND_ROOT)
sys.path.insert(0, str(BACKEND_ROOT))


def _venv_python() -> Path | None:
    for rel in ("venv/bin/python", "venv/Scripts/python.exe"):
        p = BACKEND_ROOT / rel
        if p.is_file():
            return p
    return None


def _maybe_reexec_with_venv() -> None:
    if os.environ.get("EXECUTION_AI_RUN_NO_VENV_FALLBACK"):
        return
    vpy = _venv_python()
    if vpy is None:
        return
    if Path(sys.executable).resolve() == vpy.resolve():
        return
    try:
        import structlog  # noqa: F401
    except ModuleNotFoundError:
        os.execv(
            str(vpy),
            [str(vpy), str(REPO_ROOT / "run_backend.py"), *sys.argv[1:]],
        )


_maybe_reexec_with_venv()

try:
    import structlog  # noqa: F401
except ModuleNotFoundError:
    sys.exit(
        "Backend dependencies missing. Create backend/venv and install requirements, or run:\n"
        "  cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt\n"
        "Then: python run_backend.py"
    )

import uvicorn  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(BACKEND_ROOT)],
        log_level="info",
    )
