import io
from typing import List
import boto3
from docx import Document
from PyPDF2 import PdfReader
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from Modules.logger_config import get_logger
logger = get_logger(__name__)

# ── 1. LISTAR KEYS BAJO UN PREFIJO ────────────────────────────────────────────
def list_s3_keys(prefix: str, S3_BUCKET, s3_client) -> List[str]:
    """
    Lista todas las keys de objetos en S3 bajo un prefijo dado.
    """
    logger.info(f"Listando archivos en S3")
    paginator = s3_client.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    logger.info(f"Archivos encontrados: {keys}")
    return keys

# ── 2. FUNCIONES DE LECTURA SEGÚN EXTENSIÓN ────────────────────────────────────

def read_s3_pdf(key: str, S3_BUCKET, s3_client) -> str:
    """
    Extrae texto de un PDF almacenado en S3.
    """
    logger.info(f"Leyendo pdf {key}...")
    resp = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
    pdf_bytes = resp["Body"].read()
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages = [p.extract_text() or "" for p in reader.pages]
    logger.info(f"Texto extraído de {key}: {pages}")
    return "\n".join(pages)

def read_s3_docx(key: str, S3_BUCKET, s3_client) -> str:
    """
    Extrae texto de un DOCX almacenado en S3.
    """
    logger.info(f"Leyendo word {key}...")
    resp = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
    doc_bytes = resp["Body"].read()
    doc = Document(io.BytesIO(doc_bytes))
    paragraphs = [p.text for p in doc.paragraphs]
    logger.info(f"Texto extraído de {key}: {paragraphs}")
    return "\n".join(paragraphs)

def read_s3_txt(key: str, encoding, S3_BUCKET, s3_client) -> str:
    """
    Lee cualquier archivo de texto plano (.txt, .csv...) almacenado en S3.
    """
    logger.info(f"Leyendo text {key}...")
    resp = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
    return resp["Body"].read().decode(encoding, errors="ignore")

def read_s3_object(key: str, S3_BUCKET, s3_client) -> str:
    """
    Selecciona la función de lectura adecuada según la extensión del archivo.
    """
    lower = key.lower()
    if lower.endswith(".pdf"):
        return read_s3_pdf(key, S3_BUCKET, s3_client)
    elif lower.endswith(".docx"):
        return read_s3_docx(key,S3_BUCKET, s3_client)
    else:
        # Por defecto, lo tratamos como texto plano
        encoding = "utf-8"
        return read_s3_txt(key, encoding, S3_BUCKET, s3_client)

# ── 0. PROCESAR UNA “SUBVENCIÓN” EN S3 ────────────────────────────────────────

def process_subvencion_s3(subvencion_prefix: str, S3_BUCKET, s3_client) -> List[str]:
    logger.info(f"🪣 Buscando en bucket: '{S3_BUCKET}' con prefijo: '{subvencion_prefix}'")
    # Asegura el slash final
    prefix = subvencion_prefix.rstrip("/") + "/"
    keys = list_s3_keys(prefix, S3_BUCKET, s3_client)
    logger.info(f"🔍 Encontrados {len(keys)} archivos bajo '{prefix}'")

    contenidos = []
    for key in keys:
        logger.info(f"  • Leyendo {key} ...")
        texto = read_s3_object(key, S3_BUCKET, s3_client)
        contenidos.append(texto)

    if not contenidos:
        logger.info("⚠️ No se encontraron documentos en S3 para esta subvención.")
    return contenidos

