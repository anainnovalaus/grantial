"""
Módulo para controlar el límite de mensajes diarios del chat assistant
Límite: 8 mensajes por usuario por día
Reseteo: Automático a medianoche (timezone Europe/Madrid)
"""

from datetime import datetime, date, timedelta
import pytz
from utils.postgreSQL import get_connection

# Configuración
DAILY_MESSAGE_LIMIT = 8
TIMEZONE = pytz.timezone('Europe/Madrid')

def check_user_limit(user_id: str) -> dict:
    """
    Verifica si el usuario puede enviar más mensajes hoy
    
    Args:
        user_id (str): ID del usuario
        
    Returns:
        dict: {
            "allowed": bool,
            "remaining": int,
            "reset_time": str,
            "message_count": int
        }
    """
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        # Obtener fecha actual en timezone de Madrid
        now_madrid = datetime.now(TIMEZONE)
        today = now_madrid.date()
        
        # Buscar el registro de uso del usuario para hoy
        query = """
            SELECT message_count, date
            FROM chat_usage_limits
            WHERE user_id = %s AND date = %s
            LIMIT 1
        """
        
        cursor.execute(query, (user_id, today))
        result = cursor.fetchone()
        
        if result:
            message_count = result[0]
            record_date = result[1]
            
            # Verificar si la fecha del registro es de hoy
            if isinstance(record_date, str):
                record_date = datetime.strptime(record_date, "%Y-%m-%d").date()
            
            # Si el registro es de un día anterior, resetear contador
            if record_date < today:
                message_count = 0
                update_query = """
                    UPDATE chat_usage_limits
                    SET message_count = 0, date = %s, last_reset = CURRENT_TIMESTAMP
                    WHERE user_id = %s
                """
                cursor.execute(update_query, (today, user_id))
                connection.commit()
        else:
            # No hay registro para este usuario, crearlo
            message_count = 0
            insert_query = """
                INSERT INTO chat_usage_limits (user_id, date, message_count, last_reset)
                VALUES (%s, %s, 0, CURRENT_TIMESTAMP)
            """
            cursor.execute(insert_query, (user_id, today))
            connection.commit()
        
        # Calcular cuántos mensajes quedan
        remaining = max(0, DAILY_MESSAGE_LIMIT - message_count)
        allowed = message_count < DAILY_MESSAGE_LIMIT
        
        # Calcular cuándo se resetea (medianoche del día siguiente)
        next_midnight = datetime.combine(today, datetime.min.time()) + timedelta(days=1)
        next_midnight_madrid = TIMEZONE.localize(next_midnight)
        reset_time = next_midnight_madrid.strftime("%H:%M")
        
        cursor.close()
        connection.close()
        
        return {
            "allowed": allowed,
            "remaining": remaining,
            "reset_time": reset_time,
            "message_count": message_count
        }
        
    except Exception as e:
        print(f"Error checking user limit: {e}")
        # En caso de error, permitir el mensaje (fail-safe)
        return {
            "allowed": True,
            "remaining": DAILY_MESSAGE_LIMIT,
            "reset_time": "00:00",
            "message_count": 0
        }

def increment_usage(user_id: str) -> bool:
    """
    Incrementa el contador de mensajes del usuario para hoy
    
    Args:
        user_id (str): ID del usuario
        
    Returns:
        bool: True si se incrementó correctamente, False si hubo error
    """
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        # Obtener fecha actual en timezone de Madrid
        now_madrid = datetime.now(TIMEZONE)
        today = now_madrid.date()
        
        # Incrementar el contador o crear registro si no existe
        query = """
            INSERT INTO chat_usage_limits (user_id, date, message_count, last_reset)
            VALUES (%s, %s, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, date)
            DO UPDATE SET 
                message_count = chat_usage_limits.message_count + 1,
                updated_at = CURRENT_TIMESTAMP
        """
        
        cursor.execute(query, (user_id, today))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return True
        
    except Exception as e:
        print(f"Error incrementing usage: {e}")
        return False

def get_user_stats(user_id: str) -> dict:
    """
    Obtiene estadísticas de uso del usuario
    
    Args:
        user_id (str): ID del usuario
        
    Returns:
        dict: Estadísticas de uso
    """
    try:
        connection = get_connection()
        cursor = connection.cursor()
        
        # Estadísticas del día actual
        today = datetime.now(TIMEZONE).date()
        query_today = """
            SELECT message_count
            FROM chat_usage_limits
            WHERE user_id = %s AND date = %s
        """
        cursor.execute(query_today, (user_id, today))
        result = cursor.fetchone()
        today_count = result[0] if result else 0
        
        # Total histórico
        query_total = """
            SELECT SUM(message_count) as total
            FROM chat_usage_limits
            WHERE user_id = %s
        """
        cursor.execute(query_total, (user_id,))
        result = cursor.fetchone()
        total_count = result[0] if result and result[0] else 0
        
        cursor.close()
        connection.close()
        
        return {
            "today": today_count,
            "total": total_count,
            "limit": DAILY_MESSAGE_LIMIT
        }
        
    except Exception as e:
        print(f"Error getting user stats: {e}")
        return {
            "today": 0,
            "total": 0,
            "limit": DAILY_MESSAGE_LIMIT
        }
