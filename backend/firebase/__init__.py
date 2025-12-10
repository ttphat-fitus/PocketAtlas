from .auth_middleware import get_current_user, get_optional_user
from .firebase_config import get_auth, get_db

# Lazy load firebase_auth and firebase_db (functions instead of objects)
firebase_auth = get_auth
firebase_db = get_db

__all__ = ["get_current_user", "get_optional_user", "firebase_auth", "firebase_db", "get_auth", "get_db"]
