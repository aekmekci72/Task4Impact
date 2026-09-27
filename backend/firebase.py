import os
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

# Every backend entry point imports this module first, so load backend/.env here.
# Variables already set (e.g. in Render's dashboard) win over the file.
load_dotenv(Path(__file__).parent / ".env")

# Locally the key sits next to this file; on Render it's a secret file under /etc/secrets.
CREDENTIALS_PATH = os.environ.get(
    "FIREBASE_CREDENTIALS_PATH", Path(__file__).parent / "firebase-service-account.json"
)

firebase_admin.initialize_app(credentials.Certificate(CREDENTIALS_PATH))
db = firestore.client()
