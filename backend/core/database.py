"""Database configuration and connections"""
from firebase import firebase_db
from google.cloud import firestore as firestore_module

# Export firebase database instance
db = firebase_db

# Export firestore module for queries
firestore = firestore_module
