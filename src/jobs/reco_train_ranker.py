from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_ROOT = os.path.join(PROJECT_ROOT, "src")
for path in (PROJECT_ROOT, SRC_ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from utils.recommendation_model import train_ranker_model


def main() -> int:
    now = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    model_version = os.getenv("RECO_MODEL_VERSION", f"reco_ranker_{now}")
    model_dir = Path(os.getenv("RECO_MODEL_DIR", "src/models"))
    artifact_path = model_dir / f"{model_version}.joblib"

    ok = train_ranker_model(
        artifact_path=str(artifact_path),
        model_version=model_version,
        activate=True,
    )

    print(f"reco_train_ranker: ok={ok} model_version={model_version} artifact={artifact_path}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
