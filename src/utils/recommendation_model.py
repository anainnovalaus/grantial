from __future__ import annotations

import json
import math
import os
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from psycopg2.extras import Json

from utils.postgreSQL import get_connection
from src.Modules.logger_config import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RECO_ENGINE = os.getenv("RECO_ENGINE", "v2").strip().lower()
DEFAULT_EMBEDDING_DIM = int(os.getenv("RECO_EMBEDDING_DIM", "1536"))
DEFAULT_CANDIDATE_POOL = int(os.getenv("RECO_CANDIDATE_POOL", "320"))
EXPLORATION_RATIO = float(os.getenv("RECO_EXPLORATION_RATIO", "0.15"))

EVENT_TYPES = {
    "impression",
    "detail_open",
    "like",
    "dislike",
    "favorite_add",
    "apply_click",
}

EVENT_WEIGHTS = {
    "impression": 0.1,
    "detail_open": 1.2,
    "like": 4.0,
    "dislike": -4.0,
    "favorite_add": 3.5,
    "apply_click": 6.0,
}

_MODEL_CACHE: Dict[str, Any] = {"version": None, "model": None, "feature_names": None}
_SCHEMA_READY = False
_SCHEMA_READY_LOCK = Lock()


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------


def _parse_date_like(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except Exception:
        return None


def _format_deadline_for_ui(deadline_value, publication_date_value=None):
    deadline_date = _parse_date_like(deadline_value)
    if deadline_date:
        return deadline_date.strftime("%Y-%m-%d")

    if deadline_value not in (None, "", "No disponible"):
        return str(deadline_value)

    publication_date = _parse_date_like(publication_date_value)
    if publication_date:
        today = date.today()
        if today - timedelta(days=30) <= publication_date <= today:
            return "Proximamente..."

    return "No disponible"


def _safe_float(value, fallback=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b:
        return 0.0
    if len(a) != len(b):
        return 0.0

    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for av, bv in zip(a, b):
        dot += av * bv
        norm_a += av * av
        norm_b += bv * bv

    if norm_a <= 0 or norm_b <= 0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


def _normalize_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def _vector_to_pg(value: Sequence[float]) -> str:
    return "[" + ",".join(f"{float(x):.8f}" for x in value) + "]"


def _parse_vector_value(raw) -> Optional[List[float]]:
    if raw is None:
        return None
    if isinstance(raw, list):
        try:
            return [float(x) for x in raw]
        except Exception:
            return None
    text = str(raw).strip()
    if not text:
        return None

    # pgvector textual format: [0.1,0.2]
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]

    try:
        return [float(x) for x in text.split(",") if str(x).strip()]
    except Exception:
        return None


def _extract_beneficiarios_list(raw) -> List[str]:
    if raw in (None, ""):
        return []
    data = raw
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except Exception:
            return []
    if isinstance(data, dict):
        cats = data.get("categorias")
        if isinstance(cats, list):
            return [str(v).strip() for v in cats if str(v).strip()]
        if isinstance(cats, str) and cats.strip():
            return [cats.strip()]
    return []


def _table_has_column(cursor, table_name: str, column_name: str) -> bool:
    cursor.execute(
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
    return cursor.fetchone() is not None


def _table_exists(cursor, table_name: str) -> bool:
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = %s
        LIMIT 1
        """,
        (table_name,),
    )
    return cursor.fetchone() is not None


def _try_create_extension(cursor, extension_name: str) -> bool:
    if extension_name not in {"vector", "pg_trgm"}:
        raise ValueError(f"Unsupported extension '{extension_name}'")

    savepoint = f"sp_ext_{extension_name}"
    try:
        cursor.execute(f"SAVEPOINT {savepoint}")
        cursor.execute(f"CREATE EXTENSION IF NOT EXISTS {extension_name}")
        cursor.execute(f"RELEASE SAVEPOINT {savepoint}")
        return True
    except Exception as e:
        try:
            cursor.execute(f"ROLLBACK TO SAVEPOINT {savepoint}")
            cursor.execute(f"RELEASE SAVEPOINT {savepoint}")
        except Exception:
            pass
        logger.warning("No se pudo habilitar extensión %s: %s", extension_name, e)
        return False


def _is_extension_available(cursor, extension_name: str) -> bool:
    cursor.execute("SELECT 1 FROM pg_extension WHERE extname = %s LIMIT 1", (extension_name,))
    if cursor.fetchone():
        return True
    return _try_create_extension(cursor, extension_name)


def _safe_create_index(cursor, index_name: str, statement: str) -> None:
    savepoint = f"sp_idx_{index_name[:48]}"
    try:
        cursor.execute(f"SAVEPOINT {savepoint}")
        cursor.execute(statement)
        cursor.execute(f"RELEASE SAVEPOINT {savepoint}")
    except Exception as e:
        try:
            cursor.execute(f"ROLLBACK TO SAVEPOINT {savepoint}")
            cursor.execute(f"RELEASE SAVEPOINT {savepoint}")
        except Exception:
            pass
        logger.warning("No se pudo crear índice %s: %s", index_name, e)


def _ensure_marketplace_search_indexes(cursor, trgm_enabled: bool) -> None:
    if not _table_exists(cursor, "grants"):
        logger.warning("Tabla grants no existe, se omite creación de índices marketplace.")
        return

    has_resumen = _table_has_column(cursor, "grants", "resumen_completo")
    has_titulo_corto = _table_has_column(cursor, "grants", "titulo_corto")
    has_titulo = _table_has_column(cursor, "grants", "titulo")
    has_beneficiarios_short = _table_has_column(cursor, "grants", "Beneficiarios_Short")
    has_region = _table_has_column(cursor, "grants", "region_impacto")
    has_finalidad = _table_has_column(cursor, "grants", "finalidad")
    has_fecha_pub = _table_has_column(cursor, "grants", "fecha_de_publicacion")
    has_fecha_inicio = _table_has_column(cursor, "grants", "fecha_de_inicio")
    has_fecha_fin = _table_has_column(cursor, "grants", "fecha_finalizacion")

    # Predicate used in marketplace search to keep indexes compact and aligned with real queries.
    predicate_parts = []
    if has_resumen:
        predicate_parts.append("resumen_completo IS NOT NULL")
    if has_titulo_corto:
        predicate_parts.append("titulo_corto IS NOT NULL AND titulo_corto <> ''")
    if has_beneficiarios_short:
        predicate_parts.append(
            "\"Beneficiarios_Short\" IS NOT NULL AND \"Beneficiarios_Short\"::text NOT IN ('{}', '{\"categorias\": []}', '')"
        )
    if has_region:
        predicate_parts.append("region_impacto IS NOT NULL AND region_impacto <> ''")
    visible_marketplace_predicate = " AND ".join(predicate_parts) if predicate_parts else "TRUE"

    if has_fecha_pub:
        _safe_create_index(
            cursor,
            "idx_grants_marketplace_visible_pubdate",
            f"""
            CREATE INDEX IF NOT EXISTS idx_grants_marketplace_visible_pubdate
            ON grants (fecha_de_publicacion DESC, id)
            WHERE {visible_marketplace_predicate}
            """,
        )

    if has_fecha_inicio:
        _safe_create_index(
            cursor,
            "idx_grants_marketplace_visible_fecha_inicio",
            f"""
            CREATE INDEX IF NOT EXISTS idx_grants_marketplace_visible_fecha_inicio
            ON grants (fecha_de_inicio)
            WHERE {visible_marketplace_predicate}
              AND fecha_de_inicio IS NOT NULL
            """,
        )

    if has_fecha_fin:
        _safe_create_index(
            cursor,
            "idx_grants_marketplace_visible_fecha_finalizacion",
            f"""
            CREATE INDEX IF NOT EXISTS idx_grants_marketplace_visible_fecha_finalizacion
            ON grants (fecha_finalizacion)
            WHERE {visible_marketplace_predicate}
              AND fecha_finalizacion IS NOT NULL
            """,
        )

    if has_beneficiarios_short:
        _safe_create_index(
            cursor,
            "idx_grants_marketplace_beneficiarios_gin",
            f"""
            CREATE INDEX IF NOT EXISTS idx_grants_marketplace_beneficiarios_gin
            ON grants USING GIN ("Beneficiarios_Short" jsonb_path_ops)
            WHERE {visible_marketplace_predicate}
            """,
        )

    if trgm_enabled:
        if has_titulo_corto:
            _safe_create_index(
                cursor,
                "idx_grants_marketplace_titulo_corto_trgm",
                """
                CREATE INDEX IF NOT EXISTS idx_grants_marketplace_titulo_corto_trgm
                ON grants USING GIN (titulo_corto gin_trgm_ops)
                WHERE titulo_corto IS NOT NULL AND titulo_corto <> ''
                """,
            )
        if has_titulo:
            _safe_create_index(
                cursor,
                "idx_grants_marketplace_titulo_trgm",
                """
                CREATE INDEX IF NOT EXISTS idx_grants_marketplace_titulo_trgm
                ON grants USING GIN (titulo gin_trgm_ops)
                WHERE titulo IS NOT NULL AND titulo <> ''
                """,
            )
        if has_region:
            _safe_create_index(
                cursor,
                "idx_grants_marketplace_region_trgm",
                f"""
                CREATE INDEX IF NOT EXISTS idx_grants_marketplace_region_trgm
                ON grants USING GIN (region_impacto gin_trgm_ops)
                WHERE {visible_marketplace_predicate}
                """,
            )
        if has_finalidad:
            _safe_create_index(
                cursor,
                "idx_grants_marketplace_finalidad_trgm",
                f"""
                CREATE INDEX IF NOT EXISTS idx_grants_marketplace_finalidad_trgm
                ON grants USING GIN (finalidad gin_trgm_ops)
                WHERE {visible_marketplace_predicate}
                  AND finalidad IS NOT NULL
                  AND finalidad <> ''
                """,
            )

        if _table_has_column(cursor, "grants", "administracion_convocante"):
            _safe_create_index(
                cursor,
                "idx_grants_marketplace_admin_convocante_trgm",
                f"""
                CREATE INDEX IF NOT EXISTS idx_grants_marketplace_admin_convocante_trgm
                ON grants USING GIN (administracion_convocante gin_trgm_ops)
                WHERE {visible_marketplace_predicate}
                  AND administracion_convocante IS NOT NULL
                  AND administracion_convocante <> ''
                """,
            )

        if _table_has_column(cursor, "grants", "tipo_ayuda"):
            _safe_create_index(
                cursor,
                "idx_grants_marketplace_tipo_ayuda_trgm",
                f"""
                CREATE INDEX IF NOT EXISTS idx_grants_marketplace_tipo_ayuda_trgm
                ON grants USING GIN (tipo_ayuda gin_trgm_ops)
                WHERE {visible_marketplace_predicate}
                  AND tipo_ayuda IS NOT NULL
                  AND tipo_ayuda <> ''
                """,
            )

    if _table_exists(cursor, "matches"):
        has_match_cols = (
            _table_has_column(cursor, "matches", "grant_id")
            and _table_has_column(cursor, "matches", "entity_id")
            and _table_has_column(cursor, "matches", "numero_match")
        )
        if has_match_cols:
            _safe_create_index(
                cursor,
                "idx_matches_grant_entity_numero_match_desc",
                """
                CREATE INDEX IF NOT EXISTS idx_matches_grant_entity_numero_match_desc
                ON matches (grant_id, entity_id, numero_match DESC)
                """,
            )


# ---------------------------------------------------------------------------
# Table setup
# ---------------------------------------------------------------------------


def ensure_recommendation_tables() -> None:
    """Ensure v2 recommendation tables and indices exist."""
    global _SCHEMA_READY

    if _SCHEMA_READY:
        return

    conn = None
    cursor = None
    with _SCHEMA_READY_LOCK:
        if _SCHEMA_READY:
            return
        try:
            conn = get_connection()
            cursor = conn.cursor()

            has_pgvector = _is_extension_available(cursor, "vector")
            vector_type = f"vector({DEFAULT_EMBEDDING_DIM})" if has_pgvector else "double precision[]"
            trgm_enabled = _is_extension_available(cursor, "pg_trgm")

            cursor.execute(
                f"""
                CREATE TABLE IF NOT EXISTS reco_events (
                    event_id BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    entity_id TEXT,
                    grant_id BIGINT NOT NULL,
                    event_type TEXT NOT NULL,
                    event_value DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                    surface TEXT,
                    position INTEGER,
                    session_id TEXT,
                    metadata JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT reco_events_event_type_chk CHECK (event_type IN (
                        'impression','detail_open','like','dislike','favorite_add','apply_click'
                    ))
                )
                """
            )

            cursor.execute(
                f"""
                CREATE TABLE IF NOT EXISTS reco_entity_state (
                    entity_id TEXT PRIMARY KEY,
                    profile_embedding {vector_type},
                    profile_features JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                    top_finalidades TEXT[] NOT NULL DEFAULT '{{}}',
                    top_regiones TEXT[] NOT NULL DEFAULT '{{}}',
                    top_beneficiarios TEXT[] NOT NULL DEFAULT '{{}}',
                    top_sectores TEXT[] NOT NULL DEFAULT '{{}}',
                    model_version TEXT,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )

            cursor.execute(
                f"""
                CREATE TABLE IF NOT EXISTS grant_embeddings (
                    grant_id BIGINT PRIMARY KEY,
                    embedding {vector_type} NOT NULL,
                    model_name TEXT NOT NULL,
                    source_hash TEXT,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS item_cf_similarity (
                    grant_id_a BIGINT NOT NULL,
                    grant_id_b BIGINT NOT NULL,
                    score DOUBLE PRECISION NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (grant_id_a, grant_id_b)
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS reco_model_registry (
                    model_version TEXT PRIMARY KEY,
                    model_type TEXT NOT NULL,
                    artifact_path TEXT NOT NULL,
                    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
                    feature_names TEXT[] NOT NULL DEFAULT '{}',
                    is_active BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )

            # Indices
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reco_events_entity_ts ON reco_events(entity_id, timestamp DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reco_events_grant_ts ON reco_events(grant_id, timestamp DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reco_events_user_entity_ts ON reco_events(user_id, entity_id, timestamp DESC)")

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_item_cf_a ON item_cf_similarity(grant_id_a, score DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_item_cf_b ON item_cf_similarity(grant_id_b, score DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reco_model_active ON reco_model_registry(is_active, created_at DESC)")

            try:
                cursor.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_user_entities_user_selected
                    ON user_entities(user_id, is_selected, updated_at DESC, created_at DESC)
                    """
                )
            except Exception as e:
                logger.warning("No se pudo crear idx_user_entities_user_selected: %s", e)

            # Harden user_grant_preferences for entity-scoped UPSERTs.
            try:
                has_entity = _table_has_column(cursor, "user_grant_preferences", "entity_id")
                has_grant_id = _table_has_column(cursor, "user_grant_preferences", "grant_id")
                has_user_id = _table_has_column(cursor, "user_grant_preferences", "user_id")
                has_timestamp = _table_has_column(cursor, "user_grant_preferences", "timestamp")

                if has_entity and has_grant_id and has_user_id:
                    order_expr = "timestamp DESC NULLS LAST" if has_timestamp else "ctid DESC"
                    cursor.execute(
                        f"""
                        WITH ranked AS (
                            SELECT ctid,
                                   ROW_NUMBER() OVER (
                                       PARTITION BY user_id, entity_id, grant_id
                                       ORDER BY {order_expr}
                                   ) AS rn
                            FROM user_grant_preferences
                        )
                        DELETE FROM user_grant_preferences ugp
                        USING ranked r
                        WHERE ugp.ctid = r.ctid
                          AND r.rn > 1
                        """
                    )

                    cursor.execute(
                        """
                        CREATE UNIQUE INDEX IF NOT EXISTS idx_ugp_user_entity_grant_unique
                        ON user_grant_preferences(user_id, entity_id, grant_id)
                        """
                    )

                if has_user_id and has_timestamp and _table_has_column(cursor, "user_grant_preferences", "action"):
                    cursor.execute(
                        """
                        CREATE INDEX IF NOT EXISTS idx_ugp_user_action_ts
                        ON user_grant_preferences(user_id, action, timestamp DESC)
                        """
                    )
                if has_entity and has_user_id and has_timestamp and _table_has_column(cursor, "user_grant_preferences", "action"):
                    cursor.execute(
                        """
                        CREATE INDEX IF NOT EXISTS idx_ugp_user_entity_action_ts
                        ON user_grant_preferences(user_id, entity_id, action, timestamp DESC)
                        """
                    )
            except Exception as e:
                logger.warning("No se pudo reforzar user_grant_preferences: %s", e)

            _ensure_marketplace_search_indexes(cursor, trgm_enabled=trgm_enabled)
            conn.commit()
            _SCHEMA_READY = True
        except Exception as e:
            logger.error("Error ensuring recommendation tables: %s", e, exc_info=True)
            if conn:
                conn.rollback()
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


# ---------------------------------------------------------------------------
# Entity helpers
# ---------------------------------------------------------------------------


def get_selected_entity_id_for_user(user_id: str, cursor=None) -> Optional[str]:
    own_conn = None
    own_cursor = None
    try:
        if cursor is None:
            own_conn = get_connection()
            own_cursor = own_conn.cursor()
            cursor = own_cursor

        cursor.execute(
            """
            SELECT ue.entity_id
            FROM user_entities ue
            WHERE ue.user_id = %s
              AND ue.is_selected IS TRUE
            ORDER BY ue.updated_at DESC NULLS LAST, ue.created_at DESC
            LIMIT 1
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        if row:
            return str(row[0])

        cursor.execute(
            """
            SELECT ue.entity_id
            FROM user_entities ue
            WHERE ue.user_id = %s
            ORDER BY ue.updated_at DESC NULLS LAST, ue.created_at DESC
            LIMIT 1
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        if row:
            return str(row[0])
        return None
    except Exception as e:
        logger.warning("No se pudo obtener entidad seleccionada para user_id=%s: %s", user_id, e)
        return None
    finally:
        if own_cursor:
            own_cursor.close()
        if own_conn:
            own_conn.close()


def select_user_entity(user_id: str, entity_id: str) -> bool:
    """Select an entity transactionally (single selected entity per user)."""
    ensure_recommendation_tables()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT 1
            FROM user_entities
            WHERE user_id = %s AND entity_id = %s
            LIMIT 1
            """,
            (user_id, entity_id),
        )
        if not cursor.fetchone():
            return False

        has_updated_at = _table_has_column(cursor, "user_entities", "updated_at")
        if has_updated_at:
            cursor.execute(
                """
                UPDATE user_entities
                SET is_selected = FALSE,
                    updated_at = NOW()
                WHERE user_id = %s
                """,
                (user_id,),
            )
            cursor.execute(
                """
                UPDATE user_entities
                SET is_selected = TRUE,
                    updated_at = NOW()
                WHERE user_id = %s AND entity_id = %s
                """,
                (user_id, entity_id),
            )
        else:
            cursor.execute("UPDATE user_entities SET is_selected = FALSE WHERE user_id = %s", (user_id,))
            cursor.execute(
                "UPDATE user_entities SET is_selected = TRUE WHERE user_id = %s AND entity_id = %s",
                (user_id, entity_id),
            )

        conn.commit()
        return True
    except Exception as e:
        logger.error("Error seleccionando entidad user_id=%s entity_id=%s: %s", user_id, entity_id, e)
        if conn:
            conn.rollback()
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


def record_reco_event(
    user_id: str,
    grant_id: int,
    event_type: str,
    *,
    entity_id: Optional[str] = None,
    surface: Optional[str] = None,
    position: Optional[int] = None,
    session_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    event_value: Optional[float] = None,
) -> bool:
    ensure_recommendation_tables()

    if event_type not in EVENT_TYPES:
        logger.warning("Evento de recomendación inválido: %s", event_type)
        return False

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        resolved_entity = entity_id or get_selected_entity_id_for_user(user_id, cursor=cursor)
        resolved_value = _safe_float(event_value, EVENT_WEIGHTS.get(event_type, 1.0))

        cursor.execute(
            """
            INSERT INTO reco_events (
                user_id,
                entity_id,
                grant_id,
                event_type,
                event_value,
                surface,
                position,
                session_id,
                metadata,
                timestamp
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                str(user_id),
                str(resolved_entity) if resolved_entity else None,
                int(grant_id),
                event_type,
                resolved_value,
                surface,
                position,
                session_id,
                Json(metadata or {}),
            ),
        )

        conn.commit()
        return True
    except Exception as e:
        logger.error("Error guardando evento de recomendación: %s", e, exc_info=True)
        if conn:
            conn.rollback()
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Preferences and compatibility APIs
# ---------------------------------------------------------------------------


def get_user_preferences(user_id):
    """
    Return tuple (structured_preferences, already_seen_grant_ids) scoped to selected entity.
    """
    ensure_recommendation_tables()
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()
        entity_id = get_selected_entity_id_for_user(user_id, cursor=cursor)

        if not entity_id:
            return {
                "finalidad": [],
                "region_impacto": [],
                "beneficiarios": [],
                "sector": [],
            }, []

        cursor.execute(
            """
            SELECT grant_id, finalidad, region_impacto, beneficiarios, sector
            FROM user_grant_preferences
            WHERE entity_id = %s
              AND action = 'interesa'
            ORDER BY timestamp DESC NULLS LAST
            """,
            (entity_id,),
        )
        liked_rows = cursor.fetchall()

        cursor.execute(
            """
            SELECT grant_id
            FROM user_grant_preferences
            WHERE entity_id = %s
            ORDER BY timestamp DESC NULLS LAST
            """,
            (entity_id,),
        )
        seen_rows = cursor.fetchall()

        preferences = {
            "finalidad": [],
            "region_impacto": [],
            "beneficiarios": [],
            "sector": [],
        }

        for grant_id, finalidad, region_impacto, beneficiarios, sector in liked_rows:
            if finalidad:
                preferences["finalidad"].append(str(finalidad))
            if region_impacto:
                preferences["region_impacto"].append(str(region_impacto))
            if beneficiarios:
                preferences["beneficiarios"].extend(_extract_beneficiarios_list(beneficiarios))
            if sector:
                if isinstance(sector, str) and "," in sector:
                    preferences["sector"].extend([s.strip() for s in sector.split(",") if s.strip()])
                else:
                    preferences["sector"].append(str(sector))

        already_seen = [int(row[0]) for row in seen_rows if row and row[0] is not None]
        return preferences, already_seen

    except Exception as e:
        logger.error("Error obteniendo preferencias del usuario: %s", e, exc_info=True)
        return {
            "finalidad": [],
            "region_impacto": [],
            "beneficiarios": [],
            "sector": [],
        }, []
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def _build_profile_from_preferences(preferences: Dict[str, List[str]]) -> Dict[str, List[str]]:
    profile = {}
    for key, values in preferences.items():
        if not values:
            continue
        counter = Counter([str(v).strip() for v in values if str(v).strip()])
        top_values = [item[0] for item in counter.most_common(5)]
        if top_values:
            profile[key] = top_values
    return profile


def _get_default_grants(limit=50):
    logger.info("[RECO_DEFAULT] fetching %s grants", limit)
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                g.id,
                g.titulo_corto,
                g.presupuesto,
                g.fecha_finalizacion,
                g.fecha_de_publicacion,
                g.resumen_completo,
                COALESCE(string_agg(DISTINCT b.value, ', '), '') AS beneficiarios,
                g.region_impacto
            FROM grants g
            LEFT JOIN LATERAL (
                SELECT value
                FROM jsonb_array_elements_text(
                    CASE
                        WHEN jsonb_typeof(g."Beneficiarios_Short"->'categorias') = 'array'
                        THEN g."Beneficiarios_Short"->'categorias'
                        ELSE '[]'::jsonb
                    END
                ) AS value
            ) AS b(value) ON TRUE
            WHERE
                g.resumen_completo IS NOT NULL
                AND (g.fecha_finalizacion IS NULL OR g.fecha_finalizacion::date >= CURRENT_DATE)
            GROUP BY
                g.id, g.titulo_corto, g.presupuesto, g.fecha_finalizacion, g.fecha_de_publicacion,
                g.resumen_completo, g.region_impacto
            ORDER BY
                g.fecha_de_publicacion DESC NULLS LAST
            LIMIT %s
            """,
            (limit,),
        )

        return _format_grants_with_optional_score(cursor.fetchall())
    except Exception as e:
        logger.error("Error en default grants: %s", e, exc_info=True)
        return []
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def _format_grants_with_optional_score(grants):
    result = []
    for row in grants:
        score = _safe_float(row[8], 0.0) if len(row) > 8 else None
        reasons = row[9] if len(row) > 9 else None
        result.append(
            {
                "id": row[0],
                "titulo_corto": row[1],
                "presupuesto": row[2],
                "fecha_limite": _format_deadline_for_ui(row[3], row[4]),
                "resumen_completo": row[5],
                "beneficiarios": row[6],
                "region_impacto": row[7],
                "score": score,
                "reason_codes": reasons if isinstance(reasons, list) else [],
            }
        )
    return result


def _load_active_model(cursor):
    cursor.execute(
        """
        SELECT model_version, model_type, artifact_path, feature_names
        FROM reco_model_registry
        WHERE is_active = TRUE
        ORDER BY created_at DESC
        LIMIT 1
        """
    )
    row = cursor.fetchone()
    if not row:
        return None, None

    version, model_type, artifact_path, feature_names = row

    if _MODEL_CACHE.get("version") == version:
        return _MODEL_CACHE.get("model"), _MODEL_CACHE.get("feature_names")

    path = Path(artifact_path)
    if not path.exists():
        logger.warning("Modelo activo no encontrado en disco: %s", artifact_path)
        return None, None

    try:
        import joblib  # type: ignore

        model = joblib.load(path)
        _MODEL_CACHE["version"] = version
        _MODEL_CACHE["model"] = model
        _MODEL_CACHE["feature_names"] = list(feature_names or [])
        return model, _MODEL_CACHE["feature_names"]
    except Exception as e:
        logger.warning("No se pudo cargar modelo activo %s: %s", artifact_path, e)
        return None, None


def _predict_with_model(model, feature_names: List[str], features: Dict[str, float]) -> Optional[float]:
    if model is None:
        return None

    try:
        ordered_names = feature_names or sorted(features.keys())
        vector = [[_safe_float(features.get(name), 0.0) for name in ordered_names]]

        # lightgbm booster
        if hasattr(model, "predict"):
            pred = model.predict(vector)
            if hasattr(pred, "__len__") and not isinstance(pred, (str, bytes)):
                return _safe_float(pred[0], 0.0)
            return _safe_float(pred, 0.0)

        return None
    except Exception:
        return None


def _build_entity_metadata_profile(cursor, entity_id: str) -> Dict[str, List[str]]:
    profile: Dict[str, List[str]] = {
        "finalidad": [],
        "region_impacto": [],
        "beneficiarios": [],
        "sector": [],
    }

    try:
        cursor.execute(
            """
            SELECT sector, comunidad_autonoma, comunidad_autonoma_centro_trabajo, tipo_empresa
            FROM entities
            WHERE id = %s
            LIMIT 1
            """,
            (entity_id,),
        )
        row = cursor.fetchone()
        if not row:
            return profile

        sector, region_1, region_2, tipo_empresa = row
        if sector:
            profile["sector"].append(str(sector))
        if region_1:
            profile["region_impacto"].append(str(region_1))
        if region_2:
            profile["region_impacto"].append(str(region_2))
        if tipo_empresa:
            profile["beneficiarios"].append(str(tipo_empresa))
    except Exception as e:
        logger.debug("No se pudo construir perfil metadata de entidad %s: %s", entity_id, e)

    return profile


def _get_entity_state(cursor, entity_id: str) -> Dict[str, Any]:
    cursor.execute(
        """
        SELECT profile_embedding, profile_features, top_finalidades, top_regiones,
               top_beneficiarios, top_sectores, model_version
        FROM reco_entity_state
        WHERE entity_id = %s
        LIMIT 1
        """,
        (entity_id,),
    )
    row = cursor.fetchone()
    if not row:
        return {
            "profile_embedding": None,
            "profile_features": {},
            "top_finalidades": [],
            "top_regiones": [],
            "top_beneficiarios": [],
            "top_sectores": [],
            "model_version": None,
        }

    return {
        "profile_embedding": _parse_vector_value(row[0]),
        "profile_features": row[1] if isinstance(row[1], dict) else {},
        "top_finalidades": list(row[2] or []),
        "top_regiones": list(row[3] or []),
        "top_beneficiarios": list(row[4] or []),
        "top_sectores": list(row[5] or []),
        "model_version": row[6],
    }


def _get_liked_and_disliked_grants(cursor, entity_id: str) -> Tuple[List[int], List[int], List[int]]:
    cursor.execute(
        """
        SELECT grant_id,
               MAX(CASE WHEN action = 'interesa' THEN 1 ELSE 0 END) AS liked,
               MAX(CASE WHEN action = 'no interesa' THEN 1 ELSE 0 END) AS disliked
        FROM user_grant_preferences
        WHERE entity_id = %s
        GROUP BY grant_id
        """,
        (entity_id,),
    )

    liked: List[int] = []
    disliked: List[int] = []
    seen: List[int] = []

    for grant_id, liked_flag, disliked_flag in cursor.fetchall():
        gid = int(grant_id)
        seen.append(gid)
        if liked_flag:
            liked.append(gid)
        if disliked_flag:
            disliked.append(gid)

    return liked, disliked, seen


def _fetch_embedding_candidates(
    cursor,
    profile_embedding: Optional[List[float]],
    exclusions: Sequence[int],
    limit: int,
) -> List[int]:
    if not profile_embedding:
        return []

    placeholders = ""
    params: List[Any] = [_vector_to_pg(profile_embedding)]

    if exclusions:
        placeholders = "AND g.id NOT IN (" + ", ".join(["%s"] * len(exclusions)) + ")"
        params.extend(exclusions)

    params.append(limit)

    query = f"""
        SELECT ge.grant_id
        FROM grant_embeddings ge
        JOIN grants g ON g.id = ge.grant_id
        WHERE g.resumen_completo IS NOT NULL
          AND (g.fecha_finalizacion IS NULL OR g.fecha_finalizacion::date >= CURRENT_DATE)
          {placeholders}
        ORDER BY ge.embedding <=> %s::vector
        LIMIT %s
    """

    # vector parameter must come first for ORDER BY operator usage.
    if exclusions:
        params = params[1:-1] + [params[0], params[-1]]

    try:
        cursor.execute(query, params)
        return [int(row[0]) for row in cursor.fetchall()]
    except Exception as e:
        logger.debug("No se pudieron obtener candidatos embedding: %s", e)
        return []


def _fetch_cf_candidates(cursor, liked_ids: Sequence[int], exclusions: Sequence[int], limit: int) -> List[int]:
    if not liked_ids:
        return []

    params: List[Any] = [list(liked_ids)]
    exclusions_clause = ""
    if exclusions:
        exclusions_clause = "AND s.grant_id_b <> ALL(%s)"
        params.append(list(exclusions))

    params.append(limit)

    query = f"""
        SELECT s.grant_id_b, MAX(s.score) AS max_score
        FROM item_cf_similarity s
        JOIN grants g ON g.id = s.grant_id_b
        WHERE s.grant_id_a = ANY(%s)
          AND g.resumen_completo IS NOT NULL
          AND (g.fecha_finalizacion IS NULL OR g.fecha_finalizacion::date >= CURRENT_DATE)
          {exclusions_clause}
        GROUP BY s.grant_id_b
        ORDER BY max_score DESC
        LIMIT %s
    """

    try:
        cursor.execute(query, params)
        return [int(row[0]) for row in cursor.fetchall()]
    except Exception as e:
        logger.debug("No se pudieron obtener candidatos CF: %s", e)
        return []


def _fetch_popular_fresh_candidates(cursor, exclusions: Sequence[int], limit: int) -> List[int]:
    params: List[Any] = []
    exclusions_clause = ""
    if exclusions:
        exclusions_clause = "AND g.id <> ALL(%s)"
        params.append(list(exclusions))
    params.append(limit)

    query = f"""
        WITH popularity AS (
            SELECT grant_id,
                   SUM(CASE
                           WHEN event_type = 'like' THEN 4
                           WHEN event_type = 'favorite_add' THEN 3
                           WHEN event_type = 'apply_click' THEN 6
                           WHEN event_type = 'detail_open' THEN 2
                           WHEN event_type = 'dislike' THEN -3
                           ELSE 0.1
                       END) AS popularity
            FROM reco_events
            WHERE timestamp >= NOW() - INTERVAL '90 days'
            GROUP BY grant_id
        )
        SELECT g.id
        FROM grants g
        LEFT JOIN popularity p ON p.grant_id = g.id
        WHERE g.resumen_completo IS NOT NULL
          AND (g.fecha_finalizacion IS NULL OR g.fecha_finalizacion::date >= CURRENT_DATE)
          {exclusions_clause}
        ORDER BY COALESCE(p.popularity, 0) DESC,
                 g.fecha_de_publicacion DESC NULLS LAST
        LIMIT %s
    """

    cursor.execute(query, params)
    return [int(row[0]) for row in cursor.fetchall()]


def _fetch_candidate_rows(cursor, candidate_ids: Sequence[int]) -> List[Dict[str, Any]]:
    if not candidate_ids:
        return []

    cursor.execute(
        """
        WITH popularity AS (
            SELECT grant_id,
                   SUM(CASE
                           WHEN event_type = 'like' THEN 4
                           WHEN event_type = 'favorite_add' THEN 3
                           WHEN event_type = 'apply_click' THEN 6
                           WHEN event_type = 'detail_open' THEN 2
                           WHEN event_type = 'dislike' THEN -3
                           ELSE 0.1
                       END) AS popularity
            FROM reco_events
            WHERE timestamp >= NOW() - INTERVAL '90 days'
            GROUP BY grant_id
        )
        SELECT
            g.id,
            g.titulo_corto,
            g.presupuesto,
            g.fecha_finalizacion,
            g.fecha_de_publicacion,
            g.resumen_completo,
            g."Beneficiarios_Short",
            g.region_impacto,
            g.finalidad,
            g.sector,
            ge.embedding,
            COALESCE(p.popularity, 0) AS popularity
        FROM grants g
        LEFT JOIN grant_embeddings ge ON ge.grant_id = g.id
        LEFT JOIN popularity p ON p.grant_id = g.id
        WHERE g.id = ANY(%s)
          AND g.resumen_completo IS NOT NULL
          AND (g.fecha_finalizacion IS NULL OR g.fecha_finalizacion::date >= CURRENT_DATE)
        """,
        (list(candidate_ids),),
    )

    rows = []
    for row in cursor.fetchall():
        rows.append(
            {
                "id": int(row[0]),
                "titulo_corto": row[1],
                "presupuesto": row[2],
                "fecha_finalizacion": row[3],
                "fecha_de_publicacion": row[4],
                "resumen_completo": row[5],
                "beneficiarios_raw": row[6],
                "region_impacto": row[7],
                "finalidad": row[8],
                "sector": row[9],
                "grant_embedding": _parse_vector_value(row[10]),
                "popularity": _safe_float(row[11], 0.0),
            }
        )

    return rows


def _build_cf_map(cursor, liked_ids: Sequence[int], candidate_ids: Sequence[int]) -> Dict[int, float]:
    if not liked_ids or not candidate_ids:
        return {}

    cursor.execute(
        """
        SELECT grant_id_b, MAX(score)
        FROM item_cf_similarity
        WHERE grant_id_a = ANY(%s)
          AND grant_id_b = ANY(%s)
        GROUP BY grant_id_b
        """,
        (list(liked_ids), list(candidate_ids)),
    )
    return {int(row[0]): _safe_float(row[1], 0.0) for row in cursor.fetchall()}


def _metadata_match_score(grant: Dict[str, Any], profile: Dict[str, List[str]]) -> float:
    score = 0.0

    finalidad = _normalize_text(grant.get("finalidad"))
    region = _normalize_text(grant.get("region_impacto"))
    sector = _normalize_text(grant.get("sector"))
    beneficiarios_text = " ".join(_extract_beneficiarios_list(grant.get("beneficiarios_raw"))).lower()

    for idx, value in enumerate(profile.get("finalidad", [])[:5]):
        if _normalize_text(value) and _normalize_text(value) in finalidad:
            score += max(0.0, 1.0 - idx * 0.15)

    for idx, value in enumerate(profile.get("region_impacto", [])[:5]):
        if _normalize_text(value) and _normalize_text(value) in region:
            score += max(0.0, 0.9 - idx * 0.15)

    for idx, value in enumerate(profile.get("sector", [])[:5]):
        if _normalize_text(value) and _normalize_text(value) in sector:
            score += max(0.0, 0.8 - idx * 0.15)

    for idx, value in enumerate(profile.get("beneficiarios", [])[:5]):
        v = _normalize_text(value)
        if v and v in beneficiarios_text:
            score += max(0.0, 0.8 - idx * 0.15)

    return score


def _freshness_score(publication_date) -> float:
    d = _parse_date_like(publication_date)
    if not d:
        return 0.0
    days = (date.today() - d).days
    if days < 0:
        days = 0
    # ~1.0 when recent, decays with half-life ~120 days
    return math.exp(-days / 120.0)


def _normalize_popularity(popularity: float) -> float:
    if popularity <= 0:
        return 0.0
    return min(1.0, math.log1p(popularity) / 4.0)


def _compute_reason_codes(features: Dict[str, float]) -> List[str]:
    reasons: List[str] = []
    if features.get("content_similarity", 0.0) >= 0.35:
        reasons.append("content_similarity")
    if features.get("cf_score", 0.0) >= 0.25:
        reasons.append("collaborative_signal")
    if features.get("metadata_match", 0.0) >= 0.6:
        reasons.append("profile_match")
    if features.get("freshness", 0.0) >= 0.35:
        reasons.append("freshness")
    if features.get("popularity", 0.0) >= 0.25:
        reasons.append("popular")
    return reasons[:3]


def _score_candidate(
    grant: Dict[str, Any],
    *,
    profile_embedding: Optional[List[float]],
    profile: Dict[str, List[str]],
    cf_map: Dict[int, float],
    model,
    model_feature_names,
) -> Tuple[float, Dict[str, float], List[str]]:
    content_similarity = 0.0
    if profile_embedding and grant.get("grant_embedding"):
        content_similarity = max(0.0, _cosine_similarity(profile_embedding, grant["grant_embedding"]))

    cf_score = max(0.0, _safe_float(cf_map.get(grant["id"], 0.0), 0.0))
    metadata_score = _metadata_match_score(grant, profile)
    freshness = _freshness_score(grant.get("fecha_de_publicacion"))
    popularity = _normalize_popularity(_safe_float(grant.get("popularity"), 0.0))

    features = {
        "content_similarity": content_similarity,
        "cf_score": cf_score,
        "metadata_match": metadata_score,
        "freshness": freshness,
        "popularity": popularity,
    }

    model_score = _predict_with_model(model, model_feature_names, features)
    if model_score is None:
        model_score = (
            0.42 * content_similarity
            + 0.26 * cf_score
            + 0.18 * min(metadata_score, 1.0)
            + 0.09 * freshness
            + 0.05 * popularity
        )

    reasons = _compute_reason_codes(features)
    return float(model_score), features, reasons


# ---------------------------------------------------------------------------
# v2 recommender
# ---------------------------------------------------------------------------


def _get_recommended_grants_v2(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    ensure_recommendation_tables()

    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        entity_id = get_selected_entity_id_for_user(user_id, cursor=cursor)
        if not entity_id:
            return _get_default_grants(limit)

        preferences, _ = get_user_preferences(user_id)
        profile = _build_profile_from_preferences(preferences)

        # Cold-start enrichment from entity metadata
        entity_profile = _build_entity_metadata_profile(cursor, entity_id)
        for key, values in entity_profile.items():
            if values:
                profile.setdefault(key, [])
                existing = set(_normalize_text(v) for v in profile[key])
                for value in values:
                    nv = _normalize_text(value)
                    if nv and nv not in existing:
                        profile[key].append(value)
                        existing.add(nv)

        entity_state = _get_entity_state(cursor, entity_id)
        profile_embedding = entity_state.get("profile_embedding")
        if not profile_embedding:
            profile_embedding = _parse_vector_value(entity_state.get("profile_features", {}).get("profile_embedding"))

        liked_ids, disliked_ids, seen_ids = _get_liked_and_disliked_grants(cursor, entity_id)
        exclusions = list(set(seen_ids))

        # Candidate generation
        candidate_ids: List[int] = []

        emb_candidates = _fetch_embedding_candidates(
            cursor,
            profile_embedding,
            exclusions,
            min(DEFAULT_CANDIDATE_POOL, max(limit * 4, 120)),
        )
        candidate_ids.extend(emb_candidates)

        cf_candidates = _fetch_cf_candidates(
            cursor,
            liked_ids,
            exclusions + candidate_ids,
            min(DEFAULT_CANDIDATE_POOL, max(limit * 3, 90)),
        )
        candidate_ids.extend(cf_candidates)

        fresh_pop_candidates = _fetch_popular_fresh_candidates(
            cursor,
            exclusions + candidate_ids,
            min(DEFAULT_CANDIDATE_POOL, max(limit * 6, 180)),
        )
        candidate_ids.extend(fresh_pop_candidates)

        # Exploration
        if candidate_ids:
            exploration_candidates = _fetch_popular_fresh_candidates(
                cursor,
                exclusions + candidate_ids,
                max(5, int(limit * EXPLORATION_RATIO * 2)),
            )
            candidate_ids.extend(exploration_candidates)

        # Dedupe preserving order
        dedup_ids: List[int] = []
        seen = set()
        for gid in candidate_ids:
            if gid in seen:
                continue
            seen.add(gid)
            dedup_ids.append(gid)

        if not dedup_ids:
            return _get_default_grants(limit)

        dedup_ids = dedup_ids[: max(limit * 8, 220)]
        candidate_rows = _fetch_candidate_rows(cursor, dedup_ids)
        if not candidate_rows:
            return _get_default_grants(limit)

        candidate_row_by_id = {row["id"]: row for row in candidate_rows}
        candidate_ids_available = [gid for gid in dedup_ids if gid in candidate_row_by_id]

        cf_map = _build_cf_map(cursor, liked_ids, candidate_ids_available)
        model, model_feature_names = _load_active_model(cursor)

        ranked_rows: List[Tuple[float, Dict[str, Any], List[str]]] = []
        disliked_set = set(disliked_ids)

        for gid in candidate_ids_available:
            row = candidate_row_by_id[gid]
            if gid in disliked_set:
                # Hard filter: dislikes from this entity are excluded from ranking.
                continue

            score, _, reason_codes = _score_candidate(
                row,
                profile_embedding=profile_embedding,
                profile=profile,
                cf_map=cf_map,
                model=model,
                model_feature_names=model_feature_names,
            )
            ranked_rows.append((score, row, reason_codes))

        ranked_rows.sort(
            key=lambda x: (
                x[0],
                _safe_float(_freshness_score(x[1].get("fecha_de_publicacion")), 0.0),
            ),
            reverse=True,
        )

        result_rows = []
        for score, row, reasons in ranked_rows[:limit]:
            beneficiarios = ", ".join(_extract_beneficiarios_list(row.get("beneficiarios_raw")))
            result_rows.append(
                (
                    row["id"],
                    row["titulo_corto"],
                    row["presupuesto"],
                    row["fecha_finalizacion"],
                    row["fecha_de_publicacion"],
                    row["resumen_completo"],
                    beneficiarios,
                    row["region_impacto"],
                    float(score),
                    reasons,
                )
            )

        if not result_rows:
            return _get_default_grants(limit)

        return _format_grants_with_optional_score(result_rows)

    except Exception as e:
        logger.error("[RECO_V2] Error obteniendo recomendaciones: %s", e, exc_info=True)
        return _get_default_grants(limit)
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Public API used by Flask
# ---------------------------------------------------------------------------


def get_recommended_grants(user_id, limit=50):
    logger.info("[RECOMMENDATION] user_id=%s limit=%s engine=%s", user_id, limit, RECO_ENGINE)
    if RECO_ENGINE == "legacy":
        # Backward-compatible fallback
        return _get_default_grants(limit)
    return _get_recommended_grants_v2(user_id, limit=limit)


def rerank_marketplace_grants_v2(user_id: str, grants: List[Dict[str, Any]], entity_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Re-rank marketplace grants in-memory using the same v2 scoring features."""
    if not grants:
        return grants

    ensure_recommendation_tables()

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        resolved_entity = entity_id or get_selected_entity_id_for_user(user_id, cursor=cursor)
        if not resolved_entity:
            return grants

        preferences, _ = get_user_preferences(user_id)
        profile = _build_profile_from_preferences(preferences)
        entity_profile = _build_entity_metadata_profile(cursor, resolved_entity)
        for key, values in entity_profile.items():
            if values:
                profile.setdefault(key, [])
                existing = set(_normalize_text(v) for v in profile[key])
                for value in values:
                    nv = _normalize_text(value)
                    if nv and nv not in existing:
                        profile[key].append(value)
                        existing.add(nv)

        entity_state = _get_entity_state(cursor, resolved_entity)
        profile_embedding = entity_state.get("profile_embedding")

        liked_ids, disliked_ids, _ = _get_liked_and_disliked_grants(cursor, resolved_entity)
        disliked_set = set(disliked_ids)

        grant_ids = []
        for grant in grants:
            gid = grant.get("grant_id") or grant.get("id")
            try:
                grant_ids.append(int(str(gid)))
            except Exception:
                continue

        if not grant_ids:
            return grants

        cursor.execute(
            """
            WITH popularity AS (
                SELECT grant_id,
                       SUM(CASE
                               WHEN event_type = 'like' THEN 4
                               WHEN event_type = 'favorite_add' THEN 3
                               WHEN event_type = 'apply_click' THEN 6
                               WHEN event_type = 'detail_open' THEN 2
                               WHEN event_type = 'dislike' THEN -3
                               ELSE 0.1
                           END) AS popularity
                FROM reco_events
                WHERE timestamp >= NOW() - INTERVAL '90 days'
                GROUP BY grant_id
            )
            SELECT ge.grant_id, ge.embedding, COALESCE(p.popularity, 0)
            FROM grant_embeddings ge
            LEFT JOIN popularity p ON p.grant_id = ge.grant_id
            WHERE ge.grant_id = ANY(%s)
            """,
            (grant_ids,),
        )
        rows = cursor.fetchall()
        embedding_map = {int(row[0]): _parse_vector_value(row[1]) for row in rows}
        popularity_map = {int(row[0]): _safe_float(row[2], 0.0) for row in rows}

        cf_map = _build_cf_map(cursor, liked_ids, grant_ids)
        model, model_feature_names = _load_active_model(cursor)

        reranked: List[Dict[str, Any]] = []
        for grant in grants:
            gid_raw = grant.get("grant_id") or grant.get("id")
            try:
                gid = int(str(gid_raw))
            except Exception:
                gid = None

            if gid and gid in disliked_set:
                continue

            grant_row = {
                "id": gid,
                "finalidad": grant.get("finalidad"),
                "region_impacto": grant.get("region_impacto"),
                "sector": grant.get("sector"),
                "beneficiarios_raw": {"categorias": [grant.get("beneficiarios", "")]},
                "grant_embedding": embedding_map.get(gid) if gid else None,
                "fecha_de_publicacion": grant.get("fecha_de_publicacion") or grant.get("fecha_publicacion"),
                "popularity": popularity_map.get(gid, 0.0),
            }

            score, _, reasons = _score_candidate(
                grant_row,
                profile_embedding=profile_embedding,
                profile=profile,
                cf_map=cf_map,
                model=model,
                model_feature_names=model_feature_names,
            )

            grant_copy = dict(grant)
            grant_copy["reco_score"] = float(score)
            grant_copy["reason_codes"] = reasons
            reranked.append(grant_copy)

        reranked.sort(
            key=lambda x: (
                _safe_float(x.get("reco_score"), 0.0),
                _safe_float(x.get("numero_match"), 0.0),
            ),
            reverse=True,
        )
        return reranked
    except Exception as e:
        logger.warning("No se pudo rerankear marketplace con v2: %s", e)
        return grants
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def store_user_preference(grant_id, action, user_id):
    """
    Store or update user preference (entity-scoped).
    """
    ensure_recommendation_tables()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        if action not in ("interesa", "no interesa"):
            logger.warning("Acción inválida para preferencia: %s", action)
            return False

        entity_id = get_selected_entity_id_for_user(user_id, cursor=cursor)
        if entity_id is None:
            logger.warning(
                "No selected entity for user_id=%s. Preference not stored to avoid cross-entity drift.",
                user_id,
            )
            return False

        cursor.execute(
            """
            SELECT titulo_corto, resumen_completo, finalidad, region_impacto, "Beneficiarios_Short", sector
            FROM grants
            WHERE id = %s
            """,
            (grant_id,),
        )
        details = cursor.fetchone()
        if not details:
            logger.warning("No grant found for preference grant_id=%s", grant_id)
            return False

        titulo_corto, resumen_completo, finalidad, region_impacto, beneficiarios_raw, sector = details
        beneficiarios = beneficiarios_raw
        if isinstance(beneficiarios_raw, str):
            try:
                beneficiarios = json.loads(beneficiarios_raw)
            except Exception:
                beneficiarios = {"categorias": []}

        # Entity-scoped UPSERT (requires idx_ugp_user_entity_grant_unique)
        upsert_params = (
            str(user_id),
            int(grant_id),
            action,
            titulo_corto,
            resumen_completo,
            finalidad,
            region_impacto,
            Json(beneficiarios if isinstance(beneficiarios, dict) else {"categorias": []}),
            sector,
            str(entity_id),
        )
        try:
            cursor.execute(
                """
                INSERT INTO user_grant_preferences (
                    user_id,
                    grant_id,
                    action,
                    titulo_corto,
                    resumen_completo,
                    finalidad,
                    region_impacto,
                    beneficiarios,
                    sector,
                    entity_id,
                    timestamp
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (user_id, entity_id, grant_id)
                DO UPDATE SET
                    action = EXCLUDED.action,
                    titulo_corto = EXCLUDED.titulo_corto,
                    resumen_completo = EXCLUDED.resumen_completo,
                    finalidad = EXCLUDED.finalidad,
                    region_impacto = EXCLUDED.region_impacto,
                    beneficiarios = EXCLUDED.beneficiarios,
                    sector = EXCLUDED.sector,
                    timestamp = NOW()
                """,
                upsert_params,
            )
        except Exception:
            # Fallback when unique index/constraint is missing in legacy environments.
            conn.rollback()
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM user_grant_preferences
                WHERE user_id = %s AND entity_id = %s AND grant_id = %s
                """,
                (str(user_id), str(entity_id), int(grant_id)),
            )
            cursor.execute(
                """
                INSERT INTO user_grant_preferences (
                    user_id,
                    grant_id,
                    action,
                    titulo_corto,
                    resumen_completo,
                    finalidad,
                    region_impacto,
                    beneficiarios,
                    sector,
                    entity_id,
                    timestamp
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """,
                upsert_params,
            )

        # Mirror event stream
        event_type = "like" if action == "interesa" else "dislike"
        cursor.execute(
            """
            INSERT INTO reco_events (
                user_id, entity_id, grant_id, event_type, event_value, surface, metadata, timestamp
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                str(user_id),
                str(entity_id),
                int(grant_id),
                event_type,
                EVENT_WEIGHTS[event_type],
                "preference_api",
                Json({"source": "store_user_preference"}),
            ),
        )

        conn.commit()
        return True
    except Exception as e:
        logger.error("Error almacenando preferencia user_id=%s grant_id=%s: %s", user_id, grant_id, e, exc_info=True)
        if conn:
            conn.rollback()
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Offline jobs helpers
# ---------------------------------------------------------------------------


def rebuild_grant_embeddings(openai_client, model_name: str = "text-embedding-3-small", batch_size: int = 64) -> int:
    """Build/update grant embeddings table from grants content."""
    ensure_recommendation_tables()
    conn = None
    cursor = None

    processed = 0
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT g.id, g.titulo_corto, g.resumen_completo, g.finalidad, g.region_impacto, g.sector
            FROM grants g
            WHERE g.resumen_completo IS NOT NULL
              AND (g.fecha_finalizacion IS NULL OR g.fecha_finalizacion::date >= CURRENT_DATE)
            ORDER BY g.id DESC
            """
        )
        rows = cursor.fetchall()

        def _grant_text(row) -> str:
            return "\n".join(
                [
                    f"titulo: {row[1] or ''}",
                    f"resumen: {row[2] or ''}",
                    f"finalidad: {row[3] or ''}",
                    f"region: {row[4] or ''}",
                    f"sector: {row[5] or ''}",
                ]
            )

        for start in range(0, len(rows), batch_size):
            batch = rows[start : start + batch_size]
            texts = [_grant_text(r) for r in batch]
            response = openai_client.embeddings.create(model=model_name, input=texts)
            embeddings = [item.embedding for item in response.data]

            for row, emb in zip(batch, embeddings):
                cursor.execute(
                    """
                    INSERT INTO grant_embeddings (grant_id, embedding, model_name, source_hash, updated_at)
                    VALUES (%s, %s::vector, %s, %s, NOW())
                    ON CONFLICT (grant_id)
                    DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        model_name = EXCLUDED.model_name,
                        source_hash = EXCLUDED.source_hash,
                        updated_at = NOW()
                    """,
                    (
                        int(row[0]),
                        _vector_to_pg(emb),
                        model_name,
                        str(hash(texts[batch.index(row)])),
                    ),
                )
                processed += 1

        conn.commit()
        return processed
    except Exception as e:
        logger.error("Error rebuilding grant embeddings: %s", e, exc_info=True)
        if conn:
            conn.rollback()
        return processed
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def refresh_item_cf_similarity(min_support: int = 2, top_k: int = 40) -> int:
    """Refresh item-item collaborative similarity from entity likes."""
    ensure_recommendation_tables()
    conn = None
    cursor = None

    inserted = 0
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("TRUNCATE TABLE item_cf_similarity")

        cursor.execute(
            """
            WITH likes AS (
                SELECT DISTINCT entity_id, grant_id
                FROM user_grant_preferences
                WHERE action = 'interesa'
            ),
            pairs AS (
                SELECT l1.grant_id AS a,
                       l2.grant_id AS b,
                       COUNT(*) AS co_count
                FROM likes l1
                JOIN likes l2
                  ON l1.entity_id = l2.entity_id
                 AND l1.grant_id <> l2.grant_id
                GROUP BY l1.grant_id, l2.grant_id
                HAVING COUNT(*) >= %s
            ),
            norms AS (
                SELECT grant_id, COUNT(*)::float AS likes_count
                FROM likes
                GROUP BY grant_id
            ),
            scored AS (
                SELECT
                    p.a,
                    p.b,
                    p.co_count / NULLIF(SQRT(n1.likes_count * n2.likes_count), 0) AS sim,
                    ROW_NUMBER() OVER (PARTITION BY p.a ORDER BY p.co_count / NULLIF(SQRT(n1.likes_count * n2.likes_count), 0) DESC) AS rn
                FROM pairs p
                JOIN norms n1 ON n1.grant_id = p.a
                JOIN norms n2 ON n2.grant_id = p.b
            )
            INSERT INTO item_cf_similarity (grant_id_a, grant_id_b, score, updated_at)
            SELECT a, b, sim, NOW()
            FROM scored
            WHERE rn <= %s
            """,
            (min_support, top_k),
        )

        inserted = cursor.rowcount if cursor.rowcount else 0
        conn.commit()
        return inserted
    except Exception as e:
        logger.error("Error refreshing CF similarity: %s", e, exc_info=True)
        if conn:
            conn.rollback()
        return inserted
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def refresh_reco_entity_state() -> int:
    """Recompute per-entity summary profile in reco_entity_state."""
    ensure_recommendation_tables()

    conn = None
    cursor = None
    updated = 0

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT DISTINCT entity_id FROM user_entities")
        entity_ids = [str(row[0]) for row in cursor.fetchall() if row and row[0] is not None]

        for entity_id in entity_ids:
            cursor.execute(
                """
                SELECT finalidad, region_impacto, beneficiarios, sector
                FROM user_grant_preferences
                WHERE entity_id = %s AND action = 'interesa'
                """,
                (entity_id,),
            )
            rows = cursor.fetchall()

            finalidades: List[str] = []
            regiones: List[str] = []
            beneficiarios: List[str] = []
            sectores: List[str] = []

            for finalidad, region, benef, sector in rows:
                if finalidad:
                    finalidades.append(str(finalidad))
                if region:
                    regiones.append(str(region))
                if benef:
                    beneficiarios.extend(_extract_beneficiarios_list(benef))
                if sector:
                    if isinstance(sector, str) and "," in sector:
                        sectores.extend([s.strip() for s in sector.split(",") if s.strip()])
                    else:
                        sectores.append(str(sector))

            def _top(vals: List[str]) -> List[str]:
                return [x for x, _ in Counter(vals).most_common(6)]

            cursor.execute(
                """
                INSERT INTO reco_entity_state (
                    entity_id,
                    profile_features,
                    top_finalidades,
                    top_regiones,
                    top_beneficiarios,
                    top_sectores,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (entity_id)
                DO UPDATE SET
                    profile_features = EXCLUDED.profile_features,
                    top_finalidades = EXCLUDED.top_finalidades,
                    top_regiones = EXCLUDED.top_regiones,
                    top_beneficiarios = EXCLUDED.top_beneficiarios,
                    top_sectores = EXCLUDED.top_sectores,
                    updated_at = NOW()
                """,
                (
                    entity_id,
                    Json(
                        {
                            "likes_count": len(rows),
                            "updated_at": datetime.utcnow().isoformat(),
                        }
                    ),
                    _top(finalidades),
                    _top(regiones),
                    _top(beneficiarios),
                    _top(sectores),
                ),
            )
            updated += 1

        conn.commit()
        return updated
    except Exception as e:
        logger.error("Error refreshing reco_entity_state: %s", e, exc_info=True)
        if conn:
            conn.rollback()
        return updated
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def train_ranker_model(artifact_path: str, model_version: str, activate: bool = True) -> bool:
    """
    Train a lightweight ranking model from event logs.
    Falls back gracefully when LightGBM is unavailable.
    """
    ensure_recommendation_tables()

    conn = None
    cursor = None

    try:
        import joblib  # type: ignore
    except Exception:
        logger.error("joblib no está disponible para entrenar el ranker")
        return False

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Build simple training set from events aggregated by entity/grant.
        cursor.execute(
            """
            WITH agg AS (
                SELECT
                    entity_id,
                    grant_id,
                    SUM(CASE WHEN event_type = 'like' THEN 1 ELSE 0 END) AS likes,
                    SUM(CASE WHEN event_type = 'detail_open' THEN 1 ELSE 0 END) AS opens,
                    SUM(CASE WHEN event_type = 'favorite_add' THEN 1 ELSE 0 END) AS favs,
                    SUM(CASE WHEN event_type = 'apply_click' THEN 1 ELSE 0 END) AS applies,
                    SUM(CASE WHEN event_type = 'dislike' THEN 1 ELSE 0 END) AS dislikes,
                    COUNT(*) AS events
                FROM reco_events
                WHERE entity_id IS NOT NULL
                GROUP BY entity_id, grant_id
            )
            SELECT
                likes,
                opens,
                favs,
                applies,
                dislikes,
                events,
                (likes * 4 + favs * 3 + applies * 6 + opens - dislikes * 4)::float AS target
            FROM agg
            """
        )

        rows = cursor.fetchall()
        if len(rows) < 20:
            logger.warning("No hay suficientes datos para entrenar ranker (%s filas)", len(rows))
            return False

        X = [[_safe_float(v) for v in row[:6]] for row in rows]
        y = [_safe_float(row[6]) for row in rows]

        model = None
        feature_names = ["likes", "opens", "favs", "applies", "dislikes", "events"]

        try:
            import lightgbm as lgb  # type: ignore

            model = lgb.LGBMRegressor(
                objective="regression",
                n_estimators=180,
                learning_rate=0.05,
                max_depth=6,
                subsample=0.85,
                colsample_bytree=0.85,
            )
            model.fit(X, y)
            model_type = "lightgbm_regressor"
        except Exception:
            # Lightweight fallback model: normalized linear rule persisted as metadata.
            weights = {
                "likes": 4.0,
                "opens": 1.0,
                "favs": 3.0,
                "applies": 6.0,
                "dislikes": -4.0,
                "events": 0.15,
            }
            model = {"kind": "heuristic_linear", "weights": weights, "feature_names": feature_names}
            model_type = "heuristic_linear"

        Path(artifact_path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, artifact_path)

        if activate:
            cursor.execute("UPDATE reco_model_registry SET is_active = FALSE")

        cursor.execute(
            """
            INSERT INTO reco_model_registry (
                model_version,
                model_type,
                artifact_path,
                metrics,
                feature_names,
                is_active,
                created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (model_version)
            DO UPDATE SET
                model_type = EXCLUDED.model_type,
                artifact_path = EXCLUDED.artifact_path,
                metrics = EXCLUDED.metrics,
                feature_names = EXCLUDED.feature_names,
                is_active = EXCLUDED.is_active,
                created_at = NOW()
            """,
            (
                model_version,
                model_type,
                artifact_path,
                Json({"rows": len(rows)}),
                feature_names,
                bool(activate),
            ),
        )

        conn.commit()
        _MODEL_CACHE["version"] = None
        _MODEL_CACHE["model"] = None
        _MODEL_CACHE["feature_names"] = None
        return True
    except Exception as e:
        logger.error("Error training ranker model: %s", e, exc_info=True)
        if conn:
            conn.rollback()
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


__all__ = [
    "ensure_recommendation_tables",
    "get_selected_entity_id_for_user",
    "select_user_entity",
    "record_reco_event",
    "get_user_preferences",
    "get_recommended_grants",
    "rerank_marketplace_grants_v2",
    "store_user_preference",
    "rebuild_grant_embeddings",
    "refresh_item_cf_similarity",
    "refresh_reco_entity_state",
    "train_ranker_model",
]
