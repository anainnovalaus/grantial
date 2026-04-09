import sys
import os
import threading
import time
import signal
from contextlib import contextmanager

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.postgreSQL import get_connection
from pymilvus import connections, Collection, utility
from openai import OpenAI
import boto3
from dotenv import load_dotenv
import logging

# Configurar logging con el mismo sistema que otros módulos
from Modules.logger_config import get_logger
logger = get_logger(__name__)

# ✅ Timeout context manager for connection attempts
@contextmanager
def connection_timeout(seconds):
    """Hard timeout for connection attempts using signals"""
    def timeout_handler(signum, frame):
        raise TimeoutError(f"Connection attempt timed out after {seconds} seconds")

    # Set the signal handler
    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)  # Cancel the alarm
        signal.signal(signal.SIGALRM, old_handler)

# Load environment variables from .env
load_dotenv()

# ✅ LAZY LOADING: No cargar SSM al importar, solo cuando se necesite
_ssm_cache = {}
_ssm_lock = threading.Lock()

# ✅ GLOBAL CONNECTION POOL: Reutilizar conexión entre requests
_milvus_connection = None
_milvus_collection = None
_connection_lock = threading.Lock()

def get_ssm_param(name, secure=True):
    """Obtiene parámetros de SSM con caché para evitar llamadas repetidas"""
    cache_key = (name, secure)

    with _ssm_lock:
        if cache_key in _ssm_cache:
            return _ssm_cache[cache_key]

        ssm = boto3.client("ssm", region_name="eu-central-1")
        response = ssm.get_parameter(Name=name, WithDecryption=secure)
        value = response["Parameter"]["Value"]
        _ssm_cache[cache_key] = value
        return value

class get_preguntas:
    def __init__(self, titulo_subvencion, chat_text):
        # Almacena los argumentos recibidos para usarlos en los métodos
        self.titulo_subvencion = titulo_subvencion
        self.chat_text = chat_text

        # ✅ LAZY LOADING: Obtener credenciales desde SSM solo cuando se necesiten
        self.milvus_uri = get_ssm_param("/grantify/milvus/ZILLIZ_URI", secure=False)
        self.milvus_token = get_ssm_param("/grantify/milvus/ZILLIZ_TOKEN", secure=False)
        self.collection_name = get_ssm_param("/grantify/milvus/ZILLIZ_COLLECTION", secure=False)

        # Validación temprana de credenciales
        if not self.milvus_uri or not self.milvus_token or not self.collection_name:
            error_msg = "❌ CREDENCIALES DE MILVUS NO CONFIGURADAS CORRECTAMENTE"
            logger.error(error_msg)
            logger.error(f"   ZILLIZ_URI: {self.milvus_uri}")
            logger.error(f"   ZILLIZ_TOKEN: {'***' if self.milvus_token else 'NONE'}")
            logger.error(f"   COLLECTION_NAME: {self.collection_name}")
            raise ValueError(error_msg)

        # Configuración de OpenAI
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.organization_id = os.getenv("OPENAI_ORG_ID")

        if not self.api_key:
            error_msg = "❌ OPENAI_API_KEY no configurada"
            logger.error(error_msg)
            raise ValueError(error_msg)

        self.client = OpenAI(
            api_key=self.api_key,
            organization=self.organization_id
        )

        logger.info("✅ Inicialización completada correctamente")
        
    def main(self):
        """
        Método principal que orquesta todo el proceso de búsqueda
        OPTIMIZADO: Reutiliza conexión global, NO la cierra después de cada request
        """
        try:
            logger.info(f"🔍 Iniciando búsqueda para subvención: '{self.titulo_subvencion}'")
            logger.info(f"📝 Pregunta del usuario: '{self.chat_text}'")

            # Obtener o crear conexión y colección (reutilizables)
            coleccion = self.get_or_create_collection()
            if not coleccion:
                logger.error("❌ No se pudo obtener la colección")
                return None

            # Generar el embedding de la pregunta (paralelo con PostgreSQL)
            embedding_pregunta = self.generar_embedding_openai()
            if not embedding_pregunta:
                logger.error("❌ No se pudo generar el embedding")
                return None

            # Buscar el código de subvención en PostgreSQL
            codigo_subvencion = self.buscar_codigo_subvencion_por_titulo()
            if not codigo_subvencion:
                logger.warning(f"⚠️ No se encontró el código de subvención para '{self.titulo_subvencion}'")
                return None

            # Buscar información de la subvención en Milvus
            respuesta = self.buscar_informacion_subvencion_por_codigo(coleccion, embedding_pregunta, codigo_subvencion)

            if not respuesta or len(respuesta) == 0:
                logger.warning(f"⚠️ No se encontraron resultados en Milvus para código '{codigo_subvencion}'")
                return None

            logger.info(f"✅ Encontrados {len(respuesta)} resultados relevantes")
            return respuesta

        except Exception as e:
            logger.error(f"❌ Error en el proceso de búsqueda: {e}", exc_info=True)
            return None

        # ✅ NO CERRAMOS LA CONEXIÓN - Se reutiliza entre requests para mejor performance

    def get_or_create_collection(self):
        """
        Obtiene la colección de Milvus, reutilizando conexión global si existe.
        MUCHO MÁS RÁPIDO que crear conexión nueva cada vez.
        """
        global _milvus_connection, _milvus_collection

        with _connection_lock:
            # Si ya tenemos colección cargada, verificar que siga válida
            if _milvus_collection is not None:
                try:
                    # Verificar que la conexión siga viva
                    _ = _milvus_collection.num_entities
                    logger.info("♻️ Reutilizando colección existente (FAST PATH)")
                    return _milvus_collection
                except Exception as e:
                    logger.warning(f"⚠️ Colección existente no válida: {e}. Recreando...")
                    _milvus_collection = None
                    _milvus_connection = None

            # Conectar a Milvus
            self.conectar_milvus()

            # Cargar colección
            try:
                logger.info(f"📦 Cargando colección '{self.collection_name}'...")
                _milvus_collection = Collection(self.collection_name, using="default")

                # Verificar si ya está cargada (evita reload innecesario)
                load_state = utility.load_state(self.collection_name, using="default")
                logger.info(f"   Estado de carga: {load_state}")

                if load_state != "Loaded":
                    logger.info("🔄 Cargando colección en memoria...")
                    _milvus_collection.load(_timeout=60)
                    logger.info("✅ Colección cargada en memoria")
                else:
                    logger.info("✅ Colección ya estaba cargada (SKIP)")

                num_entities = _milvus_collection.num_entities
                logger.info(f"📊 Colección contiene {num_entities} entidades")

                return _milvus_collection

            except Exception as e:
                logger.error(f"❌ Error al cargar la colección: {e}", exc_info=True)
                _milvus_collection = None
                return None

    def conectar_milvus(self, max_retries=3):
        """
        Conecta a Milvus con retry logic y exponential backoff.
        OPTIMIZADO: Verifica conexión existente antes de crear nueva.
        """
        global _milvus_connection

        logger.info("🔌 Verificando conexión a Milvus...")
        logger.info(f"   URI: {self.milvus_uri}")
        logger.info(f"   Token: {'***' if self.milvus_token else 'NONE'}")
        logger.info(f"   Collection: {self.collection_name}")

        last_error = None

        for attempt in range(max_retries):
            try:
                # Verificar si ya hay una conexión válida
                existing = connections.list_connections()
                logger.debug(f"   Conexiones existentes: {existing}")

                if existing and any('default' in str(conn) for conn in existing):
                    try:
                        # Probar que la conexión funciona
                        collections_list = utility.list_collections(using="default")
                        logger.info(f"♻️ Conexión existente válida (colecciones: {len(collections_list)})")
                        _milvus_connection = "default"
                        return
                    except Exception as check_error:
                        logger.debug(f"Conexión existente no válida: {check_error}")
                        try:
                            connections.remove_connection("default")
                            logger.debug("   🧹 Conexión anterior removida")
                        except:
                            pass
                        _milvus_connection = None

                # Crear nueva conexión
                if attempt > 0:
                    logger.info(f"🔄 Intento {attempt + 1}/{max_retries}...")
                else:
                    logger.info("🆕 Creando nueva conexión...")

                # ✅ Use hard timeout to prevent hanging on DNS/TLS
                with connection_timeout(45):  # 45 second hard limit
                    connections.connect(
                        alias="default",
                        uri=self.milvus_uri,
                        token=self.milvus_token,
                        secure=True,
                        db_name="default",  # ✅ Explicitly specify database
                        timeout=30  # pymilvus internal timeout
                    )

                # Verificar conexión
                logger.info("🔍 Verificando conexión...")
                collections_list = utility.list_collections(using="default")
                logger.info(f"✅ Conexión establecida. Colecciones: {collections_list}")
                _milvus_connection = "default"
                return  # Éxito!

            except Exception as e:
                last_error = e
                logger.warning(f"⚠️ Intento {attempt + 1}/{max_retries} falló: {e}")

                # Si es el último intento, lanzar error
                if attempt == max_retries - 1:
                    logger.error(f"❌ Todos los intentos fallaron. Último error: {e}", exc_info=True)
                    raise ConnectionError(f"No se pudo conectar a Milvus después de {max_retries} intentos: {e}")

                # Exponential backoff: 1s, 2s, 4s...
                wait_time = 2 ** attempt
                logger.info(f"⏳ Esperando {wait_time}s antes de reintentar...")
                time.sleep(wait_time)
            

    # ✅ MÉTODO ELIMINADO: cargar_coleccion() - Reemplazado por get_or_create_collection()
    # que implementa connection pooling para mejor performance


    def generar_embedding_openai(self):
        """Genera un embedding usando la API de OpenAI."""
        try:
            logger.info("🤖 Generando embedding con OpenAI...")
            response = self.client.embeddings.create(
                input=self.chat_text,
                model="text-embedding-3-small",
                timeout=30  # 30 seconds timeout
            )

            embedding_pregunta = response.data[0].embedding
            logger.info(f"✅ Embedding generado correctamente (dimensión: {len(embedding_pregunta)})")
            return embedding_pregunta

        except Exception as e:
            logger.error(f"❌ Error al generar embedding: {e}")
            return None
    
    def buscar_codigo_subvencion_por_titulo(self):
        """
        Busca en PostgreSQL el código de subvención a partir del título.
        Se asume que la tabla 'grants' tiene las columnas 'titulo_corto' y 'codigobdns'.
        """
        connection = None
        try:
            logger.info(f"🔍 Buscando código para título: '{self.titulo_subvencion}'")
            connection = get_connection()
            cursor = connection.cursor()
            logger.info("✅ Conectado a PostgreSQL")

            # First try exact match
            query = """
                SELECT codigobdns
                FROM grants
                WHERE titulo_corto = %s
            """

            cursor.execute(query, (self.titulo_subvencion,))
            result = cursor.fetchone()

            # If not found, try fuzzy match (handles period, spaces, etc.)
            if not result:
                logger.warning("⚠️ Exact match not found, trying fuzzy match...")
                query_fuzzy = """
                    SELECT codigobdns
                    FROM grants
                    WHERE TRIM(REGEXP_REPLACE(titulo_corto, '[.!?]$', '')) ILIKE TRIM(%s)
                    LIMIT 1
                """
                cursor.execute(query_fuzzy, (self.titulo_subvencion,))
                result = cursor.fetchone()
                if result:
                    logger.info("✅ Found with fuzzy match!")

            if result:
                codigo_subvencion = result[0]
                logger.info(f"✅ Código encontrado: {codigo_subvencion}")
                return codigo_subvencion
            else:
                logger.warning(f"⚠️ No se encontró código para '{self.titulo_subvencion}'")

                # Try to suggest similar grants
                query_similar = """
                    SELECT titulo_corto
                    FROM grants
                    WHERE titulo_corto ILIKE %s
                    LIMIT 3
                """
                cursor.execute(query_similar, (f'%{self.titulo_subvencion}%',))
                similar = cursor.fetchall()

                if similar:
                    similar_titles = [row[0] for row in similar]
                    logger.info(f"💡 Subvenciones similares encontradas: {similar_titles}")

                return None
            
        except Exception as e:
            logger.error(f"❌ Error al buscar código en PostgreSQL: {e}")
            return None
        
        finally:
            if connection:
                cursor.close()
                connection.close()
                logger.info("✅ Conexión a PostgreSQL cerrada")
        
    def buscar_informacion_subvencion_por_codigo(self, coleccion, embedding_pregunta, codigo_subvencion):
        """Realiza la búsqueda en Milvus usando el código de subvención y la pregunta."""
        try:
            top_k = 3
            logger.info(f"🔍 Buscando en Milvus (top_k={top_k}, código={codigo_subvencion})...")

            search_params = {
                "metric_type": "IP",
                "params": {"nprobe": 10}
            }

            expr_filtrado = f"code == '{codigo_subvencion}'"
            logger.info(f"   Filtro aplicado: {expr_filtrado}")

            resultados = coleccion.search(
                data=[embedding_pregunta],
                anns_field="embedding",
                param=search_params,
                limit=top_k,
                expr=expr_filtrado,
                output_fields=["content", "code"],
                timeout=60  # 60 seconds timeout for search
            )

            if not resultados or len(resultados) == 0:
                logger.warning("⚠️ La búsqueda no devolvió resultados")
                return []
            
            top_resultados = resultados[0]
            logger.info(f"📊 Encontrados {len(top_resultados)} resultados")
            
            respuesta = []
            for i, r in enumerate(top_resultados, 1):
                info = {
                    "score": r.score,
                    "content": r.entity.get("content"),
                    "code": r.entity.get("code")
                }
                respuesta.append(info)
                logger.info(f"   Resultado {i}: score={r.score:.4f}, code={r.entity.get('code')}")

            return respuesta
            
        except Exception as e:
            logger.error(f"❌ Error al buscar en Milvus: {e}")
            return []


# ✅ AÑADIDO: Script de prueba para verificar la configuración
if __name__ == "__main__":
    print("=" * 60)
    print("🔍 VERIFICANDO CONFIGURACIÓN DE MILVUS")
    print("=" * 60)
    
    # Verificar variables de entorno
    print("\n📋 Variables de entorno:")
    print(f"   ZILLIZ_URI: {os.getenv('ZILLIZ_URI')}")
    print(f"   ZILLIZ_TOKEN: {'***' if os.getenv('ZILLIZ_TOKEN') else 'NONE'}")
    print(f"   COLLECTION_NAME: {os.getenv('COLLECTION_NAME')}")
    print(f"   OPENAI_API_KEY: {'***' if os.getenv('OPENAI_API_KEY') else 'NONE'}")
    
    # Test de inicialización
    print("\n🧪 Test de inicialización:")
    try:
        handler = get_preguntas("Test Subvención", "¿Cuáles son los requisitos?")
        print("   ✅ Clase inicializada correctamente")
    except Exception as e:
        print(f"   ❌ Error al inicializar: {e}")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✅ VERIFICACIÓN COMPLETADA")
    print("=" * 60)
