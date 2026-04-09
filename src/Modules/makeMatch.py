from openai import OpenAI
import json
import psycopg2
import sys
import os
import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.postgreSQL import get_connection
from Modules.logger_config import get_logger
logger = get_logger(__name__)
# -----------------------------------------------------
# CONFIGURACIÓN
# -----------------------------------------------------

# 1- Iterar por cada Entidad y procesar match
def iterar_entidad(CHATGPT_PROMPT, model_match, resumen_subvencion, row_id):
    logger.info("Iniciando match para resumen: " + resumen_subvencion)
    connection = get_connection()
    cursor = connection.cursor()
    logger.info("Realizando Match...")

    # Obtener informacion de todas las entidades
    query = """
        SELECT *
        FROM public.entities
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()

    if not rows:
        logger.info("No se han obtenido Entidades.")
        return
    
    numRows = 0

    for row in rows:
        numRows += 1

        # Asignar valores a las variables
        entity_id = row[0]
        razon_social = row[1]
        comunidad_autonoma = row[4]
        centro_de_trabajo = row[5]
        descripcion_entidad = row[9]
        tipo_entidad = row[10]
        fecha_constitucion = row[11]
        personal_en_linea = row[12]
        liderado_por_mujeres = row[13]
        porcentaje_mujeres = row[14]
        sector = row[15]
        facturacion_anual = row[16]
        direccion_social = row[17]
        cnae = row[18]

        logger.info(f"ID entidad: {entity_id}")
        logger.info(f"Procesando Entidad: {razon_social}")
        
        # Convertir fecha a string si existe
        if fecha_constitucion and isinstance(fecha_constitucion, (datetime.date, datetime.datetime)):
            fecha_constitucion = fecha_constitucion.isoformat()
            
        # Crear diccionario
        data = {
            "entity_id": entity_id,
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
            "cnae": cnae
        }
        
        # Convertir a JSON (string)
        json_string = json.dumps(data, ensure_ascii=False, indent=4)
        logger.info("=== Información de la entidad en JSON ===")
        logger.info(json_string)

        # Buscar preferencias del usuario
        preferencias = get_preferencias_entidad(cursor, entity_id)

        # Hacer Match
        resultado_match = hacer_match(CHATGPT_PROMPT, model_match, resumen_subvencion, json_string, preferencias)

        if not resultado_match:
            logger.error("No se ha podido realizar el match.")
            continue

        # Crear Tips
        resultado_tips = crear_tips(resultado_match)

        # Guardar Match 
        guardado = guardar_match(cursor, resultado_match, resultado_tips, row_id, entity_id, connection)

        if guardado:
            logger.info("Guardado con éxito.")

    logger.info(f"Encontradas {numRows} Entidades.")

# 2- Función para obtener preferencias de la entidad
def get_preferencias_entidad(cursor, entity_id):
    
    # Query para obtener preferencias
    query_finalidad = """
        SELECT u.finalidad, COUNT(*) AS total
        FROM user_grant_preferences u
        JOIN entities e ON u.entity_id = %s
        WHERE u.action = 'interesa'
        AND u.finalidad IS NOT NULL
        GROUP BY u.finalidad
        ORDER BY total DESC
        LIMIT 2;
    """

    cursor.execute(query_finalidad, (entity_id,))
    rows = cursor.fetchall()

    finalidad = []
    for row in rows:
        finalidad.append({"finalidad": row[0], "total": row[1]})
        logger.info("Finalidad obtenida de preferencias:" + str(row))

    logger.info(finalidad)

    # Query para obtener preferencias de sector
    query_sector = """
        SELECT u.sector, COUNT(*) AS total
        FROM user_grant_preferences u
        JOIN entities e ON u.entity_id = %s
        WHERE u.action = 'interesa'
        AND u.sector IS NOT NULL
        GROUP BY u.sector
        ORDER BY total DESC
        LIMIT 2;
    """

    cursor.execute(query_sector, (entity_id,))
    rows = cursor.fetchall()

    sector = []
    for row in rows:
        sector.append({"sector": row[0], "total": row[1]})
        logger.info("Sector obtenido de preferencias:" + str(row))

    logger.info("Lista de sectores obtenidos de preferencias:", sector)

    # Query para obtener preferencias de región
    query_region = """
        SELECT u.region_impacto, COUNT(*) AS total
        FROM user_grant_preferences u
        JOIN entities e ON u.entity_id = %s
        WHERE u.action = 'interesa'
        AND u.region_impacto IS NOT NULL
        GROUP BY u.region_impacto
        ORDER BY total DESC
        LIMIT 2;
    """

    cursor.execute(query_region, (entity_id,))
    rows = cursor.fetchall()
    
    region = []
    for row in rows:
        region.append({"region": row[0], "total": row[1]})
        logger.info("Región obtenida de preferencias:" + str(row))

    logger.info(region)

    preferencias_json = {
        "finalidad": finalidad,
        "sector": sector,
        "region": region
    }

    logger.info("JSON preferencias:", preferencias_json)
    return preferencias_json

# 3- Función para generar el match entre entidad y subvencion
def hacer_match(CHATGPT_PROMPT, model_match, resumen_subvencion, json_string, preferencias):
    prompt_contenido = f"Resumen de la subvención: {resumen_subvencion}\n\nDatos de la entidad: \n{json_string}\n\nPreferencias de la entidad: {preferencias}"
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
        logger.info(raw)

        if raw:
            logger.info("=== Resultado en cadena JSON ===")
            # Parseamos la cadena JSON a dict
            try:
                resultado = json.loads(raw)
                logger.info(f"Parsed scraping JSON (type={type(final_response)}): {final_response}")
            except json.JSONDecodeError as err:
                logger.error("Error al parsear JSON de scraping:", err)
                return
            return resultado

    except Exception as e:
        logger.error(f"Error al resumir documento: {e}")
        return None

# 3.1- Función para generar tips de mejora
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

        return resultado_tips

    except Exception as e:
        logger.error(f"Error al resumir documento para tips: {e}")
        return None

# 4- Función para guardar contenido en SQL
def guardar_match(cursor, resultado_match, resultado_tips,  row_id, entity_id, connection):
    
    # Separar información obtenida
    if not resultado_match:
        puntuacion = None
        justificacion = None
        fecha_match = None
    else:
        puntuacion_str = resultado_match.get('puntuacion', None)
        justificacion = resultado_match.get('justificacion', None)
        fecha_match = datetime.datetime.now(datetime.timezone.utc) 

    # Convertir puntuación a float
    if puntuacion_str is not None:
        try:
            puntuacion = float(puntuacion_str)
        except ValueError:
            puntuacion = None

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

    # Ejecutar
    cursor.execute(query, (entity_id, row_id, fecha_match, justificacion, puntuacion, resultado_tips))
    # Confirmar
    connection.commit()

    logger.info("Fila insertada exitosamente.")
    return "exito"
