
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.postgreSQL import get_connection

class get_match():
    def __init__():
        pass
    
    def get_best_matches():
        """
        Returns up to three grants that best match the entity associated with the user's profile
        with a match number of 70 or higher.
        """
        try:
            connection = get_connection()
            cursor = connection.cursor()
            
            print("Connected to the database successfully.")

            # Get the current user's selected entity
            query = """
                SELECT e.id, e.razon_social
                FROM entities e
                JOIN user_entities ue ON e.id = ue.entity_id
                JOIN users u ON ue.user_id = u.id
                WHERE u.is_current_user = TRUE AND ue.is_selected = TRUE
                LIMIT 1
            """
            cursor.execute(query)
            entity_result = cursor.fetchone()
            
            if not entity_result:
                print("No selected entity found for current user")
                # Try to get any entity for the current user
                fallback_query = """
                    SELECT e.id, e.razon_social
                    FROM entities e
                    JOIN user_entities ue ON e.id = ue.entity_id
                    JOIN users u ON ue.user_id = u.id
                    WHERE u.is_current_user = TRUE
                    ORDER BY ue.created_at DESC
                    LIMIT 1
                """
                cursor.execute(fallback_query)
                entity_result = cursor.fetchone()
                
                if not entity_result:
                    print("No entity found for current user")
                    return []
                
            id_entidad = entity_result[0]
            nombre_entidad = entity_result[1]
            print(f"Found entity with ID: {id_entidad}, Name: {nombre_entidad}")

            # Get top 3 matches with match number >= 70
            query = """
                SELECT m.grant_id, g.titulo_corto, g.presupuesto, g.fecha_finalizacion, m.justificacion, g.resumen, 
                        g.beneficiarios, g.region_impacto, m.numero_match
                FROM matches m
                JOIN grants g ON m.grant_id = g.id
                WHERE m.entity_id = %s AND m.numero_match >= 70
                ORDER BY m.numero_match DESC
                LIMIT 3
            """
            cursor.execute(query, (id_entidad,))
            matches = cursor.fetchall()
            
            print(f"Found {len(matches)} matching grants for entity {nombre_entidad}")
            
            result = []
            for match in matches:
                result.append({
                    "grant_id": match[0],
                    "title": match[1],
                    "amount": match[2],
                    "deadline": match[3],
                    "justificacion": match[4],
                    "resumen": match[5],
                    "beneficiario": match[6] if match[6] else "No especificado",
                    "lugar": match[7] if match[7] else "No especificado",
                    "numero_match": match[8]
                })
            
            return result

        except Exception as e:
            print("An error occurred:", e)
            return []
        finally:
            # Close the cursor and connection if they were opened
            if 'connection' in locals() and connection:
                cursor.close()
                connection.close()
                print("Database connection closed.")
