from __future__ import annotations

import os
import sys

from dotenv import load_dotenv
from openai import OpenAI

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_ROOT = os.path.join(PROJECT_ROOT, "src")
for path in (PROJECT_ROOT, SRC_ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from utils.recommendation_model import rebuild_grant_embeddings


def main() -> int:
    load_dotenv()

    model_name = os.getenv("RECO_EMBEDDING_MODEL", "text-embedding-3-small")
    batch_size = int(os.getenv("RECO_EMBEDDING_BATCH", "64"))

    client = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        organization=os.getenv("OPENAI_ORG_ID") or None,
    )

    processed = rebuild_grant_embeddings(
        openai_client=client,
        model_name=model_name,
        batch_size=batch_size,
    )
    print(f"reco_build_embeddings: processed={processed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
