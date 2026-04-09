import sys, os, json, re
from datetime import datetime, date, timedelta
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.postgreSQL import get_connection
from utils.recommendation_model import rerank_marketplace_grants_v2
from src.Modules.logger_config import get_logger

logger = get_logger(__name__)


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

    return None


def _normalize_marketplace_search_text(value):
    if value is None:
        return ""

    text = str(value).replace("\xa0", " ").strip().lower()
    if not text:
        return ""

    # Normaliza puntuación/símbolos (incluye comillas tipográficas) para búsquedas robustas.
    text = re.sub(r"[\"'`´‘’“”«»]", " ", text)
    text = re.sub(r"[^0-9a-záéíóúüñ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _build_marketplace_search_tokens(normalized_query: str):
    if not normalized_query:
        return []
    stopwords = {
        "de", "del", "la", "las", "el", "los", "y", "e", "o", "u",
        "para", "por", "con", "sin", "en", "un", "una", "unos", "unas",
    }
    tokens = []
    for token in normalized_query.split(" "):
        t = token.strip()
        if not t:
            continue
        if t in stopwords:
            continue
        # Evita ruido por tokens muy cortos (p.ej. "tu"), salvo alfanuméricos significativos.
        if len(t) >= 3 or (len(t) >= 2 and any(ch.isdigit() for ch in t)):
            tokens.append(t)
    return tokens

class GrantSearch:
    @staticmethod
    def search_marketplace(user_id, beneficiarios, regiones, finalidades,
                           administraciones_convocantes, tipos_ayuda, amount_min, amount_max, fecha_inicio, fecha_cierre, order_by, sort_direction,
                           search_query, page, limit):

        try:
            try:
                page = max(1, int(page or 1))
            except (TypeError, ValueError):
                page = 1

            try:
                limit = int(limit or 20)
                limit = max(1, min(limit, 100))
            except (TypeError, ValueError):
                limit = 20

            def _clean_filter_values(values):
                if not values:
                    return []
                cleaned = []
                seen = set()
                for value in values:
                    if value is None:
                        continue
                    text = str(value).strip()
                    if not text:
                        continue
                    key = text.casefold()
                    if key in seen:
                        continue
                    seen.add(key)
                    cleaned.append(text)
                return cleaned

            beneficiarios = _clean_filter_values(beneficiarios)
            regiones = _clean_filter_values(regiones)
            finalidades = _clean_filter_values(finalidades)
            administraciones_convocantes = _clean_filter_values(administraciones_convocantes)
            tipos_ayuda = _clean_filter_values(tipos_ayuda)
            try:
                amount_min = float(amount_min) if amount_min is not None else None
            except (TypeError, ValueError):
                amount_min = None
            try:
                amount_max = float(amount_max) if amount_max is not None else None
            except (TypeError, ValueError):
                amount_max = None
            if amount_min is not None and amount_max is not None and amount_min > amount_max:
                amount_min, amount_max = amount_max, amount_min
            fecha_inicio = _parse_date_like(fecha_inicio)
            fecha_cierre = _parse_date_like(fecha_cierre)
            if fecha_inicio and fecha_cierre and fecha_inicio > fecha_cierre:
                fecha_inicio, fecha_cierre = fecha_cierre, fecha_inicio

            conn = get_connection()
            cur = conn.cursor()
            logger.info("Connected to the database successfully for marketplace search.")

            def _grants_has_column(column_name: str) -> bool:
                cur.execute(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'grants'
                      AND column_name = %s
                    LIMIT 1
                    """,
                    (column_name,),
                )
                return cur.fetchone() is not None

            has_fecha_inicio_col = _grants_has_column("fecha_de_inicio")
            has_fecha_finalizacion_col = _grants_has_column("fecha_finalizacion")
            has_titulo_col = _grants_has_column("titulo")
            titulo_oficial_sql = "COALESCE(g.titulo, '')" if has_titulo_col else "''"
            titulo_corto_normalized_expr = (
                "LOWER(regexp_replace(COALESCE(g.titulo_corto, ''), '[^[:alnum:]áéíóúüñ]+', ' ', 'g'))"
            )
            titulo_oficial_normalized_expr = (
                f"LOWER(regexp_replace({titulo_oficial_sql}, '[^[:alnum:]áéíóúüñ]+', ' ', 'g'))"
            )

            # --- Obtener entity_id seleccionado ---
            entity_id = None
            if user_id:
                cur.execute("""
                    SELECT ue.entity_id
                    FROM user_entities ue
                    WHERE ue.user_id = %s
                    AND ue.is_selected IS TRUE
                    LIMIT 1;
                """, (user_id,))
                r = cur.fetchone()
                if r:
                    entity_id = r[0]

            # --- Obtener preferencias del usuario ---
            user_preferences = {}
            if user_id:
                try:
                    # Get user's preferred finalidades from their liked grants
                    cur.execute("""
                        SELECT finalidad, COUNT(*) as count
                        FROM user_grant_preferences
                        WHERE user_id = %s AND action = 'interesa' AND finalidad IS NOT NULL
                        GROUP BY finalidad
                        ORDER BY count DESC
                        LIMIT 5
                    """, (user_id,))
                    finalidades_preferred = [row[0] for row in cur.fetchall()]

                    # Get user's preferred regions from their liked grants
                    cur.execute("""
                        SELECT region_impacto, COUNT(*) as count
                        FROM user_grant_preferences
                        WHERE user_id = %s AND action = 'interesa' AND region_impacto IS NOT NULL
                        GROUP BY region_impacto
                        ORDER BY count DESC
                        LIMIT 5
                    """, (user_id,))
                    regiones_preferred = [row[0] for row in cur.fetchall()]

                    # Get user's preferred sectors from their liked grants
                    cur.execute("""
                        SELECT sector, COUNT(*) as count
                        FROM user_grant_preferences
                        WHERE user_id = %s AND action = 'interesa' AND sector IS NOT NULL
                        GROUP BY sector
                        ORDER BY count DESC
                        LIMIT 5
                    """, (user_id,))
                    sectores_preferred = [row[0] for row in cur.fetchall()]

                    # Get user's preferred beneficiarios from their liked grants
                    cur.execute("""
                        SELECT jsonb_array_elements_text(beneficiarios->'categorias') as beneficiario, COUNT(*) as count
                        FROM user_grant_preferences
                        WHERE user_id = %s AND action = 'interesa' AND beneficiarios IS NOT NULL
                        GROUP BY beneficiario
                        ORDER BY count DESC
                        LIMIT 5
                    """, (user_id,))
                    beneficiarios_preferred = [row[0] for row in cur.fetchall()]

                    user_preferences = {
                        'finalidades': finalidades_preferred,
                        'regiones': regiones_preferred,
                        'sectores': sectores_preferred,
                        'beneficiarios': beneficiarios_preferred
                    }

                    logger.info(f"User preferences detected: {user_preferences}")
                except Exception as e:
                    logger.error(f"Error al obtener preferencias del usuario: {e}")
                    user_preferences = {'finalidades': [], 'regiones': [], 'sectores': [], 'beneficiarios': []}

            clean_search_query = search_query.strip() if isinstance(search_query, str) else ""
            normalized_search_query = _normalize_marketplace_search_text(clean_search_query)
            search_tokens = _build_marketplace_search_tokens(normalized_search_query)

            # --- Filtros base ---
            # Sin query: mantener quality gate actual.
            # Con query: permitir resultados por título aunque falte metadato derivado.
            if has_titulo_col:
                title_presence_clause = "(COALESCE(NULLIF(g.titulo_corto, ''), NULLIF(g.titulo, '')) IS NOT NULL)"
            else:
                title_presence_clause = "(g.titulo_corto IS NOT NULL AND g.titulo_corto <> '')"

            where_clauses = [title_presence_clause]

            if clean_search_query:
                logger.info(
                    "Text search detected; relaxing completeness filters for explicit title search."
                )
            else:
                where_clauses.extend(
                    [
                        "g.resumen_completo IS NOT NULL",
                        """g."Beneficiarios_Short" IS NOT NULL""",
                        """g."Beneficiarios_Short"::text NOT IN ('{}', '{"categorias": []}', '')""",
                        "g.region_impacto IS NOT NULL",
                        "g.region_impacto <> ''",
                    ]
                )

            base_params = [entity_id]
            filter_params = []

            select_part = """
                SELECT
                    g.id::text AS grant_id,
                    g.titulo_corto,
                    g.presupuesto,
                    g.importe_beneficiario,
                    g.fecha_finalizacion,
                    g.resumen_completo,
                    g."Beneficiarios_Short",
                    g.region_impacto,
                    g.finalidad,
                    g.fecha_de_publicacion,
                    m.numero_match
                FROM grants g
                LEFT JOIN LATERAL (
                    SELECT numero_match
                    FROM matches
                    WHERE matches.grant_id = g.id
                    AND matches.entity_id = %s
                    ORDER BY numero_match DESC
                    LIMIT 1
                ) m ON TRUE
            """
            # Replica el parser del frontend (extrae números de `presupuesto` y toma el mayor).
            budget_numeric_expr = """
                (
                    SELECT MAX((REPLACE(REPLACE(match_num[1], '.', ''), ',', '.'))::numeric)
                    FROM regexp_matches(COALESCE(g.presupuesto::text, ''), '(\\d[\\d.,]*)', 'g') AS match_num
                )
            """

            # --- BENEFICIARIOS ---
            if beneficiarios:
                logger.info(f"Filtering by beneficiarios (received): {beneficiarios}")
                # Map slugs to actual DB values (matching frontend values)
                beneficiarios_map = {
                    'pyme': 'Pyme',
                    'autonomo': 'Autónomo',
                    'gran-empresa': 'Gran Empresa',
                    'entidad-sin-animo-de-lucro': 'Entidad (sin ánimo lucro)',
                    'asociacion': 'Asociación',
                }
                beneficiarios_db = []
                for b in beneficiarios:
                    # Map to DB value with proper accents
                    mapped = beneficiarios_map.get(b.lower(), b)
                    beneficiarios_db.append(mapped)

                logger.info(f"Filtering by beneficiarios (mapped to DB): {beneficiarios_db}")
                beneficiarios_conditions = []
                for b in beneficiarios_db:
                    beneficiarios_conditions.append('(g."Beneficiarios_Short" @> %s::jsonb OR g."Beneficiarios_Short"::text ILIKE %s)')
                    filter_params.append(json.dumps({"categorias": [b]}))
                    filter_params.append(f'%{b}%')
                where_clauses.append("(" + " OR ".join(beneficiarios_conditions) + ")")

            # --- REGIONES ---
            if regiones:
                logger.info(f"Filtering by regiones (received): {regiones}")
                # Map slugs to actual DB values (with proper Spanish accents)
                regiones_map = {
                    # CCAA
                    'andalucia': 'Andalucía',
                    'aragon': 'Aragón',
                    'asturias': 'Asturias',
                    'illes-balears': 'Illes Balears',
                    'canarias': 'Canarias',
                    'cantabria': 'Cantabria',
                    'castilla-la-mancha': 'Castilla-La Mancha',
                    'castilla-y-leon': 'Castilla y León',
                    'cataluna': 'Cataluña',
                    'comunitat-valenciana': 'Comunitat Valenciana',
                    'extremadura': 'Extremadura',
                    'galicia': 'Galicia',
                    'comunidad-de-madrid': 'Comunidad de Madrid',
                    'region-de-murcia': 'Región de Murcia',
                    'navarra': 'Comunidad Foral de Navarra',
                    'pais-vasco': 'País Vasco',
                    'la-rioja': 'La Rioja',
                    'ceuta': 'Ceuta',
                    'melilla': 'Melilla',
                    # Provinces
                    'almeria': 'Almería',
                    'cadiz': 'Cádiz',
                    'cordoba': 'Córdoba',
                    'granada': 'Granada',
                    'huelva': 'Huelva',
                    'jaen': 'Jaén',
                    'malaga': 'Málaga',
                    'sevilla': 'Sevilla',
                    'huesca': 'Huesca',
                    'teruel': 'Teruel',
                    'zaragoza': 'Zaragoza',
                    'las-palmas': 'Las Palmas',
                    'santa-cruz-de-tenerife': 'Santa Cruz de Tenerife',
                    'albacete': 'Albacete',
                    'ciudad-real': 'Ciudad Real',
                    'cuenca': 'Cuenca',
                    'guadalajara': 'Guadalajara',
                    'toledo': 'Toledo',
                    'avila': 'Ávila',
                    'burgos': 'Burgos',
                    'leon': 'León',
                    'palencia': 'Palencia',
                    'salamanca': 'Salamanca',
                    'segovia': 'Segovia',
                    'soria': 'Soria',
                    'valladolid': 'Valladolid',
                    'zamora': 'Zamora',
                    'barcelona': 'Barcelona',
                    'girona': 'Girona',
                    'lleida': 'Lleida',
                    'tarragona': 'Tarragona',
                    'alicante': 'Alicante',
                    'castellon': 'Castellón',
                    'valencia': 'Valencia',
                    'badajoz': 'Badajoz',
                    'caceres': 'Cáceres',
                    'a-coruna': 'A Coruña',
                    'lugo': 'Lugo',
                    'ourense': 'Ourense',
                    'pontevedra': 'Pontevedra',
                    'madrid': 'Madrid',
                    'murcia': 'Murcia',
                    'alava': 'Álava',
                    'bizkaia': 'Bizkaia',
                    'gipuzkoa': 'Gipuzkoa',
                }
                regiones_db = []
                for r in regiones:
                    # Strip prefix (ccaa: or prov:) if present
                    r_clean = r.split(':', 1)[1] if ':' in r else r
                    # Map to DB value with proper accents
                    mapped = regiones_map.get(r_clean.lower(), r_clean)
                    regiones_db.append(mapped)

                logger.info(f"Filtering by regiones (mapped to DB): {regiones_db}")
                regiones_conditions = []
                for region in regiones_db:
                    regiones_conditions.append("g.region_impacto ILIKE %s")
                    filter_params.append(f'%{region}%')
                where_clauses.append("(" + " OR ".join(regiones_conditions) + ")")

            # --- FINALIDADES ---
            if finalidades:
                logger.info(f"Filtering by finalidades (received): {finalidades}")
                # Map slugs to actual DB values (matching frontend values)
                finalidades_map = {
                    'acceso-vivienda': 'Acceso a la vivienda y fomento de la edificación',
                    'comercio-turismo-pymes': 'Comercio, Turismo y Pymes',
                    'desempleo': 'Desempleo',
                    'fomento-empleo': 'Fomento del Empleo',
                    'industria-energia': 'Industria y Energía',
                    'infraestructuras': 'Infraestructuras',
                    'investigacion-desarrollo-innovacion': 'Investigación, desarrollo e innovación',
                    'otras-actuaciones-economicas': 'Otras actuaciones de carácter económico',
                    'otras-prestaciones-economicas': 'Otras Prestaciones económicas',
                    'subvenciones-transporte': 'Subvenciones al transporte',
                }

                finalidades_db = []
                for f in finalidades:
                    # Map to DB value with proper accents
                    mapped = finalidades_map.get(f.lower(), f)
                    finalidades_db.append(mapped)

                logger.info(f"Filtering by finalidades (mapped to DB): {finalidades_db}")
                finalidades_conditions = []
                for finalidad in finalidades_db:
                    finalidades_conditions.append("g.finalidad ILIKE %s")
                    filter_params.append(f'%{finalidad}%')
                where_clauses.append("(" + " OR ".join(finalidades_conditions) + ")")

            # --- ADMINISTRACIÓN CONVOCANTE ---
            if administraciones_convocantes:
                logger.info(f"Filtering by administraciones_convocantes (received): {administraciones_convocantes}")
                admin_conditions = []
                for admin in administraciones_convocantes:
                    admin_conditions.append("g.administracion_convocante ILIKE %s")
                    filter_params.append(f'%{admin}%')
                where_clauses.append("(" + " OR ".join(admin_conditions) + ")")

            # --- TIPO DE AYUDA ---
            if tipos_ayuda:
                logger.info(f"Filtering by tipos_ayuda (received): {tipos_ayuda}")
                tipo_conditions = []
                for tipo in tipos_ayuda:
                    tipo_conditions.append("g.tipo_ayuda ILIKE %s")
                    filter_params.append(f'%{tipo}%')
                where_clauses.append("(" + " OR ".join(tipo_conditions) + ")")

            # --- IMPORTE (franja min/max) ---
            if amount_min is not None or amount_max is not None:
                min_value = 0.0 if amount_min is None else max(0.0, amount_min)
                max_value = amount_max
                if max_value is not None and max_value < 0:
                    max_value = 0.0

                if max_value is None:
                    where_clauses.append(f"{budget_numeric_expr} >= %s")
                    filter_params.append(min_value)
                else:
                    where_clauses.append(f"{budget_numeric_expr} BETWEEN %s AND %s")
                    filter_params.extend([min_value, max_value])

            # --- FECHAS (inicio / cierre) ---
            if fecha_inicio:
                if has_fecha_inicio_col:
                    where_clauses.append("g.fecha_de_inicio IS NOT NULL AND g.fecha_de_inicio >= %s")
                    filter_params.append(fecha_inicio)
                else:
                    logger.warning("Se ignoró filtro fecha_inicio: columna grants.fecha_de_inicio no existe.")
            if fecha_cierre:
                if has_fecha_finalizacion_col:
                    where_clauses.append("g.fecha_finalizacion IS NOT NULL AND g.fecha_finalizacion <= %s")
                    filter_params.append(fecha_cierre)
                else:
                    logger.warning("Se ignoró filtro fecha_cierre: columna grants.fecha_finalizacion no existe.")

            # --- TEXT SEARCH ---
            if clean_search_query:
                raw_contains = f"%{clean_search_query}%"
                text_search_conditions = [
                    "COALESCE(g.titulo_corto, '') ILIKE %s",
                    f"{titulo_oficial_sql} ILIKE %s",
                ]
                text_search_params = [raw_contains, raw_contains]

                if normalized_search_query:
                    normalized_contains = f"%{normalized_search_query}%"
                    text_search_conditions.extend(
                        [
                            f"{titulo_corto_normalized_expr} LIKE %s",
                            f"{titulo_oficial_normalized_expr} LIKE %s",
                        ]
                    )
                    text_search_params.extend([normalized_contains, normalized_contains])

                    token_conditions = []
                    for token in search_tokens:
                        token_pattern = f"%{token}%"
                        token_conditions.extend(
                            [
                                f"{titulo_corto_normalized_expr} LIKE %s",
                                f"{titulo_oficial_normalized_expr} LIKE %s",
                            ]
                        )
                        text_search_params.extend([token_pattern, token_pattern])

                    if token_conditions:
                        text_search_conditions.append("(" + " OR ".join(token_conditions) + ")")

                where_clauses.append("(" + " OR ".join(text_search_conditions) + ")")
                filter_params.extend(text_search_params)

            logger.info(f"Search query: {clean_search_query}")
            logger.info(
                "Search query normalized: '%s' | tokens=%s",
                normalized_search_query,
                search_tokens,
            )
            logger.info(f"Date filter window: fecha_inicio={fecha_inicio}, fecha_cierre={fecha_cierre}")

            # --- QUERY FINAL ---
            # No need for GROUP BY since LATERAL join already limits to 1 row per grant
            query = select_part + " WHERE " + " AND ".join(where_clauses)

            params = base_params + filter_params
            order_params = []

            # --- ORDERING ---
            logger.info(f"Ordering mode: {order_by}, direction: {sort_direction}")
            if order_by not in {'preferences', 'match', 'amount', 'deadline'}:
                order_by = 'preferences'
            if sort_direction not in {'asc', 'desc'}:
                sort_direction = 'desc'

            should_rerank_with_v2 = order_by == 'preferences' and not clean_search_query
            retrieval_limit = None
            direction_sql = "ASC" if sort_direction == 'asc' else "DESC"
            deadline_direction_sql = "DESC" if sort_direction == 'desc' else "ASC"

            if order_by == 'match':
                logger.info("🔴 ORDERING BY MATCH")
                query += f" ORDER BY COALESCE(numero_match, 0) {direction_sql}, g.fecha_de_publicacion DESC NULLS LAST"
            elif order_by == 'amount':
                logger.info("🟠 ORDERING BY AMOUNT")
                query += f"""
                    ORDER BY
                        {budget_numeric_expr} {direction_sql} NULLS LAST,
                        COALESCE(numero_match, 0) DESC,
                        g.fecha_de_publicacion DESC NULLS LAST
                """
            elif order_by == 'deadline':
                logger.info("🟡 ORDERING BY DEADLINE")
                if has_fecha_finalizacion_col:
                    query += f"""
                        ORDER BY
                            g.fecha_finalizacion {deadline_direction_sql} NULLS LAST,
                            COALESCE(numero_match, 0) DESC,
                            g.fecha_de_publicacion DESC NULLS LAST
                    """
                else:
                    logger.info("fecha_finalizacion column missing; falling back to publication date DESC")
                    query += " ORDER BY g.fecha_de_publicacion DESC NULLS LAST"
            else:
                if clean_search_query:
                    # Si el usuario busca texto explícito, priorizamos coincidencia textual directa
                    # y evitamos exclusiones del reranker (p.ej., grants marcadas como dislike).
                    logger.info("🟢 ORDERING BY TEXT MATCH (explicit search query, v2 rerank disabled)")
                    query += f"""
                        ORDER BY
                            CASE
                                WHEN COALESCE(g.titulo_corto, '') ILIKE %s THEN 0
                                WHEN {titulo_oficial_sql} ILIKE %s THEN 1
                                WHEN COALESCE(g.titulo_corto, '') ILIKE %s THEN 2
                                WHEN {titulo_oficial_sql} ILIKE %s THEN 3
                                WHEN {titulo_corto_normalized_expr} = %s THEN 4
                                WHEN {titulo_oficial_normalized_expr} = %s THEN 5
                                WHEN {titulo_corto_normalized_expr} LIKE %s THEN 6
                                WHEN {titulo_oficial_normalized_expr} LIKE %s THEN 7
                                ELSE 8
                            END {direction_sql},
                            COALESCE(numero_match, 0) DESC,
                            g.fecha_de_publicacion DESC NULLS LAST
                    """
                    raw_starts_with = f"{clean_search_query}%"
                    raw_contains = f"%{clean_search_query}%"
                    normalized_contains = f"%{normalized_search_query}%" if normalized_search_query else raw_contains
                    order_params.extend(
                        [
                            clean_search_query,
                            clean_search_query,
                            raw_starts_with,
                            raw_starts_with,
                            normalized_search_query or clean_search_query.lower(),
                            normalized_search_query or clean_search_query.lower(),
                            normalized_contains,
                            normalized_contains,
                        ]
                    )
                else:
                    # v2 ranking is applied in-memory; SQL keeps broad, recent-first candidate pool.
                    logger.info("🟢 ORDERING BY RECENCY CANDIDATE POOL (v2 rerank enabled)")
                    query += " ORDER BY g.fecha_de_publicacion DESC NULLS LAST"

            params.extend(order_params)

            # --- PAGINACIÓN ---
            offset = (page - 1) * limit
            if should_rerank_with_v2:
                # Pull a broader candidate pool, then apply v2 ranking and slice.
                retrieval_limit = min(1200, max(200, page * limit * 6))
                query += " LIMIT %s"
                params.append(retrieval_limit)
            else:
                query += " LIMIT %s OFFSET %s"
                params.extend([limit, offset])

            logger.info("=== MARKETPLACE SEARCH ===")
            logger.info(f"Final SQL query: {query}")
            logger.info(f"With parameters: {params}")



            # --- EJECUTAR ---
            cur.execute(query, tuple(params))
            rows = cur.fetchall()

            grants = []
            for row in rows:
                # Extraer beneficiarios del JSONB
                beneficiarios_jsonb = row[6]
                beneficiarios_value = "No especificado"

                try:
                    if beneficiarios_jsonb:
                        # Si es un dict de Python (ya parseado por psycopg2)
                        if isinstance(beneficiarios_jsonb, dict):
                            categorias = beneficiarios_jsonb.get('categorias', [])
                            if categorias:
                                # Verificar que categorias sea una lista
                                if isinstance(categorias, list):
                                    beneficiarios_value = ', '.join(str(c) for c in categorias)
                                elif isinstance(categorias, str):
                                    # Si es un string único, usarlo directamente
                                    beneficiarios_value = categorias
                        # Si es un string JSON
                        elif isinstance(beneficiarios_jsonb, str):
                            try:
                                data = json.loads(beneficiarios_jsonb)
                                categorias = data.get('categorias', [])
                                if categorias:
                                    # Verificar que categorias sea una lista
                                    if isinstance(categorias, list):
                                        beneficiarios_value = ', '.join(str(c) for c in categorias)
                                    elif isinstance(categorias, str):
                                        # Si es un string único, usarlo directamente
                                        beneficiarios_value = categorias
                            except:
                                pass

                    logger.info(f"Grant {row[0]}: Beneficiarios_Short = {beneficiarios_jsonb}, extracted = '{beneficiarios_value}', type = {type(beneficiarios_value)}")

                except Exception as e:
                    logger.error(f"Error processing beneficiarios for grant {row[0]}: {e}")
                    beneficiarios_value = "No especificado"

                # Asegurar que beneficiarios_value es un string válido
                if not isinstance(beneficiarios_value, str):
                    beneficiarios_value = str(beneficiarios_value) if beneficiarios_value else "No especificado"

                if row[10]:
                    numero_match = int(row[10] * 100)
                else:
                    numero_match = 0       

                logger.info(f"Grant {row[0]}: numero_match = {row[10]}, processed = {numero_match}")
                grants.append({
                    "grant_id": row[0],
                    "titulo_corto": row[1],
                    "presupuesto": row[2] if row[2] else "No especificado",
                    "importe_beneficiario": row[3] if row[3] else "No especificado",
                    "fecha_limite": _format_deadline_for_ui(row[4], row[9]),
                    "resumen": row[5] if row[5] else "Sin descripción disponible",
                    "beneficiarios": beneficiarios_value,
                    "region_impacto": row[7] if row[7] else "No especificado",
                    "finalidad": row[8] if row[8] else "No especificado",
                    "fecha_de_publicacion": row[9],
                    "numero_match": numero_match
                })

            logger.info(f"Grants retrieved: {len(grants)}")

            if should_rerank_with_v2 and grants:
                ranked_grants = rerank_marketplace_grants_v2(
                    user_id=user_id,
                    grants=grants,
                    entity_id=str(entity_id) if entity_id else None,
                )
                if sort_direction == 'asc':
                    ranked_grants = list(reversed(ranked_grants))
                has_more = len(ranked_grants) > (offset + limit)
                if retrieval_limit is not None and len(rows) >= retrieval_limit:
                    # If candidate pool hit its cap, there may be more rows in DB.
                    has_more = True
                grants = ranked_grants[offset:offset + limit]
                total_count = offset + len(grants) + (1 if has_more else 0)
            elif should_rerank_with_v2:
                has_more = False
                total_count = 0
            else:
                # --- COUNT TOTAL (exact) ---
                # Used only in match ordering mode. For preferences mode it is too expensive and can timeout.
                count_query = """
                    SELECT COUNT(DISTINCT g.id)
                    FROM grants g
                    WHERE """ + " AND ".join(where_clauses)
                count_params = filter_params.copy()
                cur.execute(count_query, tuple(count_params))
                total_count = cur.fetchone()[0]
                logger.info(f"Total count: {total_count}")
                has_more = (page * limit) < total_count

            return {
                "grants": grants,
                "has_more": has_more,
                "total_count": total_count,
                "page": page
            }

        except Exception as e:
            logger.exception("An error occurred in search_marketplace")
            return {"grants": [], "has_more": False, "total_count": 0, "page": page, "error": str(e)}

        finally:
            try:
                cur.close()
                conn.close()
            except:
                pass

    @staticmethod
    def get_filter_options():
        """Obtiene las opciones únicas de filtros del marketplace desde SQL."""
        try:
            conn = get_connection()
            cur = conn.cursor()

            base_visibility_where = """
                resumen_completo IS NOT NULL
                AND
                titulo_corto IS NOT NULL AND titulo_corto <> ''
                AND "Beneficiarios_Short" IS NOT NULL
                AND "Beneficiarios_Short"::text NOT IN ('{}', '{"categorias": []}', '')
                AND region_impacto IS NOT NULL AND region_impacto <> ''
            """

            def _normalize_option_rows(rows):
                def _normalize_spaces(value: str) -> str:
                    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ")).strip()

                def _to_pascal_case_label(value: str) -> str:
                    text = _normalize_spaces(value)
                    if not text:
                        return ""
                    # "PascalCase" visual para UI (Title Case con espacios preservados).
                    return text.title()

                options = []
                seen = set()
                for row in rows:
                    if not row:
                        continue
                    raw = row[0]
                    if raw is None:
                        continue
                    normalized_value = _normalize_spaces(raw)
                    if not normalized_value:
                        continue
                    key = normalized_value.casefold()
                    if key in seen:
                        continue
                    seen.add(key)
                    options.append({
                        "value": normalized_value,
                        "label": _to_pascal_case_label(normalized_value),
                    })
                return options

            def _grants_has_column(column_name):
                cur.execute("""
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'grants'
                      AND column_name = %s
                    LIMIT 1
                """, (column_name,))
                return cur.fetchone() is not None

            def _safe_fetch_options(query: str, section_name: str):
                try:
                    cur.execute(query)
                    rows = cur.fetchall()
                    options = _normalize_option_rows(rows)
                    logger.info(f"get_filter_options[{section_name}] -> {len(options)} opciones")
                    return options
                except Exception as e:
                    logger.exception(f"Error retrieving filter options section '{section_name}'")
                    return []

            # --- BENEFICIARIOS ---
            beneficiarios = _safe_fetch_options(f"""
                SELECT DISTINCT b.value AS beneficiario
                FROM grants g
                LEFT JOIN LATERAL jsonb_array_elements_text(
                    CASE
                        WHEN jsonb_typeof(g."Beneficiarios_Short"->'categorias') = 'array'
                            THEN g."Beneficiarios_Short"->'categorias'
                        ELSE '[]'::jsonb
                    END
                ) AS b(value) ON TRUE
                WHERE {base_visibility_where}
                  AND b.value IS NOT NULL
                  AND TRIM(b.value) <> ''
                ORDER BY beneficiario;
            """, "beneficiarios")

            # --- REGIONES ---
            regiones = _safe_fetch_options(f"""
                SELECT DISTINCT region_impacto
                FROM grants
                WHERE {base_visibility_where}
                ORDER BY region_impacto;
            """, "regiones")

            # --- FINALIDADES ---
            finalidades = _safe_fetch_options(f"""
                SELECT DISTINCT finalidad
                FROM grants
                WHERE finalidad IS NOT NULL
                  AND finalidad <> ''
                  AND {base_visibility_where}
                ORDER BY finalidad;
            """, "finalidades")

            # --- ADMINISTRACIÓN CONVOCANTE ---
            administraciones_convocantes = []
            if _grants_has_column("administracion_convocante"):
                administraciones_convocantes = _safe_fetch_options(f"""
                    SELECT DISTINCT administracion_convocante
                    FROM grants
                    WHERE administracion_convocante IS NOT NULL
                      AND administracion_convocante <> ''
                      AND {base_visibility_where}
                    ORDER BY administracion_convocante;
                """, "administraciones_convocantes")

            # --- TIPO DE AYUDA ---
            tipos_ayuda = []
            if _grants_has_column("tipo_ayuda"):
                tipos_ayuda = _safe_fetch_options(f"""
                    SELECT DISTINCT tipo_ayuda
                    FROM grants
                    WHERE tipo_ayuda IS NOT NULL
                      AND tipo_ayuda <> ''
                      AND {base_visibility_where}
                    ORDER BY tipo_ayuda;
                """, "tipos_ayuda")

            logger.info(
                "Filter options retrieved successfully. counts: beneficiarios=%s, regiones=%s, finalidades=%s, administraciones_convocantes=%s, tipos_ayuda=%s",
                len(beneficiarios), len(regiones), len(finalidades), len(administraciones_convocantes), len(tipos_ayuda)
            )
            logger.info(
                "Filter options sample: admin=%s | tipo=%s",
                [o.get("label") for o in administraciones_convocantes[:5]],
                [o.get("label") for o in tipos_ayuda[:5]],
            )
            return {
                "beneficiarios": beneficiarios,
                "regiones": regiones,
                "finalidades": finalidades,
                "administraciones_convocantes": administraciones_convocantes,
                "tipos_ayuda": tipos_ayuda,
            }

        except Exception as e:
            logger.exception("An error occurred in get_filter_options")
            return {
                "beneficiarios": [],
                "regiones": [],
                "finalidades": [],
                "administraciones_convocantes": [],
                "tipos_ayuda": [],
                "error": str(e)
            }

        finally:
            try:
                cur.close()
                conn.close()
            except:
                pass
