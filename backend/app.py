from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore

app = Flask(__name__)
CORS(app)

cred = credentials.Certificate("firebase-service-account.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

@app.get("/api/hello")
def hello():
    return jsonify({"message": "Hello from Flask!"})

@app.get("/api/users")
def users():
    docs = db.collection("users").stream()
    return jsonify([
        {"id": doc.id, **doc.to_dict()}
        for doc in docs
    ])

if __name__ == "__main__":
    app.run(debug=True, port=5000)
