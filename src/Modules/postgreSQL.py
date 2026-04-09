
import psycopg2
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from Modules.logger_config import get_logger
logger = get_logger(__name__)

def get_connection(username, password, host, port, database):
    """
    Establishes and returns a connection to the PostgreSQL database.
    """
    try:
        conn = psycopg2.connect(
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
        return conn
    except Exception as e:
        logger.error("Error connecting to the database SQL:", e)
        raise
