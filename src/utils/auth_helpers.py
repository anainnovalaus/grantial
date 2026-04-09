import jwt
import os
import logging
from functools import wraps
from typing import Optional

import boto3
from flask import request, jsonify

logger = logging.getLogger(__name__)
_JWT_SECRET_CACHE: Optional[str] = None


def _is_local_dev() -> bool:
    env = (os.environ.get("APP_ENV") or os.environ.get("ENV") or os.environ.get("FLASK_ENV") or "").lower()
    return env in {"local", "dev", "development"}


def _get_jwt_secret() -> Optional[str]:
    global _JWT_SECRET_CACHE

    if _JWT_SECRET_CACHE:
        return _JWT_SECRET_CACHE

    env_secret = os.environ.get("JWT_SECRET")
    if env_secret:
        _JWT_SECRET_CACHE = env_secret
        return _JWT_SECRET_CACHE

    try:
        ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "eu-central-1"))
        response = ssm.get_parameter(Name="/grantify/jwt/secret", WithDecryption=True)
        _JWT_SECRET_CACHE = response["Parameter"]["Value"]
        return _JWT_SECRET_CACHE
    except Exception as exc:
        if _is_local_dev():
            logger.warning("JWT secret not found in env/SSM. Using local dev fallback.")
            _JWT_SECRET_CACHE = "dev_jwt_secret_key_for_local_testing_only"
            return _JWT_SECRET_CACHE
        logger.error("JWT secret unavailable in production context: %s", exc)
        return None


def get_user_from_token():
    """Extract user ID from JWT token in Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None

    jwt_secret = _get_jwt_secret()
    if not jwt_secret:
        return None

    try:
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception as exc:
        logger.exception("Unexpected error decoding JWT: %s", exc)
        return None

    return payload.get("user_id") or payload.get("sub") or payload.get("id") or payload.get("userId")


def require_auth(f):
    """Decorator to require authentication for endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_user_from_token()
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        return f(user_id=user_id, *args, **kwargs)

    return decorated_function
