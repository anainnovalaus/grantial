
from datetime import date, timedelta
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from Modules.connectSharepoint import conect_sharepoint_main
from Modules.postgreSQL import get_connection
from Modules.leer_contenido import process_subvencion_s3
from Modules.ingestion_milvus import ingestion_main
from Modules.makeSummary import resumen_main
from Modules.guardar_resumenes import guardar_resumen_main
from Modules.makeMatch import iterar_entidad
from Modules.logger_config import get_logger
from openai import OpenAI
import boto3
import logging
from flask import Flask
from flask import request, jsonify
from flask_cors import CORS
from botocore.exceptions import ClientError
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)



logger = get_logger(__name__)

# -----------------------------------------------------

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

chatgpt_prompt_innovalaus = get_ssm_param("/grantify/openai/chatgpt_prompt_innovalaus", secure=False)
os.environ["CHATGPT_PROMPT_INNOVALAUS"] = chatgpt_prompt_innovalaus

chatgpt_prompt_grantify = get_ssm_param("/grantify/openai/chatgpt_prompt_grantify", secure=False)
os.environ["CHATGPT_PROMPT_GRANTIFY"] = chatgpt_prompt_grantify

model_resumen = get_ssm_param("/grantify/openai/model_resumen", secure=False)
os.environ["MODEL_RESUMEN"] = model_resumen

chatgpt_prompt_match = get_ssm_param("/grantify/openai/chatgpt_prompt_match", secure=False)
os.environ["CHATGPT_PROMPT_MATCH"] = chatgpt_prompt_match

model_match = get_ssm_param("/grantify/openai/model_match", secure=False)
os.environ["MODEL_MATCH"] = model_match

model_embedding = get_ssm_param("/grantify/openai/model_embbeding", secure=False)
os.environ["MODEL_EMBEDDING"] = model_embedding

client = OpenAI(
    api_key=api_key,
    organization=organization_id,
    timeout=20.0,  # 20 segundos para TODAS las requests
    max_retries=2 
)

# POSTGRESQL
username = get_ssm_param("/grantify/postgres/user", secure=False)
os.environ["POSTGRE_USER"] = username

password = get_ssm_param("/grantify/postgres/password")
os.environ["POSTGRE_PASSWORD"] = password

host = get_ssm_param("/grantify/postgres/host", secure=False)
os.environ["POSTGRE_HOST"] = host

port = get_ssm_param("/grantify/postgres/port", secure=False)
os.environ["POSTGRE_PORT"] = port

database = get_ssm_param("/grantify/postgres/database", secure=False)
os.environ["POSTGRE_DATABASE"] = database

# SHAREPOINT
authority = get_ssm_param("/grantify/sharepoint/authority", secure=False)
os.environ["AUTHORITY"] = authority

client_id = get_ssm_param("/grantify/sharepoint/client_id", secure=False)
os.environ["CLIENT_ID"] = client_id

raw_scope = get_ssm_param("/grantify/sharepoint/raw_scope", secure=False)
os.environ["SCOPE"] = raw_scope

secret = get_ssm_param("/grantify/sharepoint/secret")
os.environ["SECRET"] = secret

endpoint = get_ssm_param("/grantify/sharepoint/database", secure=False)
os.environ["ENDPOINT"] = endpoint

site_id_name = get_ssm_param("/grantify/sharepoint/site_id_name", secure=False)
os.environ["SITE_ID_NAME"] = site_id_name

path_guardar_resumen = get_ssm_param("/grantify/sharepoint/path_guardar_resumen", secure=False)
os.environ["PATH_GUARDAR_RESUMEN"] = path_guardar_resumen

# MILVUS
milvus_host = get_ssm_param("/grantify/milvus/ZILLIZ_URI", secure=False)
os.environ["MILVUS_HOST"] = milvus_host

milvus_port = get_ssm_param("/grantify/milvus/ZILLIZ_TOKEN", secure=False)
os.environ["MILVUS_PORT"] = milvus_port

milvus_collection_name = get_ssm_param("/grantify/milvus/ZILLIZ_COLLECTION", secure=False)
os.environ["MILVUS_COLLECTION_NAME"] = milvus_collection_name

# -----------------------------------------------------
# -----------------------------------------------------
# -----------------------------------------------------

""" Función para listar subvenciones de la base de datos """
def listar_subvenciones(cursor, conn, token, drive_id, path_guardar_resumen, milvus_host, milvus_port, 
                                milvus_collection_name, model_embedding, chatgpt_prompt_innovalaus, 
                        chatgpt_prompt_grantify, model_resumen, chatgpt_prompt_match, S3_BUCKET, s3_client, client, model_match):
        try:
            grants_today = []
            logger.info("Connected to the database successfully.")

            # Get today's date
            today = date.today()
            yesterday = today - timedelta(days=1) # --> Resta un día
            # Format the date to match the database format
            fecha_buscada = yesterday.strftime("%Y/%m/%d")
            logger.info("Buscando subvenciones de: %s", fecha_buscada)

            # Prepare the query to select only the required columns
            query = """
                SELECT codigobdns
                FROM grants
                WHERE fecha_de_publicacion = %s
                AND resumen_completo IS NULL
            """
            
            # Execute the query using today's date as parameter
            cursor.execute(query, (fecha_buscada,))
            rows = cursor.fetchall()

            logger.info("Rows with today's date:")
            
            for row in rows:  # rows vienen de tu consulta SQL
                subvencion_prefix = row[0]  # p.ej. "847302"
                logger.info("Procesando S3 en: %s", subvencion_prefix)
                logger.info("-------------------------------------------------")

                # Aquí llamas a la parte de S3:
                documentos_leidos = process_subvencion_s3(subvencion_prefix, S3_BUCKET, s3_client)
                texto_completo = "\n\n---\n\n".join(documentos_leidos)

                if documentos_leidos:
                    # Ingestion de texto en milvus para IA Assistant
                    ingesta = ingestion_main(client, subvencion_prefix, documentos_leidos, milvus_host, milvus_port, 
                                milvus_collection_name, model_embedding)
                    
                    # Hacer Resumen
                    resumen_innovalaus, resumen_grantial = resumen_main(texto_completo, chatgpt_prompt_innovalaus, 
                        chatgpt_prompt_grantify, model_resumen, client)
                    
                    # Guardar en Sharepoint para equipo Innovalaus y sql para Grantial
                    path = path_guardar_resumen + "/" + subvencion_prefix
                    row_id = guardar_resumen_main(token, drive_id, path, resumen_innovalaus, resumen_grantial, cursor, conn, subvencion_prefix)

                    if row_id:
                        match = iterar_entidad(chatgpt_prompt_match, model_match, resumen_grantial, row_id)
                        logger.info("Match realizado: %s", match)

                else:
                    logger.info("No hay archivos para resumir en esta subvención.")

        except Exception as e:
            logger.info("An error occurred: %s", e)
            grants_today = "Today there are no grants or there was an error in the query."
            logger.info(grants_today) # --> Imprime el mensaje de error
            return grants_today
        
        logger.info(grants_today)
        return grants_today
    
# -----------------------------------------------------
#  MAIN 
# -----------------------------------------------------
# Endpoint para la API de asistente
# Endpoint para cambiar la contraseña del usuario
@app.route('/api/main', methods=['POST'])
def main():
    """
    Main function to execute the script.
    """
    # Establecer conexión con SharePoint
    logger.info("Connecting to SharePoint...")
    token, site_id, drive_id = conect_sharepoint_main(authority, client_id, raw_scope, secret, site_id_name)

    # Establecer conexión con PostgreSQL
    logger.info("Connecting to PostgreSQL...")
    conn = get_connection(username, password, host, port, database)
    cursor = conn.cursor()

    # Llamar a la función listar_subvenciones
    logger.info("Listing grants...")
    listar_subvenciones(cursor, conn, token, drive_id, path_guardar_resumen, milvus_host, milvus_port, 
                                milvus_collection_name, model_embedding, chatgpt_prompt_innovalaus, 
                        chatgpt_prompt_grantify, model_resumen, chatgpt_prompt_match, S3_BUCKET, s3_client, model_match)

    # Cerrar la conexión a la base de datos
    logger.info("Closing database connection...")
    cursor.close()
    conn.close()
    logger.info("Database connection closed.")
    
def run_main():
    logger.info("🟢 Ejecutando run_main() desde webhook")

    # Establecer conexión con SharePoint
    token, site_id, drive_id = conect_sharepoint_main(authority, client_id, raw_scope, secret, site_id_name)

    # Establecer conexión con PostgreSQL
    conn = get_connection(username, password, host, port, database)
    cursor = conn.cursor()

    # Llamar a la función principal
    listar_subvenciones(cursor, conn, token, drive_id, path_guardar_resumen,
                        milvus_host, milvus_port, milvus_collection_name,
                        model_embedding, chatgpt_prompt_innovalaus,
                        chatgpt_prompt_grantify, model_resumen, chatgpt_prompt_match,
                        S3_BUCKET, s3_client, client, model_match)

    cursor.close()
    conn.close()

    logger.info("✅ Proceso completo desde run_main()")
    


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)


