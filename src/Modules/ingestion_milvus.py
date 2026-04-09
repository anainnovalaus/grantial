import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from Modules.logger_config import get_logger
logger = get_logger(__name__)
import re
import nltk
logger.info("▶ nltk importado")
nltk.data.path.append("/home/ubuntu/nltk_data")
from urllib.parse import quote
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType, utility
import boto3 
import os
import time
import signal
import uuid
from contextlib import contextmanager

@contextmanager
def timeout(seconds):
    def signal_handler(signum, frame):
        raise TimeoutError(f"Timeout después de {seconds} segundos")
    
    # Guardar el handler anterior para restaurarlo después
    old_handler = signal.signal(signal.SIGALRM, signal_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)  # Cancelar la alarma
        signal.signal(signal.SIGALRM, old_handler) 

def get_ssm_param(name, secure=True):
    ssm = boto3.client("ssm", region_name="eu-central-1")
    response = ssm.get_parameter(Name=name, WithDecryption=secure)
    return response["Parameter"]["Value"]
 
# ZILLIZ / Milvus desde Parameter Store
uri = os.environ["ZILLIZ_URI"] = get_ssm_param("/grantify/milvus/ZILLIZ_URI")
token = os.environ["ZILLIZ_TOKEN"] = get_ssm_param("/grantify/milvus/ZILLIZ_TOKEN")
collection_name = os.environ["COLLECTION_NAME"] = get_ssm_param("/grantify/milvus/ZILLIZ_COLLECTION", secure=False)

################################################
# 1. Configuración de la colección
################################################
def init_collection(uri, token, collection_name):
    logger.info(f"Collection Name: {collection_name}")
    logger.info(f"Uri: {uri}")
    logger.info(f"Conectando a Zilliz...")
    # Generar alias único para cada conexión
    alias = f"conn_{uuid.uuid4().hex[:8]}"
    
    logger.info(f"Conectando a Zilliz con alias: {alias}")
    
    try:
        with timeout(120):
            connections.connect(
                alias=alias,  # Alias único
                uri=uri,
                token=token,
                secure=True,
                db_name="default",
                timeout=120
            )
        
        logger.info(f"Conectado a Zilliz")
        logger.info(f"Colección {collection_name} cargada correctamente")
        collection = Collection(name=collection_name, using=alias)  # Usar alias específico
        return collection

    except TimeoutError:
        logger.error("Timeout conectando a Zilliz después de 120s")
        return None
    except Exception as e:
        logger.error(f"Error conectando a Zilliz: {e}")
        return None

################################################
# 2. Procesar carpeta y subir a Milvus
################################################
def process_folder(client, subvencion_name, text_content, collection, model_embedding):
    """
    Procesa el texto, genera chunks, crea embeddings en batch e inserta en Milvus.
    Evita el uso de una variable local 'content' para no provocar UnboundLocalError.
    """
    logger.info(f"📂 Procesando subvencion: {subvencion_name}")
    logger.info(f"Utilizando model de embedding: {model_embedding}")
    try:
        chunks = split_by_patterns(client, text_content, model_embedding)
        logger.info(f"Total chunks generados: {len(chunks)}")

        # Construimos las columnas a insertar (sin usar 'content' como nombre local)
        texts, cats = [], []
        for ch in chunks:
            chunk_text = ch.get("content", "")
            if isinstance(chunk_text, list):
                chunk_text = " ".join(map(str, chunk_text))
            texts.append(chunk_text)
            cats.append(ch.get("category"))

        logger.info(f"Creando {len(texts)} embeddings en batch")
        # Batch embeddings: input = lista de textos; el orden de respuesta coincide
        resp = client.embeddings.create(model=model_embedding, input=texts, timeout=60)
        vectors = [item.embedding for item in resp.data]

        # Inserción columnar en Milvus (1 lista por campo, en el mismo orden definido en el schema)
        entities = [
            vectors,                          # campo vector
            [t[:5000] for t in texts],        # campo texto (truncado opcional)
            cats,                             # campo categoría
            [subvencion_name] * len(texts),   # campo code
        ]
        collection.insert(entities)
        
        collection.flush()
        logger.info("✅ Datos persistidos en Zilliz con flush() exitosamente")
        # *** FIN ***

        logger.info("Milvus procesado y cargado exitosamente.")
        return True
        
    except Exception:
        # MUESTRA stacktrace completo con archivo/línea exactos
        logger.exception("Error procesando Milvus")
        return


################################################
# 4. División por patrones
################################################
def split_by_patterns(client, subfolder_text, model_embedding, max_tokens: int = 1000, overlap: int = 50):
    """
    Divide el texto en segmentos basados en ciertos patrones (capítulos, artículos...).
    Luego, cada segmento se trocea en chunks de `max_tokens` con superposición.
    """
    logger.info("Dividiendo texto por patrones...")
    CAPITOL_PATTERNS = [
        r"^(CAPÍTULO\s[XVI][XIV]?[XIV]?[XIV]?)(.*)",
        r"^(CAPÍTOL\s[XVI][XIV]?[XIV]?[XIV]?)(.*)"
    ]

    SECTION_PATTERNS = [
        r"^(Primero|Segundo|Tercero|Cuarto|Quinto|Sexto|Séptimo|Octavo|Noveno|Décimo)",
        r"^(Artículo\s\d+)[\s.](.*)",
        r"^(Base\s\d+)[\s.]?(.*)"
    ]

    PATTERNS = CAPITOL_PATTERNS + SECTION_PATTERNS

    matches = list(re.finditer('|'.join(PATTERNS), subfolder_text, flags=re.IGNORECASE | re.MULTILINE))
    sections = []

    if not matches:
        logger.info("No hay Matches")
        # Si no hay coincidencias, devolvemos el texto completo en una sola 'sección'
        return chunk_sections(
            [{"content": subfolder_text}],
            max_tokens,
            overlap,
            client,
            model_embedding
        )

    last_index = 0
    for i, match in enumerate(matches):
        start = match.start()

        if i > 0:
            # La sección anterior va desde 'last_index' hasta 'start'
            content = subfolder_text[last_index:start].strip()
            sections[-1]["content"] = content

        sections.append({"content": ""})
        last_index = start

    # Asegurar que la última sección tenga contenido
    if sections:
        logger.info("Existen secciones")
        content = subfolder_text[last_index:].strip()
        sections[-1]["content"] = content

    return chunk_sections(sections, max_tokens, overlap, client, model_embedding)

################################################
# 4.1. Trocear secciones en chunks de tokens
################################################
def chunk_sections(sections, max_tokens, overlap, client, model_embedding):
    chunks = []
    logger.info("Troceando secciones en chunks...")
    for sec in sections:
        sec_text = sec.get("content", "")
        tokens = word_tokenize(sec_text)

        start = 0
        while start < len(tokens):
            end = start + max_tokens
            chunk_tokens = tokens[start:end]
            chunk_text = " ".join(chunk_tokens)

            category = classify_category(chunk_text, client, model_embedding)
            chunks.append({
                "content": chunk_text,
                "category": category
            })

            # solape
            next_start = end - overlap
            start = next_start if next_start > start else end

    return chunks

################################################
# 5. Clasificación de categorías
################################################
def classify_category(content, client, model_embedding):
    """
    Clasifica un texto en las categorías predefinidas basándose en embeddings y similitud vectorial.
    """
    CATEGORIAS = {
        "CONVOCATORIA": [
            "Convocatoria", "Convocatoria de subvención", "Convocatoria de ayuda"
        ],
        "OBJETO": [
            "Objeto", "Finalidades y principios", "Ámbito de aplicación", "Base Objeto"
        ],
        "BENEFICIARIOS": [
            "Empresas Beneficiarias", "Beneficiarios de la subvención", "Beneficiarios",
            "Beneficiarias", "Personas beneficiarias", "Personas destinatarias", "Entidades beneficiarias"
        ],
        "REQUISITOS": [
            "Requisitos para obtener la subvención", "Requisitos e incompatibilidades",
            "Otras obligaciones", "Compromiso ambiental", "Criterios de selección",
            "Obligaciones", "Exclusiones", "Compatibilidad", "Concurrencia"
        ],
        "IMPORTES": [
            "Importe de la subvención", "Pagos", "Destino y cuantías", "Cuantía máxima", "Pago", "Financiación"
        ],
        "ACCIONES_GASTOS": [
            "Actuaciones subvencionables", "Gastos subvencionables", "Subcontratación",
            "Ámbito y alcance", "Aplicación de la ayuda", "Contrataciones"
        ],
        "SOLICITUD": [
            "Solicitud de la subvención", "Presentación de solicitudes", "Trámites asociados"
        ],
        "DOCUMENTACION": [
            "Documentación requerida", "Anexos y declaraciones", "Presentación adicional"
        ],
        "PERIODOS": [
            "Plazo de presentación", "Plazos de ejecución y justificación", "Fechas clave"
        ],
        "CRITERIOS": [
            "Criterios de valoración", "Condiciones de asignación", "Ponderaciones"
        ],
        "PROCEDIMIENTO": [
            "Valoración técnica", "Procedimiento de concesión", "Instrucción y ejecución",
            "Control e inspección", "Comisiones evaluadoras"
        ],
        "RESOLUCION": [
            "Resolución provisional", "Modificación y publicación", "Aceptación de ayudas",
            "Revisión de subvenciones"
        ],
        "PUBLICIDAD": [
            "Publicidad de subvenciones", "Identificación y difusión", "Obligaciones del beneficiario"
        ],
        "JUSTIFICACION": [
            "Justificación de la ayuda", "Verificación y seguimiento", "Indicadores y evaluación"
        ],
        "REVOCACION": [
            "Revocación y reintegro", "Régimen sancionador", "Renuncias y devoluciones"
        ],
        "SANCIONES": [
            "Sanciones aplicables", "Reintegros e infracciones"
        ],
        "LEGAL": [
            "Protección de datos", "Normativa aplicable", "Aspectos fiscales"
        ],
        "TRAMITACION": [
            "Tramitación electrónica", "Compatibilidad de ayudas"
        ]
    }

    logger.info("Clasificando categoría...")
    # Usamos un modelo de OpenAI para embeddings
    response = client.embeddings.create(model=model_embedding, input=content)
    content_embedding = response.data[0].embedding

    category_scores = {}

    for category, keywords in CATEGORIAS.items():
        keywords_text = " ".join(keywords)
        response = client.embeddings.create(model=model_embedding, input=keywords_text, timeout=20 )
        category_embedding = response.data[0].embedding

        # Sencilla similitud por producto punto
        similarity = sum(a * b for a, b in zip(content_embedding, category_embedding))
        category_scores[category] = similarity

    sorted_categories = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_categories[0][0] if sorted_categories else None

################################################
#################### MAIN ######################
################################################
def ingestion_main(client, subvencion_name, text_content, milvus_host, milvus_port, 
                            milvus_collection_name, model_embedding):
    logger.info("Ingestion de subvenciones en Milvus iniciando...")
    # Descargar los recursos necesarios de NLTK
    required_resources = ["punkt_tab", "stopwords"]
    logger.info("Ingestion de subvenciones en Milvus iniciando...")
    for resource in required_resources:
        try:
            if resource == "punkt_tab":
                nltk.data.find("tokenizers/punkt_tab")
            elif resource == "stopwords":
                nltk.data.find("corpora/stopwords")

        except LookupError:
            logger.info(f"📥 Descargando recurso NLTK: {resource}")
            if resource == "punkt_tab":
                nltk.download("punkt_tab", download_dir="/home/ubuntu/nltk_data")
            elif resource == "stopwords":
                nltk.download("stopwords", download_dir="/home/ubuntu/nltk_data")


    stop_words = set(stopwords.words("spanish"))

    # Convertir lista a string
    if isinstance(text_content, list):
        # Concatenar todos los contenidos con separadores
        combined_text = "\n\n".join(text_content)
        logger.info(f"📝 Combinando {len(text_content)} documentos en un solo texto")
    else:
        combined_text = text_content

    logger.info("Iniciando el procesamiento de subvenciones...")
    # Iniciamos o recuperamos la colección
    collection = init_collection(uri, token, collection_name)
    milvus_success = process_folder(client, subvencion_name, combined_text, collection, model_embedding)

    if not milvus_success:
        logger.info("No se pudo procesar la carpeta en Milvus.")
        return
    
    logger.info("Procesamiento completado.")