from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

CREDENTIALS_PATH = Path(__file__).parent / "firebase-service-account.json"

firebase_admin.initialize_app(credentials.Certificate(CREDENTIALS_PATH))
db = firestore.client()
