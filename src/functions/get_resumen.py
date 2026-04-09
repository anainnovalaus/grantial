import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.postgreSQL import get_connection
from openai import OpenAI
 
class GetResumen():
    def __init__():
        pass
    def resumen(titulo):
        try:
            connection = get_connection()
            cursor = connection.cursor()
            print("Connected to the database successfully.")
            print(f"🔍 Titulo a buscar: '{titulo}'")
            print(f"   Longitud: {len(titulo)} caracteres")

            # First, check for similar titles
            search_query = """
                SELECT titulo_corto, resumen_completo IS NOT NULL as has_resumen
                FROM public.grants
                WHERE titulo_corto ILIKE %s
                LIMIT 5
            """
            cursor.execute(search_query, (f'%{titulo}%',))
            similar = cursor.fetchall()
            print(f"📋 Títulos similares: {len(similar)}")
            for s in similar:
                print(f"   - '{s[0]}' (resumen: {'Sí' if s[1] else 'No'})")

            # First try exact match
            query_exact = """
                SELECT resumen_completo
                FROM public.grants
                WHERE titulo_corto = %s
            """
            cursor.execute(query_exact, (titulo,))
            resumen = cursor.fetchone()

            # If not found, try fuzzy match (handles period, spaces, etc.)
            if not resumen:
                print("⚠️ Exact match not found, trying fuzzy match...")
                query_fuzzy = """
                    SELECT resumen_completo
                    FROM public.grants
                    WHERE TRIM(REGEXP_REPLACE(titulo_corto, '[.!?]$', '')) ILIKE TRIM(%s)
                    LIMIT 1
                """
                cursor.execute(query_fuzzy, (titulo,))
                resumen = cursor.fetchone()
                if resumen:
                    print("✅ Found with fuzzy match!")

            print(f"✅ Resumen encontrado: {resumen is not None}")
            if resumen:
                print(f"   Longitud: {len(resumen[0]) if resumen[0] else 0} chars")
 
            
        except Exception as e:
            print("An error occurred:", e)
            resumen = "It was not possible to get the summary of the grant"
        finally:
            # Close the cursor and connection if they were opened
            if connection:
                cursor.close()
                connection.close()
                print("Database connection closed.")
        
        print(resumen)
        return resumen