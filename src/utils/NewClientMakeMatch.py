from openai import OpenAI
import json
import psycopg2
import sys
import os
import datetime
import boto3
from botocore.exceptions import ClientError
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import ssl
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from string import Template

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.postgreSQL import get_connection
from src.Modules.logger_config import get_logger
logger = get_logger(__name__)

# -----------------------------------------------------
# RECUPERAR SECRETOS DESDE AWS SSM
# -----------------------------------------------------
"""SSM"""
def get_ssm_param(name, secure=True):
    ssm = boto3.client("ssm", region_name="eu-central-1")
    response = ssm.get_parameter(Name=name, WithDecryption=secure)
    return response["Parameter"]["Value"]

s3_client = boto3.client("s3")
def get_bucket_name():
    try:
        ssm = boto3.client("ssm", region_name="eu-central-1")
        resp = ssm.get_parameter(Name="/grantify/s3/docssubvenciones", WithDecryption=False)
        return resp["Parameter"]["Value"]
    except ClientError as e:
        logger.error("No se pudo leer de SSM, usando ENV: %s", e)
        bucket = os.getenv("S3_BUCKET")
        if not bucket:
            raise RuntimeError("No se encontró el bucket en SSM ni en variable de entorno")
        return bucket

S3_BUCKET = get_bucket_name()
s3_client = boto3.client("s3", region_name="eu-central-1")

# OPENAI
api_key = get_ssm_param("/grantify/openai/api_key")
os.environ["OPENAI_API_KEY"] = api_key

organization_id = get_ssm_param("/grantify/openai/org_id", secure=False)
os.environ["OPENAI_ORG_ID"] = organization_id

model_match = get_ssm_param("/grantify/openai/model_match", secure=False)
os.environ["MODEL_MATCH"] = model_match

chatgpt_prompt_match = get_ssm_param("/grantify/openai/chatgpt_prompt_match", secure=False)
os.environ["CHATGPT_PROMPT_MATCH"] = chatgpt_prompt_match

client = OpenAI(
    api_key=api_key,
    organization=organization_id,
    timeout=30.0, 
    max_retries=2
)

# -----------------------------------------------------
# CONFIGURACIÓN SMTP Exchange Online
# -----------------------------------------------------
SMTP_HOST = get_ssm_param("/grantify/SMTP/SMTP_HOST")
SMTP_PORT = get_ssm_param("/grantify/SMTP/Port")
SMTP_USER = get_ssm_param("/grantify/SMTP/USER")
SMTP_PASS = get_ssm_param("/grantify/SMTP/PASS")
URL = get_ssm_param("/grantify/URL")

# -----------------------------------------------------
# CONFIGURACIÓN
# -----------------------------------------------------

def _safe_str(value):
    if value is None:
        return ""
    return str(value).strip()


def _normalize_match_score(raw_score):
    if raw_score in (None, ""):
        return None
    try:
        score = float(raw_score)
    except (TypeError, ValueError):
        return None
    if score > 1:
        score = score / 100.0
    return max(0.0, min(score, 1.0))


def _emit_progress(progress_callback, payload):
    if callable(progress_callback):
        try:
            progress_callback(payload)
        except Exception as callback_error:
            logger.warning("No se pudo emitir progreso de matching: %s", callback_error)


def _get_matching_phases(comunidad_autonoma):
    has_region = bool(_safe_str(comunidad_autonoma))
    phases = []
    if has_region:
        phases.extend([
            {
                "key": "region_3m",
                "label": f"Buscando subvenciones en {comunidad_autonoma} (últimos 3 meses)",
                "months": 3,
                "region_only": True,
            },
            {
                "key": "region_6m",
                "label": f"Ampliando búsqueda en {comunidad_autonoma} (últimos 6 meses)",
                "months": 6,
                "region_only": True,
            },
            {
                "key": "region_all",
                "label": f"Revisando histórico completo en {comunidad_autonoma}",
                "months": None,
                "region_only": True,
            },
        ])

    phases.append({
        "key": "spain_all",
        "label": "Ampliando al resto de subvenciones en España",
        "months": None,
        "region_only": False,
    })
    return phases


def _fetch_phase_candidates(cursor, entity_id, comunidad_autonoma, phase):
    conditions = [
        "g.resumen_completo IS NOT NULL",
        "NULLIF(TRIM(g.resumen_completo), '') IS NOT NULL",
        "NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.entity_id = %s AND m.grant_id = g.id)",
    ]
    params = [entity_id]

    if phase.get("months") is not None:
        conditions.append("g.fecha_de_publicacion >= NOW() - (%s || ' months')::interval")
        params.append(int(phase["months"]))

    if phase.get("region_only"):
        comunidad = _safe_str(comunidad_autonoma).lower()
        if comunidad:
            conditions.append("LOWER(COALESCE(g.region_impacto, '')) LIKE %s")
            params.append(f"%{comunidad}%")

    query = f"""
        SELECT g.id, g.codigobdns, g.resumen_completo
        FROM public.grants g
        WHERE {" AND ".join(conditions)}
        ORDER BY g.fecha_de_publicacion DESC NULLS LAST, g.id DESC
    """
    cursor.execute(query, tuple(params))
    return cursor.fetchall()


# 1- Iterar por cada Subvención y procesar match por fases progresivas
def iterar_subvencion(chatgpt_prompt_match, model_match, entity_id, progress_callback=None):
    connection = get_connection()
    cursor = connection.cursor()
    logger.info("Obteniendo información de la entidad con ID: %s", entity_id)

    try:
        query = """
            SELECT
                id,
                razon_social,
                comunidad_autonoma,
                comunidad_autonoma_centro_trabajo,
                descripcion,
                tipo_empresa,
                fecha_constitucion,
                personal_en_linea,
                liderado_por_mujeres,
                porcentaje_liderado_por_mujeres,
                sector,
                facturacion_anual,
                direccion_social,
                cnae
            FROM public.entities
            WHERE id = %s
        """
        cursor.execute(query, (entity_id,))
        row = cursor.fetchone()
        if not row:
            logger.info("No se ha encontrado la entidad.")
            return {
                "status": "error",
                "processed": 0,
                "total": 0,
                "matches_found": 0,
                "best_match_score": None,
                "first_high_match": None,
                "error": "Entidad no encontrada",
            }

        (
            entity_id_value,
            razon_social,
            comunidad_autonoma,
            centro_de_trabajo,
            descripcion_entidad,
            tipo_entidad,
            fecha_constitucion,
            personal_en_linea,
            liderado_por_mujeres,
            porcentaje_mujeres,
            sector,
            facturacion_anual,
            direccion_social,
            cnae,
        ) = row

        logger.info("Entidad encontrada: %s", razon_social)
        if fecha_constitucion and isinstance(fecha_constitucion, (datetime.date, datetime.datetime)):
            fecha_constitucion = fecha_constitucion.isoformat()

        entity_payload = {
            "entity_id": entity_id_value,
            "razon_social": razon_social,
            "comunidad_autonoma": comunidad_autonoma,
            "centro_de_trabajo": centro_de_trabajo,
            "descripcion_entidad": descripcion_entidad,
            "tipo_entidad": tipo_entidad,
            "fecha_constitucion": fecha_constitucion,
            "personal_en_linea": personal_en_linea,
            "liderado_por_mujeres": liderado_por_mujeres,
            "porcentaje_mujeres": porcentaje_mujeres,
            "sector": sector,
            "facturacion_anual": facturacion_anual,
            "direccion_social": direccion_social,
            "cnae": cnae,
        }
        json_string = json.dumps(entity_payload, ensure_ascii=False, indent=4)

        phases = _get_matching_phases(comunidad_autonoma)
        seen_grants = set()
        candidates = []
        for phase in phases:
            phase_rows = _fetch_phase_candidates(cursor, entity_id_value, comunidad_autonoma, phase)
            for grant_id, codigobdns, resumen in phase_rows:
                if grant_id in seen_grants:
                    continue
                seen_grants.add(grant_id)
                candidates.append({
                    "phase_key": phase["key"],
                    "phase_label": phase["label"],
                    "grant_id": grant_id,
                    "codigobdns": codigobdns,
                    "resumen": resumen,
                })

        total_candidates = len(candidates)
        logger.info("Total subvenciones candidatas para matching entity_id=%s: %s", entity_id_value, total_candidates)

        _emit_progress(progress_callback, {
            "type": "matching_started",
            "total": total_candidates,
            "processed": 0,
            "matches_found": 0,
            "best_match_score": None,
            "phase": candidates[0]["phase_key"] if candidates else None,
            "phase_label": candidates[0]["phase_label"] if candidates else "No hay subvenciones para analizar",
        })

        if total_candidates == 0:
            return {
                "status": "completed",
                "processed": 0,
                "total": 0,
                "matches_found": 0,
                "best_match_score": None,
                "first_high_match": None,
                "error": None,
            }

        processed = 0
        matches_found = 0
        best_match_score = None
        first_high_match = None
        active_phase_key = None

        for candidate in candidates:
            phase_key = candidate["phase_key"]
            if phase_key != active_phase_key:
                active_phase_key = phase_key
                _emit_progress(progress_callback, {
                    "type": "phase",
                    "phase": candidate["phase_key"],
                    "phase_label": candidate["phase_label"],
                    "processed": processed,
                    "total": total_candidates,
                    "matches_found": matches_found,
                    "best_match_score": best_match_score,
                })

            resultado_match = hacer_match(chatgpt_prompt_match, model_match, candidate["resumen"], json_string)
            if resultado_match:
                raw_score = resultado_match.get("puntuacion")
                score_ratio = _normalize_match_score(raw_score)
                resultado_match["puntuacion"] = score_ratio

                if score_ratio is not None and (best_match_score is None or score_ratio > best_match_score):
                    best_match_score = score_ratio

                if first_high_match is None and score_ratio is not None and score_ratio >= 0.85:
                    first_high_match = {
                        "grant_id": str(candidate["grant_id"]),
                        "score": score_ratio,
                    }
                    _emit_progress(progress_callback, {
                        "type": "first_high_match",
                        "grant_id": str(candidate["grant_id"]),
                        "score": score_ratio,
                        "processed": processed,
                        "total": total_candidates,
                        "matches_found": matches_found,
                        "best_match_score": best_match_score,
                    })

                resultado_tips = crear_tips(resultado_match)
                guardado = guardar_match(
                    cursor,
                    resultado_match,
                    resultado_tips,
                    candidate["grant_id"],
                    entity_id_value,
                    connection,
                )
                if guardado:
                    matches_found += 1

            processed += 1
            if processed % 25 == 0 or processed == total_candidates:
                _emit_progress(progress_callback, {
                    "type": "progress",
                    "processed": processed,
                    "total": total_candidates,
                    "matches_found": matches_found,
                    "best_match_score": best_match_score,
                    "phase": candidate["phase_key"],
                    "phase_label": candidate["phase_label"],
                })

        logger.info(
            "Matching finalizado para entity_id=%s | procesadas=%s | matches=%s | mejor_score=%s",
            entity_id_value,
            processed,
            matches_found,
            best_match_score,
        )
        return {
            "status": "completed",
            "processed": processed,
            "total": total_candidates,
            "matches_found": matches_found,
            "best_match_score": best_match_score,
            "first_high_match": first_high_match,
            "error": None,
        }
    except Exception as match_error:
        logger.error("Error en iterar_subvencion para entity_id=%s: %s", entity_id, match_error)
        return {
            "status": "error",
            "processed": 0,
            "total": 0,
            "matches_found": 0,
            "best_match_score": None,
            "first_high_match": None,
            "error": str(match_error),
        }
    finally:
        cursor.close()
        connection.close()

# 2- Función para generar el match entre entidad y subvencion
def hacer_match(chatgpt_prompt_match, model_match, resumen_subvencion, json_string):
    prompt_contenido = f"Resumen de la subvención: {resumen_subvencion}\n\nDatos de la entidad: \n{json_string}"
    client = OpenAI()
    
    try:
        final_response = client.responses.create(
        prompt={
            "id": "pmpt_6915ac4b91308195b4163594c776a66e08a36387bc910bf6",
            "version": "12"
        },
        input=prompt_contenido,
        text={
            "format": {
            "type": "text"
            }
        },
        reasoning={},
        max_output_tokens=2048,
        store=True
        )

        raw = final_response.output[0].content[0].text
        logger.info("=== Resultado IA generado ===")

        if raw:
            logger.info("=== Resultado en cadena JSON ===")
            # Parseamos la cadena JSON a dict
            try:
                resultado_match = json.loads(raw)
                logger.info(f"Parsed scraping JSON (type={type(final_response)}): {final_response}")
                return resultado_match
            except json.JSONDecodeError as err:
                logger.error("Error al parsear JSON de scraping: %s", err)
                return

    except Exception as e:
        logger.error(f"Error al resumir documento: {e}")
        return None

# 2.1- Función para generar tips de mejora
def crear_tips(resultado_match):
    client = OpenAI()
    justificacion = resultado_match.get('justificacion', None)

    if not justificacion:
        logger.error("No se encontró justificación en el resultado del match.")
        return None
    
    try:
        final_response = client.responses.create(
        prompt={
            "id": "pmpt_691ad4dfaed08197a72f04da6273ec010be4ab0dfb9ed5b8",
            "version": "4"
        },
        input=justificacion,
        text={
            "format": {
            "type": "text"
            }
        },
        reasoning={},
        max_output_tokens=2048,
        store=True
        )

        resultado_tips = final_response.output[0].content[0].text
        logger.info("=== Resultado IA generado para tips ===")
        logger.info(resultado_tips)

        return resultado_tips

    except Exception as e:
        logger.error(f"Error al resumir documento para tips: {e}")
        return None
    
# 3- Función para guardar contenido en SQL
def guardar_match(cursor, resultado_match, resultado_tips, row_id, id_entidad, connection):
    if not resultado_match:
        return None

    puntuacion = _normalize_match_score(resultado_match.get("puntuacion"))
    justificacion = resultado_match.get("justificacion", None)
    fecha_match = datetime.datetime.now(datetime.timezone.utc)

    # Query para insertar
    query = """
    INSERT INTO public.matches (
    entity_id,
    grant_id,
    fecha_match,
    justificacion,
    numero_match, 
    recomendacion
    ) VALUES (%s, %s, %s, %s, %s, %s)
    """

    try:
        cursor.execute(query, (id_entidad, row_id, fecha_match, justificacion, puntuacion, resultado_tips))
        connection.commit()
        logger.info("Fila insertada exitosamente (entity_id=%s, grant_id=%s).", id_entidad, row_id)
        return "exito"
    except Exception as insert_error:
        try:
            connection.rollback()
        except Exception:
            pass
        logger.warning(
            "No se pudo insertar match (entity_id=%s, grant_id=%s): %s",
            id_entidad,
            row_id,
            insert_error,
        )
        return None

# 4 - Enviar email con resultados 
""" Buscar email de la entidad y matches """
def recuperar_informacion(id_entity):
    connection = get_connection()
    cursor = connection.cursor()
    
    # Obtener email del usuario asociado a la entidad
    query_entity = """
        SELECT 
            au.id,
            au.email,
            au.name
        FROM app_user au
        JOIN user_entities ue 
            ON au.id = ue.user_id
        WHERE ue.entity_id = %s;
    """
    cursor.execute(query_entity, (id_entity,))
    row_entity = cursor.fetchone()

    if not row_entity:
        logger.info("No se ha encontrado la entidad.")
        return None, None

    email = row_entity[1]
    name = row_entity[2]

    # Obtener 4 matches 
    query_entity_matches = """
        SELECT 
            em.id,
            em.entity_id,
            em.numero_match,
            g.titulo_corto,
            g.region_impacto,
            g.presupuesto,
            g.fecha_finalizacion
        FROM matches em
        JOIN grants g
        ON em.grant_id = g.id
        WHERE em.entity_id = %s
        AND em.numero_match >= 0.7
        AND g.fecha_de_publicacion IS NOT NULL
        ORDER BY g.fecha_de_publicacion DESC
        LIMIT 4;
    """
    cursor.execute(query_entity_matches, (id_entity,))
    rows_matches = cursor.fetchall()

    if not rows_matches:
        logger.info("No se han encontrado matches.")
        return None, None

    # Generar el HTML del email
    html_content, body_text = generate_grantial_recommendations_email(name, rows_matches)

    # Enviar el correo
    enviar_email_resultados(email, html_content, body_text)
    
    connection.close()
    logger.info(f"Correo enviado a {email} con {len(rows_matches)} subvenciones.")

""" Generar contenido HTML del email """ 
def generate_grantial_recommendations_email(name: str, rows_matches: list) -> str:

    logger.info("Generando contenido del email...")
    grant_cards = ""

    for grant in rows_matches:

        # Modificar numero match a porcentaje entero
        match = int(grant[2] * 100)

        # Manejar Plazo None
        if grant[6] == None:
            fecha_inicio = "No especificado"
        else:
            # Formatear fecha a dd/mm/yyyy
            try:
                raw_fecha_inicio = str(grant[6])
                fecha_obj = datetime.strptime(raw_fecha_inicio, "%Y-%m-%d")
                fecha_inicio = fecha_obj.strftime("%d/%m/%Y")
            except Exception as e:
                logger.info(f"Error formateando fecha {grant[6]}: {e}")
                fecha_inicio = str(grant[6])

        # Manejar Presupuesto None
        if grant[5] == None:
            presupuesto = "No especificado"
        else:
            try: 
                raw_presupuesto = str(grant[5])
                presupuesto = formatear_euros(raw_presupuesto)
            except Exception as e:
                logger.info(f"Error formateando presupuesto {grant[5]}: {e}")
                presupuesto = str(grant[5])

        """ Generar tarjeta de subvención """
        grant_cards += f"""
        <div class="grant-card">
            <h3>{grant[3]}</h3>
            <p><strong>Región:</strong> {grant[4]}</p>
            <p><strong>Presupuesto disponible:</strong> {presupuesto}</p>
            <p><strong>Plazo:</strong> {fecha_inicio}</p>
            <p><strong>Coincidencia con tu perfil:</strong> {match}% ✅</p> 
            <a href="https://grantial.com/matches/{grant[0]}" class="button">Ver más información</a>
        </div>
        """
    
    # Email HTML completo
    html_content = f"""\
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Tus subvenciones disponibles - Grantial</title>
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 700px;
                    margin: 0 auto;
                    padding: 20px;
                    background: #f4f6f8;
                }}
                .header {{
                    background: #6161b5;
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }}
                .logo {{
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    font-size: 32px;
                    font-weight: bold;
                }}
                .logo img {{
                    height: 50px;
                }}
                h1 {{
                    color: #ccccea;
                    margin-top: 5px;
                    font-size: 26px;
                }}
                .content {{
                    background: #ffffff;
                    padding: 30px;
                    border: 1px solid #e0e0e0;
                    border-top: none;
                }}
                .grant-card {{
                    border: 1px solid #dcdcdc;
                    border-radius: 8px;
                    padding: 15px 20px;
                    margin-bottom: 20px;
                    background: #faf9ff;
                }}
                .grant-card h3 {{
                    color: #6161b5;
                    margin-top: 0;
                }}
                .grant-card p {{
                    margin: 5px 0;
                }}
                .footer {{
                    background: #f8f9fa;
                    padding: 20px;
                    text-align: center;
                    font-size: 14px;
                    color: #666;
                    border-radius: 0 0 10px 10px;
                }}
                .button {{
                    display: inline-block;
                    background: linear-gradient(135deg, #9474bc 0%, #6b6bc3 100%);
                    color: #6161b5;
                    padding: 15px 30px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: bold;
                    margin-top: 15px;
                }}
                .button:hover {{
                    opacity: 0.9;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">
                    <img src="https://raw.githubusercontent.com/Innovalauss/grantia-logo/refs/heads/main/Grantial.png" alt="Logo Grantial">
                    <p>GRANTIAL</p>
                </div>
                <h1>Subvenciones detectadas por Granti</h1>
                <p>Basadas en la información de tu empresa y memoria registrada</p>
            </div>
            <div class="content">
                <p>Hola {name},</p>
                <p>Granti ha analizado tu perfil, y ha identificado <strong>subvenciones que encajan con tu actividad</strong>. Aquí tienes un resumen:</p>

                {grant_cards}

                <p>Granti seguirá analizando nuevas oportunidades cada semana y te notificará cuando haya convocatorias relevantes.</p>
                <p style="text-align:center; margin-top:30px;">
                    <a href="https://grantial.com/subvenciones-compatibles" class="button">Ver mis subvenciones más compatibles</a>
                </p>
                <p>¡Gracias por confiar en Grantial!</p>
            </div>
            <div class="footer">
                <p>© 2026 Grantial. Todos los derechos reservados.</p>
                <p>Has recibido este correo porque estás registrado en Grantial. Puedes actualizar tus preferencias en tu perfil.</p>
            </div>
        </body>
        </html>
    """
    
    body_text = f"""\
        Hola {name},

        Granti ha analizado tu perfil, y ha identificado <strong>subvenciones que encajan con tu actividad</strong>. Aquí tienes un resumen:

        Aquí tienes un resumen:

        {grant_cards}

        Granti seguirá analizando nuevas oportunidades cada semana y te notificará cuando haya convocatorias relevantes.
        Ver mis subvenciones más compatibles:
        https://grantial.com/subvenciones-compatibles

        ¡Gracias por confiar en Grantial!

        © 2026 Grantial. Todos los derechos reservados.
        Has recibido este correo porque estás registrado en Grantial. Puedes actualizar tus preferencias en tu perfil.
        """
    
    return html_content, body_text

def formatear_euros(valor):
    # Aseguramos que sea float
    valor = float(valor)
    # Formateamos con separadores de miles y dos decimales
    texto = f"{valor:,.2f}"
    # Cambiamos comas por puntos y puntos por comas
    texto = texto.replace(",", "X").replace(".", ",").replace("X", ".")
    # Añadimos el símbolo €
    return f"{texto} €"

""" Enviar email con resultados"""
def enviar_email_resultados(email, html_content, body_text):
    """Send email verification using SMTP"""
    
    try:
        # Email content
        subject = "Subvenciones que encajan con tu perfil - Grantial"
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SMTP_USER
        msg['To'] = email
        
        # Create text and HTML parts
        part1 = MIMEText(body_text, 'plain', 'utf-8')
        part2 = MIMEText(html_content, 'html', 'utf-8')
        
        # Add parts to message
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email via SMTP
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        
        print(f"Verification email sent to {email}")
        return True
   
    except Exception as e:
        print(f"Error sending verification email: {e}")
        # Don't fail registration if email sending fails
        return False

#################
##### MAIN ######
#################
def main_match_new_client(id_entity, progress_callback=None):
    summary = iterar_subvencion(
        chatgpt_prompt_match,
        model_match,
        id_entity,
        progress_callback=progress_callback,
    )

    if isinstance(summary, dict) and summary.get("status") == "completed":
        try:
            recuperar_informacion(id_entity)
        except Exception as email_error:
            logger.warning("No se pudo enviar email final de matches para entity_id=%s: %s", id_entity, email_error)

    return summary
