from datetime import date, timedelta
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from utils.postgreSQL import get_connection

class subvenciones_hoy():
    def __init__():
        pass
    
    def listar_subvenciones():
        try:
            connection = get_connection()
            cursor = connection.cursor()
            grants_today = []
            print("Connected to the database successfully.")

            # Get today's date
            today = date.today()
            yesterday = today - timedelta(days=1)  # Resta un día
            yesterday_formatted = yesterday.strftime("%Y/%m/%d")

            print("Yesterday's date:", yesterday_formatted)
        
            # Prepare the query to select only the required columns
            query = """
                SELECT titulo_corto
                FROM grants 
                WHERE fecha_de_publicacion = %s
            """  
            
            # Execute the query using today's date as parameter
            cursor.execute(query, (yesterday_formatted,))
            rows = cursor.fetchall()

            print("Rows with today's date:")
            for row in rows:
                print(row)
                grants_today += row
            
        except Exception as e:
            print("An error occurred:", e)
            grants_today = "Today there are no grants"
            return grants_today
        finally:
            # Close the cursor and connection if they were opened
            if connection:
                cursor.close()
                connection.close()
                print("Database connection closed.")
        
        print(grants_today)
        return grants_today
    

