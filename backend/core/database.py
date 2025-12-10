"""Database configuration and connections"""
from firebase import get_db
from google.cloud import firestore as firestore_module

# Create a wrapper to call get_db() each time (since it's a lazy-loading function)
class DatabaseWrapper:
    def __call__(self):
        return get_db()
    
    def __getattr__(self, name):
        # Delegate all attribute access to the actual db instance
        return getattr(get_db(), name)

# Export firebase database instance (lazy-loaded)
db = DatabaseWrapper()

# Export firestore module for queries
firestore = firestore_module
