from __future__ import annotations

import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_ROOT = os.path.join(PROJECT_ROOT, "src")
for path in (PROJECT_ROOT, SRC_ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from utils.recommendation_model import refresh_item_cf_similarity, refresh_reco_entity_state


def main() -> int:
    updated_entities = refresh_reco_entity_state()
    cf_rows = refresh_item_cf_similarity()

    print(f"reco_refresh_features: entities={updated_entities} cf_rows={cf_rows}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
