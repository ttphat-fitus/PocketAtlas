import firebase_admin
from firebase_admin import credentials, auth, firestore
import os
import json
from dotenv import load_dotenv
from pathlib import Path

load_dotenv('.env.local')
load_dotenv()

# Global variables for lazy initialization
_firebase_auth = None
_firebase_db = None
_initialized = False

def _get_firebase_credentials():
    # Try to load from FIREBASE_CREDENTIALS env var (JSON string)
    firebase_creds_json = os.getenv("FIREBASE_CREDENTIALS")
    if firebase_creds_json:
        try:
            creds_dict = json.loads(firebase_creds_json)
            print("Firebase credentials loaded from FIREBASE_CREDENTIALS env var")
            return credentials.Certificate(creds_dict)
        except json.JSONDecodeError as e:
            print(f"Error parsing FIREBASE_CREDENTIALS: {e}")
    
    # Try to load from file path
    firebase_key_path = os.getenv("FIREBASE_KEY_PATH")
    
    possible_paths = os.path.join(os.path.dirname(__file__), "..", "key", "firebase_key.json"),  # Local dev

    
    # Find the first existing path
    for path in possible_paths:
        if path and os.path.exists(path):
            return credentials.Certificate(path)
    
    return None

def _initialize_firebase():
    """Initialize Firebase Admin SDK (lazy loading)"""
    global _firebase_auth, _firebase_db, _initialized
    
    if _initialized:
        return
    
    cred = _get_firebase_credentials()
    
    if not cred:
        print("Firebase key not found. Some features may not work.")
        print("Set FIREBASE_CREDENTIALS or FIREBASE_KEY_PATH env var.")
        _initialized = True
        return
    
    try:
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        print("[OK] Firebase initialized successfully")
        _initialized = True
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        _initialized = True
        raise

def get_auth():
    global _firebase_auth
    _initialize_firebase()
    if not _firebase_auth:
        try:
            _firebase_auth = auth
            return _firebase_auth
        except Exception as e:
            print(f"Error getting Firebase auth: {e}")
            return None
    return _firebase_auth

def get_db():
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
