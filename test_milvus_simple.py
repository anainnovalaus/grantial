#!/usr/bin/env python3
"""
Script de prueba simple para verificar la conexión a Milvus/Zilliz usando .env
"""
import os
from pymilvus import connections, Collection, utility
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

def test_milvus_connection():
    """Probar la conexión a Milvus usando variables de .env"""
    print("=" * 70)
    print("🔍 TEST DE CONEXIÓN A MILVUS/ZILLIZ (usando .env)")
    print("=" * 70)

    # 1. Obtener credenciales del .env
    print("\n📋 Paso 1: Leyendo credenciales del archivo .env...")
    uri = os.getenv("ZILLIZ_URI")
    token = os.getenv("ZILLIZ_TOKEN")
    collection_name = os.getenv("COLLECTION_NAME")

    # Diagnóstico detallado
    print(f"\n🔍 DIAGNÓSTICO DE VARIABLES:")
    print(f"   ZILLIZ_URI raw: {repr(uri)}")
    print(f"   ZILLIZ_TOKEN raw: {repr(token[:20] if token else None)}...")
    print(f"   COLLECTION_NAME raw: {repr(collection_name)}")

    # Validar y limpiar
    if uri:
        uri = uri.strip()
        # Si no tiene https://, agregarlo
        if not uri.startswith('http'):
            uri = f"https://{uri}.aws-us-east-2.vectordb.zillizcloud.com"
            print(f"   ✅ URI construido: {uri}")

    if token:
        token = token.strip()
        print(f"   ✅ Token: {'*' * 20}... (longitud: {len(token)})")

    if collection_name:
        collection_name = collection_name.strip()
        if not collection_name:
            # Usar un nombre por defecto si está vacío
            collection_name = "subvenciones_chunks"
            print(f"   ⚠️ COLLECTION_NAME vacío, usando: {collection_name}")
        else:
            print(f"   ✅ Collection: {collection_name}")

    # Verificar que tengamos las credenciales necesarias
    if not uri or not token:
        print("\n❌ ERROR: Faltan credenciales en el archivo .env")
        print("\n💡 Verifica que .env tenga:")
        print("   ZILLIZ_URI=tu-endpoint")
        print("   ZILLIZ_TOKEN=tu-token")
        print("   COLLECTION_NAME=nombre-coleccion")
        return False

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
        print(f"\n💡 Detalles del error:")
        import traceback
        traceback.print_exc()
        return False

    # 3. Listar colecciones disponibles
    print("\n📦 Paso 3: Listando colecciones disponibles...")
    try:
        collections = utility.list_collections(using="test_connection")
        print(f"   📋 Colecciones disponibles: {collections}")

        if not collections:
            print("   ⚠️ No hay colecciones en esta instancia de Milvus")
            return True  # Conexión OK, pero sin colecciones

        # Si no especificamos collection_name o está vacío, usar la primera
        if not collection_name and collections:
            collection_name = collections[0]
            print(f"   💡 Usando primera colección disponible: {collection_name}")

        if collection_name not in collections:
            print(f"   ⚠️ La colección '{collection_name}' NO existe")
            print(f"   💡 Colecciones disponibles: {collections}")
            print(f"   💡 Puedes actualizar COLLECTION_NAME en .env")
            return True  # Conexión OK, solo que la colección no existe

        print(f"   ✅ La colección '{collection_name}' existe")

        # 4. Obtener información de la colección
        print(f"\n📊 Paso 4: Información de la colección '{collection_name}'...")
        collection = Collection(name=collection_name, using="test_connection")
        print(f"   📊 Número de entidades: {collection.num_entities}")

        # Obtener el esquema
        schema = collection.schema
        print(f"   📋 Campos en la colección:")
        for field in schema.fields:
            print(f"      - {field.name} ({field.dtype})")

        # 5. Verificar si hay datos
        if collection.num_entities == 0:
            print("\n   ⚠️ La colección está vacía, no hay datos")
            return True

        print(f"\n   ✅ La colección tiene {collection.num_entities} registros")

    except Exception as e:
        print(f"   ❌ Error al verificar colección: {e}")
        import traceback
        traceback.print_exc()
        return False

    # 6. Desconectar
    print("\n🔌 Paso 5: Desconectando...")
    try:
        connections.disconnect("test_connection")
        print("   ✅ Desconectado exitosamente")
    except Exception as e:
        print(f"   ⚠️ Advertencia al desconectar: {e}")

    print("\n" + "=" * 70)
    print("✅ TEST COMPLETADO EXITOSAMENTE")
    print("=" * 70)
    return True


if __name__ == "__main__":
    import sys
    success = test_milvus_connection()
    sys.exit(0 if success else 1)
