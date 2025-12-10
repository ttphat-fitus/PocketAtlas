import firebase_admin
from firebase_admin import credentials, auth, firestore
import os
import json
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
load_dotenv()

firebase_key_path = os.getenv("FIREBASE_KEY_PATH")

possible_paths = [
    firebase_key_path,  # From env var (Render secret file)
    "/etc/secret_files/firebase_key.json",  # Render default secret file path
    os.path.join(os.path.dirname(__file__), "..", "key", "firebase_key.json"),  # Local dev
]

# Find the first existing path
firebase_key_path = None
for path in possible_paths:
    if path and os.path.exists(path):
        firebase_key_path = path
        print(f"Loading Firebase key from: {path}")
        break

if not firebase_key_path:
    raise FileNotFoundError(
        f"Firebase key not found. Checked paths: {possible_paths}. "
        f"Set FIREBASE_KEY_PATH env var or use Render Secret Files."
    )

try:
    cred = credentials.Certificate(firebase_key_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    raise

# Export references
firebase_auth = auth
firebase_db = firestore.client()
