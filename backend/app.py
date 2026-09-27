from flask import Flask, jsonify
from flask_cors import CORS

from graph_routes import bp as graph_bp

app = Flask(__name__)

CORS(
    app,
    resources={r"/api/*": {"origins": "http://localhost:5173"}},
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.register_blueprint(graph_bp)


@app.get("/api/me")
def get_me():
    return jsonify({
        "id": "u1",
        "name": "David",
        "email": "david@example.com",
        "strengths": ["backend", "firebase", "auth"],
        "interests": ["backend"],
        "seniority": "senior"
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)