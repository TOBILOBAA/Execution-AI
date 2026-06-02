"""Generate analytics CSV exports in one local command.

Usage from the backend folder:
  python scripts/export_activity_pipeline.py

Optional:
  python scripts/export_activity_pipeline.py --output-dir exports/analytics
  python scripts/export_activity_pipeline.py --include-supporting
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from app.db.client import get_supabase  # noqa: E402
from app.services import activity_service  # noqa: E402


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export Execution AI analytics CSV files.")
    parser.add_argument(
        "--output-dir",
        default=str(BACKEND_ROOT / "exports" / "analytics"),
        help="Directory where the CSV files will be written.",
    )
    parser.add_argument(
        "--skip-bootstrap",
        action="store_true",
        help="Skip reconstructing daily_user_activity rows from existing auth-linked product data.",
    )
    parser.add_argument(
        "--include-supporting",
        action="store_true",
        help="Also export supporting detailed CSVs like daily activity, devices, and categories.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    db = get_supabase()
    backfilled = 0
    if not args.skip_bootstrap:
        backfilled = activity_service.bootstrap_daily_user_activity(db)

    user_summary_csv = activity_service.export_user_lifecycle_csv(db)

    user_summary_path = output_dir / "user_lifecycle_summary.csv"

    user_summary_path.write_text(user_summary_csv, encoding="utf-8")

    print("Analytics export complete.")
    if not args.skip_bootstrap:
        print(f"- bootstrapped daily activity rows: {backfilled}")
    print(f"- {user_summary_path}")

    if args.include_supporting:
        daily_activity_csv = activity_service.export_daily_activity_csv(db)
        device_activity_csv = activity_service.export_user_device_activity_csv(db)
        user_category_csv = activity_service.export_user_category_profiles_csv(db)
        category_popularity_csv = activity_service.export_category_popularity_csv(db)

        daily_activity_path = output_dir / "daily_user_activity.csv"
        device_activity_path = output_dir / "user_device_activity.csv"
        user_category_path = output_dir / "user_category_profile.csv"
        category_popularity_path = output_dir / "category_popularity.csv"

        daily_activity_path.write_text(daily_activity_csv, encoding="utf-8")
        device_activity_path.write_text(device_activity_csv, encoding="utf-8")
        user_category_path.write_text(user_category_csv, encoding="utf-8")
        category_popularity_path.write_text(category_popularity_csv, encoding="utf-8")

        print(f"- {daily_activity_path}")
        print(f"- {device_activity_path}")
        print(f"- {user_category_path}")
        print(f"- {category_popularity_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
