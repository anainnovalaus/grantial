import unittest
import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC_ROOT = os.path.join(PROJECT_ROOT, "src")
for path in (PROJECT_ROOT, SRC_ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from utils.recommendation_model import (
    _compute_reason_codes,
    _metadata_match_score,
    _score_candidate,
)


class RecommendationModelV2Tests(unittest.TestCase):
    def test_metadata_match_score_from_profile(self):
        grant = {
            "finalidad": "Transformacion digital y modernizacion",
            "region_impacto": "Cataluna",
            "sector": "Industria",
            "beneficiarios_raw": {"categorias": ["Pyme", "Autónomo"]},
        }
        profile = {
            "finalidad": ["transformacion digital"],
            "region_impacto": ["cataluna"],
            "sector": ["industria"],
            "beneficiarios": ["pyme"],
        }

        score = _metadata_match_score(grant, profile)
        self.assertGreater(score, 2.5)

    def test_compute_reason_codes(self):
        reasons = _compute_reason_codes(
            {
                "content_similarity": 0.6,
                "cf_score": 0.4,
                "metadata_match": 0.8,
                "freshness": 0.5,
                "popularity": 0.3,
            }
        )
        self.assertIn("content_similarity", reasons)
        self.assertIn("collaborative_signal", reasons)
        self.assertTrue(len(reasons) <= 3)

    def test_score_candidate_weighted_fallback(self):
        grant = {
            "id": 101,
            "finalidad": "I+D+i",
            "region_impacto": "Madrid",
            "sector": "Tecnología",
            "beneficiarios_raw": {"categorias": ["Pyme"]},
            "grant_embedding": [0.2, 0.4, 0.6],
            "fecha_de_publicacion": "2026-03-01",
            "popularity": 12,
        }
        profile_embedding = [0.2, 0.39, 0.62]
        profile = {
            "finalidad": ["i+d"],
            "region_impacto": ["madrid"],
            "sector": ["tecnologia"],
            "beneficiarios": ["pyme"],
        }
        cf_map = {101: 0.5}

        score, features, reasons = _score_candidate(
            grant,
            profile_embedding=profile_embedding,
            profile=profile,
            cf_map=cf_map,
            model=None,
            model_feature_names=None,
        )

        self.assertGreater(score, 0.2)
        self.assertGreater(features["content_similarity"], 0.8)
        self.assertIn("collaborative_signal", reasons)


if __name__ == "__main__":
    unittest.main()
