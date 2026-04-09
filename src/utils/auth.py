import jwt
import argon2
import uuid
from datetime import datetime, timedelta, timezone
import boto3
import os
from utils.postgreSQL import get_connection
import re
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv
from flask import request, jsonify
from jinja2 import Template
from flask import Flask, redirect, url_for
from src.Modules.logger_config import get_logger
logger = get_logger(__name__)

import ssl
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from string import Template

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)

def get_ssm_param(name, secure=True):
    """Get parameter from AWS SSM Parameter Store"""
    try:
        ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "eu-central-1"))
        response = ssm.get_parameter(Name=name, WithDecryption=secure)
        return response["Parameter"]["Value"]
    except Exception as e:
        print(f"Error getting parameter {name}: {e}")
        # In development, return a default value or raise an exception
        if name == "/grantify/jwt/secret":
            return "dev_jwt_secret_key_for_local_testing_only"
        raise

# -----------------------------------------------------
# CONFIGURACIÓN SMTP Exchange Online
# -----------------------------------------------------
SMTP_HOST = get_ssm_param("/grantify/SMTP/SMTP_HOST")
SMTP_PORT = int(get_ssm_param("/grantify/SMTP/Port"))  # Convert to integer
SMTP_USER = get_ssm_param("/grantify/SMTP/USER")
SMTP_PASS = get_ssm_param("/grantify/SMTP/PASS")
URL = get_ssm_param("/grantify/URL")

# -----------------------------------------------------

# Argon2 hasher for password security
ph = argon2.PasswordHasher()

def generate_tokens(user_id):
    """Generate access and refresh tokens for a user"""
    # Current time for token creation
    now = datetime.now(timezone.utc)
    
    # Create access token (short-lived)
    access_token_payload = {
        'sub': str(user_id),
        'iat': now,
        'exp':  int((now + timedelta(hours=24)).timestamp()),
        'type': 'access'
    }
    
    # Create refresh token (long-lived)
    jti = str(uuid.uuid4())  # Unique identifier for the refresh token
    refresh_token_payload = {
        'sub': str(user_id),
        'jti': jti,
        'iat': now,
        'exp': now + timedelta(days=7),  # 7 days expiration
        'type': 'refresh'
    }
    
    # Get JWT secret from environment or AWS SSM
    try:
        jwt_secret = os.environ.get("JWT_SECRET") or get_ssm_param("/grantify/jwt/secret")
    except Exception as e:
        print(f"Error getting JWT secret: {e}")
        jwt_secret = "default_secret_for_development_only"  # Fallback for development
    
    # Generate the tokens
    access_token = jwt.encode(access_token_payload, jwt_secret, algorithm='HS256')
    refresh_token = jwt.encode(refresh_token_payload, jwt_secret, algorithm='HS256')
    
    # Store refresh token in database
    try:
        store_refresh_token(jti, user_id, refresh_token_payload['exp'])
    except Exception as e:
        print(f"Error storing refresh token: {e}")
    
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'expires_in': 900  # 15 minutes in seconds
    }

def store_refresh_token(jti, user_id, expires_at):
    """Store refresh token in database"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        query = """
            INSERT INTO refresh_token (jti, user_id, expires_at)
            VALUES (%s, %s, %s)
        """
        
        # Convert datetime to string for PostgreSQL
        expires_at_str = expires_at.strftime("%Y-%m-%d %H:%M:%S")
        
        cursor.execute(query, (jti, user_id, expires_at_str))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def revoke_refresh_token(jti):
    """Revoke a refresh token by setting its revoked flag to True"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        query = """
            UPDATE refresh_token
            SET revoked = TRUE
            WHERE jti = %s
        """
        
        cursor.execute(query, (jti,))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def validate_token(token):
    """Validate a JWT token and return user info if valid"""
    try:
        # Get JWT secret
        jwt_secret = os.environ.get("JWT_SECRET") or get_ssm_param("/grantify/jwt/secret")
        
        # Decode and verify token
        payload = jwt.decode(token, jwt_secret, algorithms=['HS256'])
        
        # Check token type
        token_type = payload.get('type')
        
        if token_type == 'refresh':
            # For refresh tokens, check if it has been revoked
            jti = payload.get('jti')
            if jti and is_token_revoked(jti):
                return None, "Token has been revoked"
        
        # Return user_id from token
        return payload.get('sub'), None
    except jwt.ExpiredSignatureError:
        return None, "Token has expired"
    except jwt.InvalidTokenError:
        return None, "Invalid token"
    except Exception as e:
        return None, str(e)

def is_token_revoked(jti):
    """Check if a refresh token has been revoked"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        query = """
            SELECT revoked FROM refresh_token
            WHERE jti = %s
        """
        
        cursor.execute(query, (jti,))
        result = cursor.fetchone()
        
        if not result:
            return True  # Token not found in database, consider it revoked
        
        return result[0]  # Return revoked flag
    except Exception as e:
        print(f"Error checking if token is revoked: {e}")
        return True  # In case of error, consider token revoked for security
    finally:
        cursor.close()
        conn.close()

def refresh_auth_tokens():
    """Generate new tokens using a valid refresh token"""
    # Get refresh token from request
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Missing or invalid refresh token"}), 401
    
    refresh_token = auth_header.split(' ')[1]
    
    # Validate refresh token
    user_id, error = validate_token(refresh_token)
    if error:
        return jsonify({"error": error}), 401
    
    # Decode token to get JTI
    try:
        jwt_secret = os.environ.get("JWT_SECRET") or get_ssm_param("/grantify/jwt/secret")
        payload = jwt.decode(refresh_token, jwt_secret, algorithms=['HS256'])
        jti = payload.get('jti')
    except Exception:
        return jsonify({"error": "Invalid token format"}), 401
    
    # Revoke the current refresh token
    try:
        if not revoke_refresh_token(jti):
            return jsonify({"error": "Token not found or already revoked"}), 401
    except Exception as e:
        return jsonify({"error": f"Error revoking token: {str(e)}"}), 500
    
    # Generate new tokens
    try:
        tokens = generate_tokens(user_id)
        return jsonify(tokens), 200
    except Exception as e:
        return jsonify({"error": f"Error generating new tokens: {str(e)}"}), 500

def register_user(email, password, name):
    """Register a new user with email verification"""
    # Validate email format
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "Invalid email format"}), 400
    
    # Validate password strength
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    
    # Check for at least one uppercase, lowercase, number, and special character
    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password) or \
        not re.search(r"[0-9]", password) or not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return jsonify({
            "error": "Password must contain at least one uppercase letter, one lowercase letter, " +
                    "one number, and one special character"
        }), 400
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        logger.info(f"Registering user with email: {email}")
        # Check if email already exists
        cursor.execute("SELECT id FROM app_user WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"error": "Email already registered"}), 409
        
        # Hash the password with Argon2
        hashed_password = ph.hash(password)
        preferences = {"smsUpdates": True, "emailUpdates": True, "darkMode": False}  # Default preferences
        # Insert new user
        query = """
            INSERT INTO app_user (email, password_hash, name, preferences, is_active, email_verified)
            VALUES (%s, %s, %s, %s, TRUE, FALSE)
            RETURNING id
        """

        cursor.execute(query, (email, hashed_password, name, json.dumps(preferences)))
        user_id = cursor.fetchone()[0]
        conn.commit()
        
        # Generate verification token
        verification_token = generate_verification_token(user_id)
        logger.info(f"Generated verification token for user {user_id}")

        # Send verification email
        email_sent = send_verification_email(email, verification_token)
        if email_sent:
            logger.info(f"Verification email sent successfully to {email}")
        else:
            logger.warning(f"Failed to send verification email to {email}, but registration continues")

        # Generate auth tokens
        tokens = generate_tokens(user_id)
        
        return jsonify({
            "message": "User registered successfully. Please verify your email.",
            "user_id": str(user_id),
            **tokens
        }), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()


def login_user(email, password):
    """Authenticate user and return tokens"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get user by email
        query = """
            SELECT id, password_hash, email_verified, is_active, onboarding_completed
            FROM app_user
            WHERE email = %s
        """
        
        cursor.execute(query, (email,))
        user = cursor.fetchone()
        
        if not user:
            # Use constant time response to prevent timing attacks
            # Still hash a dummy password for constant time verification
            ph.verify("dummy_hash", "dummy_password")
            return jsonify({"error": "Invalid email or password"}), 401

        user_id, password_hash, email_verified, is_active, onboarding_completed = user

        # Verify account is active
        if not is_active:
            return jsonify({"error": "Account is disabled. Please contact support."}), 403


        # Verify password
        try:
            if ph.verify(password_hash, password):
                # Check if password needs rehashing due to parameter changes
                if ph.check_needs_rehash(password_hash):
                    new_hash = ph.hash(password)
                    # Update password hash in database
                    cursor.execute(
                        "UPDATE app_user SET password_hash = %s WHERE id = %s",
                        (new_hash, user_id)
                    )
                    conn.commit()
                
                # Generate tokens
                tokens = generate_tokens(user_id)
                
                # Verify onboarding is FALSE
                if onboarding_completed == False:
                    logger.info(f"User {user_id} has not completed onboarding. Redirecting to onboarding.")
                    return jsonify({
                        "message": "Onboarding required",
                        "user_id": str(user_id),
                        "email_verified": email_verified,
                        "next_url": "https://grantial.com/onboarding",
                        **tokens
                    }), 200
                
                return jsonify({
                    "message": "Login successful",
                    "user_id": str(user_id),
                    "email_verified": email_verified,
                    **tokens
                }), 200
            else:
                return jsonify({"error": "Invalid email or password"}), 401
        except argon2.exceptions.VerifyMismatchError:
            return jsonify({"error": "Invalid email or password"}), 401
        
    except Exception as e:
        return jsonify({"error": f"Login failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

def logout_user():
    """Log out user by revoking their refresh token"""
    # Get refresh token from request
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"message": "Already logged out"}), 200
    
    refresh_token = auth_header.split(' ')[1]
    
    # Decode token to get JTI without verification
    # This allows us to revoke the token even if it's expired
    try:
        payload = jwt.decode(refresh_token, options={"verify_signature": False})
        jti = payload.get('jti')
        
        if jti:
            # Revoke the refresh token
            try:
                revoke_refresh_token(jti)
            except Exception as e:
                print(f"Error revoking token: {e}")
                # Continue even if revocation fails
        
        return jsonify({"message": "Logged out successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"Logout failed: {str(e)}"}), 500

def generate_verification_token(user_id):
    """Generate a token for email verification"""
    now = datetime.now(timezone.utc)
    
    # Create verification token (24 hours validity)
    token_payload = {
        'sub': str(user_id),
        'iat': now,
        'exp':  int((now + timedelta(hours=24)).timestamp()),
        'type': 'email_verification'
    }
    
    # Get JWT secret
    jwt_secret = os.environ.get("JWT_SECRET") or get_ssm_param("/grantify/jwt/secret")
    
    # Generate the token
    verification_token = jwt.encode(token_payload, jwt_secret, algorithm='HS256')
    
    return verification_token

def verify_email(token):
    """Verify user email with verification token"""
    # Validate token
    user_id, error = validate_token(token)
    if error:
        return jsonify({"error": error}), 401
    

    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Update user's email_verified status and get user data
        query = """
            UPDATE app_user
            SET email_verified = TRUE
            WHERE id = %s
            RETURNING id, email, name, email_verified
        """
        
        cursor.execute(query, (user_id,))
        result = cursor.fetchone()
        conn.commit()
        
        if not result:
            return jsonify({"error": "User not found"}), 404
        
        # Generate new tokens for the user
        tokens = generate_tokens(result[0])
        
        return jsonify({
            "message": "Email verified successfully",
            "success": True,
            "access_token": tokens['access_token'],
            "refresh_token": tokens['refresh_token'],
            "user_data": {
                "id": str(result[0]),
                "email": result[1],
                "name": result[2],
                "email_verified": result[3]
            }
        }), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Email verification failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

def request_password_reset(email):
    """Request password reset and send reset email"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Get user by email
        query = "SELECT id FROM app_user WHERE email = %s"
        
        cursor.execute(query, (email,))
        user = cursor.fetchone()
        
        if not user:
            # Return success even if email doesn't exist to prevent user enumeration
            return jsonify({
                "message": "If your email is registered, you will receive a password reset link"
            }), 200
        
        user_id = user[0]
        
        # Generate password reset token (valid for 1 hour)
        now = datetime.now(timezone.utc)
        token_payload = {
            'sub': str(user_id),
            'iat': now,
            'exp': int((now + timedelta(hours=24)).timestamp()),
            'type': 'password_reset'
        }
        
        # Get JWT secret
        jwt_secret = os.environ.get("JWT_SECRET") or get_ssm_param("/grantify/jwt/secret")
        
        # Generate the token
        reset_token = jwt.encode(token_payload, jwt_secret, algorithm='HS256')
        
        # Send password reset email
        send_password_reset_email(email, reset_token)
        
        return jsonify({
            "message": "If your email is registered, you will receive a password reset link"
        }), 200
    except Exception as e:
        return jsonify({"error": f"Password reset request failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

def reset_password(token, new_password):
    """Reset user password with reset token"""
    # Validate password strength
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    
    # Check for at least one uppercase, lowercase, number, and special character
    if not re.search(r"[A-Z]", new_password) or not re.search(r"[a-z]", new_password) or \
       not re.search(r"[0-9]", new_password) or not re.search(r"[!@#$%^&*(),.?\":{}|<>]", new_password):
        return jsonify({
            "error": "Password must contain at least one uppercase letter, one lowercase letter, " +
                    "one number, and one special character"
        }), 400
    
    # Validate token
    user_id, error = validate_token(token)
    if error:
        return jsonify({"error": error}), 401
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Hash the new password
        hashed_password = ph.hash(new_password)
        
        # Extract salt
        salt = hashed_password.split('$')[3].split(',')[1].split('=')[1]
        
        # Update user's password
        query = """
            UPDATE app_user
            SET password_hash = %s, salt = %s
            WHERE id = %s
            RETURNING id
        """
        
        cursor.execute(query, (hashed_password, salt, user_id))
        result = cursor.fetchone()
        conn.commit()
        
        if not result:
            return jsonify({"error": "User not found"}), 404
        
        # Revoke all refresh tokens for the user
        revoke_all_user_tokens(user_id)
        
        return jsonify({"message": "Password reset successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Password reset failed: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

def revoke_all_user_tokens(user_id):
    """Revoke all refresh tokens for a user"""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        query = """
            UPDATE refresh_token
            SET revoked = TRUE
            WHERE user_id = %s
        """
        
        cursor.execute(query, (user_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error revoking user tokens: {e}")
    finally:
        cursor.close()
        conn.close()

def send_email(to_address: str, subject: str, body_text: str, body_html: str = None) -> bool:

    print(f"Enviando correo a {to_address} con asunto '{subject}'")
    # Montamos el mensaje MIME
    msg = MIMEMultipart("alternative")
    msg["From"]    = SMTP_USER
    msg["To"]      = to_address
    msg["Subject"] = subject

    print(f"SMTP_HOST: {SMTP_HOST}, SMTP_PORT: {SMTP_PORT}, SMTP_USER: {SMTP_USER}")
    # Adjuntamos la parte de texto
    msg.attach(MIMEText(body_text, "plain"))
    # Si nos pasan HTML, lo adjuntamos
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    try:
        # Conexión al servidor SMTP
        print("Conectando con SSL directo")
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)

        # Login
        server.login(SMTP_USER, SMTP_PASS)

        # Envío
        server.sendmail(SMTP_USER, to_address, msg.as_string())
        server.quit()
        print(f"Correo enviado a {to_address}")

        return True
    
    except Exception as e:
        print(f"Error al enviar correo a {to_address}: {e}")
        return False

def send_verification_email(email, token):
    """Send email verification using SMTP"""
    try:
        
        # Verification link
        verification_link = f"{URL}verify-email?token={token}"
        
        # Email content in Spanish
        subject = "¡Bienvenido a Grantial! Verifica tu email"
        body_html = f"""\
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Bienvenido a Grantial</title>
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background: #f4f6f8;
                    }}
                    .header {{
                        background: #6161b5;
                        color: white;
                        padding: 30px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }}
                    .logo {{
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 5px;
                        font-size: 32px;
                        font-weight: bold;
                    }}
                    .logo img {{
                        height: 50px;
                    }}
                    h1 {{
                        color: #ccccea;
                        margin-top: 5px;
                        font-size: 26px;
                    }}
                    .content {{
                        background: #ffffff;
                        padding: 30px;
                        border: 1px solid #e0e0e0;
                        border-top: none;
                    }}
                    .footer {{
                        background: #f8f9fa;
                        padding: 20px;
                        text-align: center;
                        font-size: 14px;
                        color: #666;
                        border-radius: 0 0 10px 10px;
                    }}
                    .button {{
                        display: inline-block;
                        background: linear-gradient(135deg, #9474bc 0%, #6b6bc3 100%);
                        color: white;
                        padding: 15px 30px;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: bold;
                        margin: 20px 0;
                    }}
                    .button:hover {{
                        opacity: 0.9;
                    }}
                    ul {{
                        padding-left: 20px;
                    }}
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">
                        <img src="https://raw.githubusercontent.com/Innovalauss/grantia-logo/refs/heads/main/Grantial.png" alt="Logo Grantial">
                        <p>GRANTIAL</p>
                    </div>
                    <h1>¡Bienvenido a Grantial!</h1>
                    <p>Tu experto en subvenciones</p>        
                </div>
                <div class="content">
                    <h2>Activa tu cuenta</h2>
                    <p>Hola,</p>
                    <p>Gracias por unirte a <strong>Grantial</strong>. Estamos encantados de acompañarte en la búsqueda de subvenciones adaptadas a ti. 
                    Para empezar, solo necesitas confirmar tu dirección de email:</p>

                    <p style="text-align: center;">
                        <a href="{verification_link}" class="button">Verificar mi email</a>
                    </p>

                    <h3>¿Qué encontrarás en Grantial?</h3>
                    <ul>
                        <li><strong>Análisis automático:</strong> detectamos subvenciones con mayor encaje para ti.</li>
                        <li><strong>Matches personalizados:</strong> recibe recomendaciones ajustadas al perfil de tu empresa.</li>
                        <li><strong>Swipe inteligente:</strong> explora oportunidades de forma ágil y sencilla.</li>
                        <li><strong>Asistente Granti:</strong> resuelve dudas al instante sobre cualquier convocatoria.</li>
                    </ul>

                    <p>Este enlace expirará en <strong>24 horas</strong>.</p>
                    <p>¡Verifica tu email y empieza hoy mismo a descubrir las oportunidades que tu empresa merece!</p>
                </div>
                <div class="footer">
                    <p>© 2025 Grantial. Todos los derechos reservados.</p>
                    <p>Si no te has registrado en Grantial, puedes ignorar este mensaje.</p>
                </div>
            </body>
            </html>
        """
        
        body_text = f"""
            ¡Bienvenido a Grantial!

            Hola,

            Gracias por unirte a Grantial. Estamos encantados de acompañarte en la búsqueda de subvenciones adaptadas a tu empresa.  
            Para empezar, solo necesitas confirmar tu dirección de email haciendo clic en el siguiente enlace:

            {verification_link}

            ¿Qué encontrarás en Grantial?
            • Análisis automático: detectamos las subvenciones con mayor encaje para ti
            • Matches personalizados: recomendaciones ajustadas al perfil de tu empresa
            • Swipe inteligente: explora oportunidades de forma ágil y sencilla
            • Asistente Granti: resuelve dudas al instante sobre cualquier convocatoria


            Este enlace expirará en 24 horas.    

            ¡Verifica tu email y empieza hoy mismo a descubrir las oportunidades que tu empresa merece!  

            © 2025 Grantial. Todos los derechos reservados.
            Si no te has registrado en Grantial, puedes ignorar este mensaje.
            El equipo de Grantial
        """
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SMTP_USER
        msg['To'] = email
        
        # Create text and HTML parts
        part1 = MIMEText(body_text, 'plain', 'utf-8')
        part2 = MIMEText(body_html, 'html', 'utf-8')
        
        # Add parts to message
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email via SMTP
        logger.info(f"Attempting to send verification email to {email}")
        logger.info(f"SMTP Config - Host: {SMTP_HOST}, Port: {SMTP_PORT}, User: {SMTP_USER}")

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        logger.info(f"Verification email sent successfully to {email}")
        print(f"Verification email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Error sending verification email to {email}: {str(e)}", exc_info=True)
        print(f"Error sending verification email: {e}")
        # Don't fail registration if email sending fails
        return False

def send_password_reset_email(email, reset_token):
    """Send password reset email using SMTP"""
    try:
        
        # Reset link
        reset_link = f"{URL}reset-password?token={reset_token}"
        
        # Email content in Spanish
        subject = "Restablecer tu contraseña - Grantial"
        body_html = f"""\
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Restablecer Contraseña - Grantial</title>
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background: #f4f6f8;
                    }}
                    .header {{
                        background: #6161b5;
                        color: white;
                        padding: 30px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }}
                    .logo {{
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 5px;
                        font-size: 32px;
                        font-weight: bold;
                        p {{ margin: 0; }}
                    }}
                    .logo img {{
                        height: 50px;
                    }}
                    h1 {{
                        color: #ccccea;
                        font-size: 26px;
                    }}
                    .content {{
                        background: #ffffff;
                        padding: 30px;
                        border: 1px solid #e0e0e0;
                        border-top: none;
                    }}
                    .footer {{
                        background: #f8f9fa;
                        padding: 20px;
                        text-align: center;
                        font-size: 14px;
                        color: #666;
                        border-radius: 0 0 10px 10px;
                    }}
                    .button {{
                        display: inline-block;
                        background: linear-gradient(135deg, #9474bc 0%, #6b6bc3 100%);
                        color: white;
                        padding: 15px 30px;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: bold;
                        margin: 20px 0;
                    }}
                    .button:hover {{
                        opacity: 0.9;
                    }}
                    .warning {{
                        background: #fff3cd;
                        border: 1px solid #ffeaa7;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 20px 0;
                    }}
                    ul {{
                        padding-left: 20px;
                    }}
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">
                        <img src="https://raw.githubusercontent.com/Innovalauss/grantia-logo/refs/heads/main/Grantial.png" alt="Logo Grantial">
                        <p>GRANTIAL</p>
                    </div>
                    <h1>Restablecer contraseña</h1>
                    <p>Protege tu cuenta con una nueva contraseña segura</p>
                </div>
                <div class="content">
                    <h2>Solicitud de restablecimiento de contraseña</h2>
                    <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>Grantial</strong>.</p>
                    
                    <p style="text-align: center;">
                        <a href="{reset_link}" class="button">🔑 Crear nueva contraseña</a>
                    </p>
                    
                    <div class="warning">
                        <p><strong>⚠️ Importante:</strong></p>
                        <ul>
                            <li>Este enlace expirará en <strong>1 hora</strong>.</li>
                            <li>Solo puedes usar este enlace una vez.</li>
                            <li>Si no solicitaste este cambio, ignora este correo.</li>
                        </ul>
                    </div>
                    
                    <p>Tu cuenta permanece segura. Si no solicitaste este restablecimiento, puedes ignorar este correo y tu contraseña no será modificada.</p>
                    
                    <p style="font-size: 14px; color: #666;">
                        Si tienes problemas con el enlace, copia y pega esta URL en tu navegador:<br>
                        <span style="word-break: break-all;">{reset_link}</span>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2025 Grantial. Todos los derechos reservados.</p>
                    <p>Por tu seguridad, nunca compartas este correo con terceros.</p>
                </div>
            </body>
            </html>
        """
        
        body_text = f"""
        Restablecer contraseña - Grantial
        
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Grantial.
        
        Para crear una nueva contraseña, haz clic en el siguiente enlace:
        
        {reset_link}
        
        IMPORTANTE:
        • Este enlace expirará en 1 hora
        • Solo puedes usar este enlace una vez
        • Si no solicitaste este cambio, ignora este email
        
        Tu cuenta permanece segura. Si no solicitaste este restablecimiento, puedes ignorar este email.
        
        El equipo de Grantial
        """

        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SMTP_USER
        msg['To'] = email
        
        # Create text and HTML parts
        part1 = MIMEText(body_text, 'plain', 'utf-8')
        part2 = MIMEText(body_html, 'html', 'utf-8')
        
        # Add parts to message
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email via SMTP
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        
        print(f"Password reset email sent to {email}")
        return True
    except Exception as e:
        print(f"Error sending password reset email: {e}")
        return False
