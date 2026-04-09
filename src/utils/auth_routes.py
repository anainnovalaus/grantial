
from flask import Blueprint, request, jsonify
from utils.auth import (
    register_user, login_user, logout_user, refresh_auth_tokens,
    verify_email, request_password_reset, reset_password
)
from functools import wraps
import time

auth_bp = Blueprint('auth', __name__)
print(auth_bp)

# Rate limiting implementation
rate_limits = {}  # IP -> {count: int, reset_time: float}

def rate_limit(max_requests=5, window=60):
    """Rate limiting decorator for API endpoints"""
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
                    'error': 'Rate limit exceeded',
                    'retry_after': int(rate_limits[ip]['reset_time'] - current_time)
                }), 429
            
            # Increment request count
            rate_limits[ip]['count'] += 1
            
            # Process the request
            return f(*args, **kwargs)
        return wrapped
    return decorator

# Authentication routes
@auth_bp.route('/register', methods=['POST'])
@rate_limit(10, 300)  # 10 registrations per 5 minutes
def register():
    data = request.json
    if not data:
        return jsonify({"error": "Missing request body"}), 400
    
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    
    return register_user(email, password, name)

@auth_bp.route('/login', methods=['POST'])
@rate_limit(20, 300)  # 20 login attempts per 5 minutes
def login():
    data = request.json
    if not data:
        return jsonify({"error": "Missing request body"}), 400
    
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    
    return login_user(email, password)

@auth_bp.route('/logout', methods=['POST'])
def logout():
    return logout_user()

@auth_bp.route('/refresh', methods=['POST'])
@rate_limit(30, 60)  # 30 refresh attempts per minute
def refresh():
    return refresh_auth_tokens()

@auth_bp.route('/verify-email', methods=['GET'])
def verify():
    token = request.args.get('token')
    if not token:
        return jsonify({"error": "Missing verification token"}), 400
    
    return verify_email(token)

@auth_bp.route('/forgot-password', methods=['POST'])
@rate_limit(5, 300)  # 5 password reset requests per 5 minutes
def forgot_password():
    data = request.json
    if not data:
        return jsonify({"error": "Missing request body"}), 400
    
    email = data.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    return request_password_reset(email)

@auth_bp.route('/reset-password', methods=['POST'])
@rate_limit(5, 300)  # 5 password reset attempts per 5 minutes
def reset():
    data = request.json
    if not data:
        return jsonify({"error": "Missing request body"}), 400
    
    token = data.get('token')
    new_password = data.get('password')
    
    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400
    
    return reset_password(token, new_password)