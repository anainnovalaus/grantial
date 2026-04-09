#!/usr/bin/env python3
"""
Script de prueba para verificar la conexión a Milvus/Zilliz
"""
import os
import sys

# Añadir el path del proyecto (relativo al script, funciona en cualquier máquina)
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(script_dir, 'src'))

from pymilvus import connections, Collection, utility
import boto3
from dotenv import load_dotenv

load_dotenv()

def get_ssm_param(name, secure=True):
    """Obtener parámetros de AWS Systems Manager"""
    try:
        ssm = boto3.client("ssm", region_name="eu-central-1")
        response = ssm.get_parameter(Name=name, WithDecryption=secure)
        return response["Parameter"]["Value"]
    except Exception as e:
        print(f"❌ Error obteniendo parámetro {name}: {e}")
        return None

def test_milvus_connection():
    """Probar la conexión a Milvus"""
    print("=" * 70)
    print("🔍 TEST DE CONEXIÓN A MILVUS/ZILLIZ")
    print("=" * 70)
    
    # 1. Obtener credenciales
    print("\n📋 Paso 1: Obteniendo credenciales de AWS Parameter Store...")
    uri = get_ssm_param("/grantify/milvus/ZILLIZ_URI", secure=False)
    token = get_ssm_param("/grantify/milvus/ZILLIZ_TOKEN", secure=False)
    collection_name = get_ssm_param("/grantify/milvus/ZILLIZ_COLLECTION", secure=False)
    
    if not uri or not token or not collection_name:
        print("❌ ERROR: No se pudieron obtener las credenciales")
        return False
    
    print(f"   ✅ URI: {uri}")
    print(f"   ✅ Token: {'*' * 20}")
    print(f"   ✅ Collection: {collection_name}")
    
    # 2. Intentar conectar
    print("\n🔌 Paso 2: Conectando a Milvus...")
    try:
        connections.connect(
            alias="test_connection",
            uri=uri,
            token=token,
            secure=True,
            timeout=30
        )
        print("   ✅ Conexión establecida exitosamente!")
    except Exception as e:
        print(f"   ❌ Error al conectar: {e}")
        return False
    
    # 3. Verificar la colección
    print(f"\n📦 Paso 3: Verificando colección '{collection_name}'...")
    try:
        # Listar todas las colecciones disponibles
        collections = utility.list_collections(using="test_connection")
        print(f"   📋 Colecciones disponibles: {collections}")
        
        if collection_name not in collections:
            print(f"   ❌ La colección '{collection_name}' NO existe")
            return False
        
        print(f"   ✅ La colección '{collection_name}' existe")
        
        # Obtener información de la colección
        collection = Collection(name=collection_name, using="test_connection")
        print(f"   📊 Número de entidades: {collection.num_entities}")
        
        # Obtener el esquema
        schema = collection.schema
        print(f"   📋 Campos en la colección:")
        for field in schema.fields:
            print(f"      - {field.name} ({field.dtype})")
        
    except Exception as e:
        print(f"   ❌ Error al verificar colección: {e}")
        return False
    
    # 4. Hacer una búsqueda de prueba
    print("\n🔍 Paso 4: Realizando búsqueda de prueba...")
    try:
        # Primero, verificar que haya datos
        if collection.num_entities == 0:
            print("   ⚠️ La colección está vacía, no hay datos para buscar")
            return True  # La conexión funciona, solo está vacía
        
        # Crear un vector de prueba (1536 dimensiones para text-embedding-3-small)
        import random
        test_vector = [random.random() for _ in range(1536)]
        
        # Cargar la colección en memoria si no está cargada
        collection.load()
        
        # Realizar búsqueda
        search_params = {
            "metric_type": "IP",
            "params": {"nprobe": 10}
        }
        
        results = collection.search(
            data=[test_vector],
            anns_field="embedding",
            param=search_params,
            limit=3,
            output_fields=["content", "code"]
        )
        
        print(f"   ✅ Búsqueda completada exitosamente")
        print(f"   📊 Resultados encontrados: {len(results[0]) if results else 0}")
        
        if results and len(results[0]) > 0:
            print(f"   📝 Ejemplo de resultado:")
            first_result = results[0][0]
            print(f"      - Score: {first_result.score}")
            print(f"      - Code: {first_result.entity.get('code')}")
            content_preview = str(first_result.entity.get('content'))[:100]
            print(f"      - Content: {content_preview}...")
        
    except Exception as e:
        print(f"   ❌ Error en búsqueda de prueba: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 5. Desconectar
    print("\n🔌 Paso 5: Desconectando...")
    try:
        connections.disconnect("test_connection")
        print("   ✅ Desconectado exitosamente")
    except Exception as e:
        print(f"   ⚠️ Advertencia al desconectar: {e}")
    
    print("\n" + "=" * 70)
    print("✅ TODOS LOS TESTS PASARON EXITOSAMENTE")
    print("=" * 70)
    return True


if __name__ == "__main__":
    success = test_milvus_connection()
    sys.exit(0 if success else 1)
