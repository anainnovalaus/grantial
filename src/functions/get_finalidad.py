import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.postgreSQL import get_connection

class sub_finalidad():
    def __init__():
        pass
    
    def finalidad(finalidad):
        try:
            connection = get_connection()
            cursor = connection.cursor()
            grants_finalidad = []
            print("Connected to the database successfully.")

            # Prepare the query to select only the required columns
            query = """
                SELECT titulo_corto
                FROM grants 
                WHERE finalidad = %s
            """  
            
            # Execute the query using today's date as parameter
            cursor.execute(query, (finalidad,))
            rows = cursor.fetchall()

            print("Rows with finalidad:")
            for row in rows:
                print(row)
                grants_finalidad += row
            
        except Exception as e:
            print("An error occurred:", e)
            grants_finalidad = "There are no grants for this finalidad"
        finally:
            # Close the cursor and connection if they were opened
            if connection:
                cursor.close()
                connection.close()
                print("Database connection closed.")
        
        print(grants_finalidad)
        return grants_finalidad
    

