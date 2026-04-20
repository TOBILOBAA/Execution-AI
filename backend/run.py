"""Development runner. Use from this folder: python run.py

Or from the repo root: python run_backend.py

If you use system/conda Python, this script will re-exec with backend/venv when
that venv exists and core deps (e.g. structlog) are missing. Override with:
EXECUTION_AI_RUN_NO_VENV_FALLBACK=1
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
os.chdir(BACKEND_ROOT)


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
        os.execv(str(vpy), [str(vpy), str(BACKEND_ROOT / "run.py"), *sys.argv[1:]])


_maybe_reexec_with_venv()

try:
    import structlog  # noqa: F401
except ModuleNotFoundError:
    sys.exit(
        "Backend dependencies missing (e.g. structlog). From the backend folder:\n"
        "  python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt\n"
        "Then run: python run.py"
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
