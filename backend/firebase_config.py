import firebase_admin
from firebase_admin import credentials, auth, firestore
import os

# Initialize Firebase Admin SDK
cred_path = os.path.join(os.path.dirname(__file__), "key", "firebase_key.json")
cred = credentials.Certificate(cred_path)

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

# Export references
firebase_auth = auth
firebase_db = firestore.client()
