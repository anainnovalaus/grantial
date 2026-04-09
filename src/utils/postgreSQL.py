
import psycopg2
from dotenv import load_dotenv
import os
import json

def get_connection():
    """
    Establishes and returns a connection to the PostgreSQL database.
    """
    print("Estableciendo conexión a la base de datos PostgreSQL...")
    # Load environment variables from .env
    load_dotenv()

    # Recuperar las credenciales de las variables de entorno
    username = os.getenv("POSTGRE_USER")
    password = os.getenv("POSTGRE_PASSWORD")
    host = os.getenv("POSTGRE_HOST")
    port = os.getenv("POSTGRE_PORT")
    database = os.getenv("POSTGRE_DATABASE")

    try:
        connection = psycopg2.connect(
            user=username,
            password=password,
            host=host,
            port=port,
            database=database
        )
        # Set numeric types to be returned as Python Decimal objects
        DEC2FLOAT = psycopg2.extensions.new_type(
            psycopg2.extensions.DECIMAL.values,
            'DEC2FLOAT',
            lambda value, curs: float(value) if value is not None else None
        )
        psycopg2.extensions.register_type(DEC2FLOAT)
        return connection
    except Exception as e:
        print("Error connecting to the database SQL:", e)
        raise
