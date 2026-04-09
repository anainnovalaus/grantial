from __future__ import annotations

import os
import sys
from typing import List

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_ROOT = os.path.join(PROJECT_ROOT, "src")
for path in (PROJECT_ROOT, SRC_ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from utils.recommendation_model import ensure_recommendation_tables
from utils.postgreSQL import get_connection


BASE_REQUIRED_INDEXES: List[str] = [
    "idx_grants_marketplace_visible_pubdate",
    "idx_grants_marketplace_beneficiarios_gin",
]


def _column_exists(cur, table_name: str, column_name: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND column_name = %s
        LIMIT 1
        """,
        (table_name, column_name),
    )
    return cur.fetchone() is not None


def _required_indexes_for_current_schema(cur) -> List[str]:
    required: List[str] = []
    if _column_exists(cur, "grants", "fecha_de_publicacion"):
        required.append("idx_grants_marketplace_visible_pubdate")
    if _column_exists(cur, "grants", "Beneficiarios_Short"):
        required.append("idx_grants_marketplace_beneficiarios_gin")
    if not required:
        # Keep a conservative fallback.
        required = BASE_REQUIRED_INDEXES.copy()
    return required


def _assert_required_indexes() -> None:
    conn = get_connection()
    cur = conn.cursor()
    try:
        required_indexes = _required_indexes_for_current_schema(cur)
        cur.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = ANY(%s)
            """,
            (required_indexes,),
        )
        found = {row[0] for row in cur.fetchall()}
        missing = [idx for idx in required_indexes if idx not in found]
        if missing:
            raise RuntimeError(f"Missing indexes after optimization: {missing}")
    finally:
        cur.close()
        conn.close()


def main() -> int:
    ensure_recommendation_tables()
    _assert_required_indexes()
    print("reco_optimize_indexes: done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
