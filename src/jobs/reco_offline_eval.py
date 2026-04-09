from __future__ import annotations

import importlib
import math
import os
import sys
from statistics import mean
from typing import Iterable, List, Set

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_ROOT = os.path.join(PROJECT_ROOT, "src")
for path in (PROJECT_ROOT, SRC_ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from utils.postgreSQL import get_connection


def _dcg(binary_rels: List[int]) -> float:
    score = 0.0
    for idx, rel in enumerate(binary_rels, start=1):
        if rel <= 0:
            continue
        score += rel / math.log2(idx + 1)
    return score


def _ndcg_at_k(recommended_ids: List[int], relevant_ids: Set[int], k: int = 10) -> float:
    rels = [1 if gid in relevant_ids else 0 for gid in recommended_ids[:k]]
    dcg = _dcg(rels)
    ideal = sorted(rels, reverse=True)
    idcg = _dcg(ideal)
    if idcg <= 0:
        return 0.0
    return dcg / idcg


def _precision_at_k(recommended_ids: List[int], relevant_ids: Set[int], k: int = 10) -> float:
    if k <= 0:
        return 0.0
    if not recommended_ids:
        return 0.0
    top_k = recommended_ids[:k]
    hits = sum(1 for gid in top_k if gid in relevant_ids)
    return hits / float(k)


def _sample_users(limit: int = 120) -> List[str]:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT ue.user_id
            FROM user_entities ue
            WHERE ue.is_selected IS TRUE
            GROUP BY ue.user_id
            ORDER BY MAX(COALESCE(ue.updated_at, ue.created_at)) DESC NULLS LAST
            LIMIT %s
            """,
            (limit,),
        )
        return [str(row[0]) for row in cur.fetchall() if row and row[0] is not None]
    finally:
        cur.close()
        conn.close()


def _liked_by_user(user_id: str) -> Set[int]:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT ugp.grant_id
            FROM user_grant_preferences ugp
            JOIN user_entities ue
              ON ue.entity_id = ugp.entity_id
             AND ue.user_id = %s
             AND ue.is_selected IS TRUE
            WHERE ugp.action = 'interesa'
            """,
            (user_id,),
        )
        return {int(row[0]) for row in cur.fetchall() if row and row[0] is not None}
    finally:
        cur.close()
        conn.close()


def _load_reco_module(engine: str):
    os.environ["RECO_ENGINE"] = engine
    import utils.recommendation_model as reco
    return importlib.reload(reco)


def evaluate_engine(engine: str, users: Iterable[str], k: int = 10):
    reco = _load_reco_module(engine)

    precisions: List[float] = []
    ndcgs: List[float] = []

    for user_id in users:
        relevant = _liked_by_user(user_id)
        if len(relevant) < 3:
            continue

        recs = reco.get_recommended_grants(user_id, limit=k)
        rec_ids = []
        for item in recs:
            gid = item.get("id")
            try:
                rec_ids.append(int(gid))
            except Exception:
                continue

        precisions.append(_precision_at_k(rec_ids, relevant, k))
        ndcgs.append(_ndcg_at_k(rec_ids, relevant, k))

    if not precisions:
        return {
            "engine": engine,
            "users_evaluated": 0,
            "precision_at_k": 0.0,
            "ndcg_at_k": 0.0,
        }

    return {
        "engine": engine,
        "users_evaluated": len(precisions),
        "precision_at_k": mean(precisions),
        "ndcg_at_k": mean(ndcgs),
    }


def main() -> int:
    users = _sample_users(limit=int(os.getenv("RECO_EVAL_USERS", "120")))
    if not users:
        print("reco_offline_eval: no users with selected entity")
        return 1

    k = int(os.getenv("RECO_EVAL_K", "10"))

    v2 = evaluate_engine("v2", users, k)
    legacy = evaluate_engine("legacy", users, k)

    delta_precision = v2["precision_at_k"] - legacy["precision_at_k"]
    delta_ndcg = v2["ndcg_at_k"] - legacy["ndcg_at_k"]

    print("reco_offline_eval:")
    print(f"  legacy={legacy}")
    print(f"  v2={v2}")
    print(f"  delta_precision_at_{k}={delta_precision:.6f}")
    print(f"  delta_ndcg_at_{k}={delta_ndcg:.6f}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
