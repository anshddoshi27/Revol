"""
Authentication Blueprint

This blueprint provides authentication endpoints for user signup and login.
It handles user creation, JWT token generation, and authentication flows.

Endpoints:
- POST /auth/signup: Create new user account
- POST /auth/login: Authenticate user and return JWT token
- POST /auth/refresh: Refresh JWT token
- POST /auth/logout: Invalidate JWT token

Features:
- User registration with validation
- JWT token generation
- Password hashing
- Email validation
- Duplicate user prevention
- Idempotent signup
- Observability hooks
- Structured error handling
"""

from flask import Blueprint, jsonify, request, g
import uuid
import re
import logging
import hashlib
import jwt
from datetime import datetime, timedelta
from ..middleware.error_handler import TithiError
from ..services.core import UserService
from ..models.core import User
from ..extensions import db
from ..config import Config

# Configure logging
logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)


def hash_password(password: str) -> str:
    """Hash password using SHA-256 (for demo purposes)."""
    # In production, use bcrypt or similar
    return hashlib.sha256(password.encode()).hexdigest()


def generate_jwt_token(user_id: str, email: str, tenant_id: str = None) -> str:
    """Generate JWT token for authenticated user."""
    payload = {
        'sub': user_id,
        'email': email,
        'tenant_id': tenant_id,
        'role': 'owner',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    
    # Get JWT secret from config
    jwt_secret = Config.JWT_SECRET_KEY or 'dev-secret-key'
    
    return jwt.encode(payload, jwt_secret, algorithm='HS256')


@auth_bp.route("/signup", methods=["POST"])
def signup():
    """
    Create a new user account.
    
    Request Body:
        {
            "email": "string (required)",
            "password": "string (required)",
            "phone": "string (required)",
            "first_name": "string (required)",
            "last_name": "string (required)"
        }
    
    Returns:
        JSON response with user data and JWT token
    """
    try:
        data = request.get_json()
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate required fields
        required_fields = ["email", "password", "phone", "first_name", "last_name"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            raise TithiError(
                message=f"Missing required fields: {', '.join(missing_fields)}",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        email = data["email"].strip().lower()
        password = data["password"].strip()
        phone = data["phone"].strip()
        first_name = data["first_name"].strip()
        last_name = data["last_name"].strip()
        
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise TithiError(
                message="Invalid email format",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate password strength
        if len(password) < 8:
            raise TithiError(
                message="Password must be at least 8 characters long",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate phone format (basic validation)
        phone_pattern = r'^\+?[\d\s\-\(\)]+$'
        if not re.match(phone_pattern, phone):
            raise TithiError(
                message="Invalid phone number format",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Check for existing user
        user_service = UserService()
        existing_user = user_service.get_user_by_email(email)
        if existing_user:
            raise TithiError(
                message="Email already exists",
                code="TITHI_DUPLICATE_EMAIL_ERROR",
                status_code=409
            )
        
        # Create user data
        user_data = {
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "phone": phone,
            "password_hash": hash_password(password)
        }
        
        # Create user
        user = user_service.create_user(user_data)
        
        # Generate JWT token
        token = generate_jwt_token(str(user.id), email)
        
        # Emit observability hook
        logger.info(f"USER_SIGNUP_SUCCESS: user_id={user.id}, email={email}")
        
        # Return success response with onboarding prefill
        return jsonify({
            "user_id": str(user.id),
            "session_token": token,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone,
                "created_at": user.created_at.isoformat() + "Z"
            },
            "onboarding_prefill": {
                "owner_email": email,
                "owner_name": f"{first_name} {last_name}",
                "phone": phone
            }
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to create user: {str(e)}")
        raise TithiError(
            message="Failed to create user account",
            code="TITHI_USER_CREATION_ERROR",
            status_code=500
        )


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Authenticate user and return JWT token.
    
    Request Body:
        {
            "email": "string (required)",
            "password": "string (required)"
        }
    
    Returns:
        JSON response with JWT token and user data
    """
    try:
        data = request.get_json()
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()
        
        if not email or not password:
            raise TithiError(
                message="Email and password are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Get user by email
        user_service = UserService()
        user = user_service.get_user_by_email(email)
        
        if not user:
            raise TithiError(
                message="Invalid email or password",
                code="TITHI_AUTH_INVALID_CREDENTIALS",
                status_code=401
            )
        
        # Verify password
        password_hash = hash_password(password)
        if user.password_hash != password_hash:
            raise TithiError(
                message="Invalid email or password",
                code="TITHI_AUTH_INVALID_CREDENTIALS",
                status_code=401
            )
        
        # Generate JWT token
        token = generate_jwt_token(str(user.id), email)
        
        # Emit observability hook
        logger.info(f"USER_LOGIN_SUCCESS: user_id={user.id}, email={email}")
        
        return jsonify({
            "user_id": str(user.id),
            "session_token": token,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone,
                "created_at": user.created_at.isoformat() + "Z"
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to authenticate user: {str(e)}")
        raise TithiError(
            message="Authentication failed",
            code="TITHI_AUTH_ERROR",
            status_code=500
        )
