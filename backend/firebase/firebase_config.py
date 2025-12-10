import firebase_admin
from firebase_admin import credentials, auth, firestore
import os
import json
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
load_dotenv()

# Global variables for lazy initialization
_firebase_auth = None
_firebase_db = None
_initialized = False

def _get_firebase_key_path():
    """Find Firebase key path from multiple sources"""
    firebase_key_path = os.getenv("FIREBASE_KEY_PATH")
    
    possible_paths = [
        firebase_key_path,  # From env var (Render secret file)
        "/etc/secret_files/firebase_key.json",  # Render default secret file path
        os.path.join(os.path.dirname(__file__), "..", "key", "firebase_key.json"),  # Local dev
    ]
    
    # Find the first existing path
    for path in possible_paths:
        if path and os.path.exists(path):
            print(f"✓ Firebase key found at: {path}")
            return path
    
    return None

def _initialize_firebase():
    """Initialize Firebase Admin SDK (lazy loading)"""
    global _firebase_auth, _firebase_db, _initialized
    
    if _initialized:
        return
    
    firebase_key_path = _get_firebase_key_path()
    
    if not firebase_key_path:
        print("⚠ Firebase key not found. Some features may not work.")
        print("  Set FIREBASE_KEY_PATH env var or use Render Secret Files.")
        _initialized = True
        return
    
    try:
        cred = credentials.Certificate(firebase_key_path)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        print("✓ Firebase initialized successfully")
        _initialized = True
    except Exception as e:
        print(f"✗ Error initializing Firebase: {e}")
        _initialized = True
        raise

def get_auth():
    """Get Firebase auth (with lazy initialization)"""
    global _firebase_auth
    _initialize_firebase()
    if not _firebase_auth:
        _firebase_auth = auth
    return _firebase_auth

def get_db():
    """Get Firestore DB (with lazy initialization)"""
    global _firebase_db
    _initialize_firebase()
    if not _firebase_db:
        _firebase_db = firestore.client()
    return _firebase_db

# Try to initialize on import (non-blocking)
_initialize_firebase()

# Export references (will be set on first use)
firebase_auth = get_auth
firebase_db = get_db
