import firebase_admin
from firebase_admin import credentials, auth, firestore
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
load_dotenv()

# Initialize Firebase Admin SDK
firebase_key_path = os.getenv("FIREBASE_KEY_PATH")

if not firebase_key_path:
    # Fallback to default local path
    firebase_key_path = os.path.join(os.path.dirname(__file__), "..", "key", "firebase_key.json")

if not os.path.exists(firebase_key_path):
    # Try alternative path if env var points to non-existent file
    alt_path = os.path.join(os.path.dirname(__file__), "..", "key", "firebase_key.json")
    if os.path.exists(alt_path):
        firebase_key_path = alt_path
    else:
        print(f"Warning: Firebase key not found at {firebase_key_path}")

cred = credentials.Certificate(firebase_key_path)

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

# Export references
firebase_auth = auth
firebase_db = firestore.client()
