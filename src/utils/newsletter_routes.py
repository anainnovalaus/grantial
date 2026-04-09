
from flask import Blueprint, request, jsonify
from .postgreSQL import get_connection
from functools import wraps
import time
import re
from Modules.logger_config import get_logger
logger = get_logger(__name__)
from utils.postgreSQL import get_connection

newsletter_bp = Blueprint('newsletter', __name__)

# Rate limiting implementation
rate_limits = {}  # IP -> {count: int, reset_time: float}

def rate_limit(max_requests=10, window=60):
    """Rate limiting decorator for API endpoints"""
    logger.info(f"Setting rate limit: {max_requests} requests per {window} seconds")
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            # Get client IP
            ip = request.remote_addr
            
            # Get current time
            current_time = time.time()
            
            # Initialize or reset rate limit data
            if ip not in rate_limits or rate_limits[ip]['reset_time'] <= current_time:
                rate_limits[ip] = {
                    'count': 0,
                    'reset_time': current_time + window
                }
            
            # Check if rate limit exceeded
            if rate_limits[ip]['count'] >= max_requests:
                return jsonify({
                    'error': 'Demasiadas solicitudes',
                    'retry_after': int(rate_limits[ip]['reset_time'] - current_time)
                }), 429
            
            # Increment request count
            rate_limits[ip]['count'] += 1
            
            # Process the request
            return f(*args, **kwargs)
        return wrapped
    return decorator

def validate_email(email):
    """Validate email format using regex"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

@newsletter_bp.route('/subscribe', methods=['POST'])
@rate_limit(10, 300)  # 10 suscripciones por 5 minutos
def subscribe():
    """
    Endpoint para suscribirse al newsletter
    Body: { "email": "user@example.com", "source": "blog" }
    """
    
    data = request.json
    if not data:
        return jsonify({"error": "Faltan datos en la solicitud"}), 400
    
    email = data.get('email', '').strip().lower()
    source = data.get('source', 'blog')

    logger.info(f"Received newsletter subscribe request from email: {email}, source: {source}")
    
    # Validar email
    if not email:
        logger.error("Email is required")
        return jsonify({"error": "El email es requerido"}), 400
    
    if not validate_email(email):
        logger.error(f"Invalid email format: {email}")
        return jsonify({"error": "El formato del email no es válido"}), 400
    
    # Validar source
    valid_sources = ['blog', 'blog_article', 'landing', 'other']
    if source not in valid_sources:
        source = 'other'
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verificar si el email ya existe
        cursor.execute(
            "SELECT id, status FROM newsletter_subscriptions WHERE email = %s",
            (email,)
        )
        existing = cursor.fetchone()
        
        if existing:
            subscription_id, status = existing
            
            # Si está unsubscribed, reactivar
            if status == 'unsubscribed':
                cursor.execute(
                    """
                    UPDATE newsletter_subscriptions 
                    SET status = 'active', 
                        source = %s, 
                        subscribed_at = CURRENT_TIMESTAMP,
                        unsubscribed_at = NULL
                    WHERE email = %s
                    RETURNING id
                    """,
                    (source, email)
                )
                conn.commit()
                cursor.close()
                conn.close()
                
                return jsonify({
                    "success": True,
                    "message": "¡Bienvenido de vuelta! Te has reintegrado a nuestra comunidad de emprendedores que buscan financiación y noticias sobre emprendimiento.",
                    "subscription_id": subscription_id
                }), 200
            else:
                # Ya está suscrito
                cursor.close()
                conn.close()
                return jsonify({
                    "success": True,
                    "message": "¡Ya eres parte de la comunidad! Sigues recibiendo las mejores noticias sobre financiación y emprendimiento.",
                    "subscription_id": subscription_id
                }), 200
        
        # Insertar nueva suscripción
        cursor.execute(
            """
            INSERT INTO newsletter_subscriptions (email, source, status)
            VALUES (%s, %s, 'active')
            RETURNING id
            """,
            (email, source)
        )
        subscription_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info(f"New subscription added: {email} with id {subscription_id}")
        return jsonify({
            "success": True,
            "message": "¡Bienvenido a la comunidad! Ya formas parte de miles de emprendedores que buscan financiación y reciben las mejores noticias sobre emprendimiento y finanzas.",
            "subscription_id": subscription_id
        }), 201
        
    except Exception as e:
        print(f"Error en newsletter subscription: {e}")
        return jsonify({
            "error": "Error al procesar la suscripción. Inténtalo de nuevo más tarde"
        }), 500

@newsletter_bp.route('/unsubscribe', methods=['POST'])
@rate_limit(5, 60)  # 5 bajas por minuto
def unsubscribe():
    """
    Endpoint para darse de baja del newsletter
    Body: { "email": "user@example.com" }
    """
    data = request.json
    if not data:
        logger.error("No data provided in the request")
        return jsonify({"error": "Faltan datos en la solicitud"}), 400
    
    email = data.get('email', '').strip().lower()
    logger.info(f"Received newsletter unsubscribe request from email: {email}")
    
    if not email or not validate_email(email):
        logger.error("Invalid email format")
        return jsonify({"error": "Email inválido"}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """
            UPDATE newsletter_subscriptions 
            SET status = 'unsubscribed', 
                unsubscribed_at = CURRENT_TIMESTAMP
            WHERE email = %s AND status = 'active'
            RETURNING id
            """,
            (email,)
        )
        
        result = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        if result:
            logger.info(f"Unsubscribed email: {email}")
            return jsonify({
                "success": True,
                "message": "Te has dado de baja del newsletter exitosamente"
            }), 200
        else:
            logger.info(f"No active subscription found for email: {email}")
            return jsonify({
                "error": "No se encontró una suscripción activa con este email"
            }), 404
            
    except Exception as e:
        print(f"Error en newsletter unsubscribe: {e}")
        return jsonify({
            "error": "Error al procesar la baja. Inténtalo de nuevo más tarde"
        }), 500

@newsletter_bp.route('/status/<email>', methods=['GET'])
@rate_limit(20, 60)  # 20 consultas por minuto
def check_status(email):
    """
    Endpoint para verificar el estado de una suscripción
    """
    logger.info(f"Received newsletter status check request for email: {email}")
    email = email.strip().lower()
    
    if not validate_email(email):
        return jsonify({"error": "Email inválido"}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """
            SELECT status, subscribed_at, source 
            FROM newsletter_subscriptions 
            WHERE email = %s
            """,
            (email,)
        )
        
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if result:
            status, subscribed_at, source = result
            return jsonify({
                "subscribed": status == 'active',
                "status": status,
                "subscribed_at": subscribed_at.isoformat() if subscribed_at else None,
                "source": source
            }), 200
        else:
            return jsonify({
                "subscribed": False,
                "status": "not_found"
            }), 200
            
    except Exception as e:
        print(f"Error checking newsletter status: {e}")
        return jsonify({
            "error": "Error al verificar el estado"
        }), 500