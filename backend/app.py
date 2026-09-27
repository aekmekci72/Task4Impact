from flask import Flask, jsonify
from flask_cors import CORS

from auth import verify_request
from profile_routes import bp as profile_routes
from project_routes import bp as project_routes
from graph_routes import bp as graph_bp


app = Flask(__name__)
CORS(app)
app.before_request(verify_request)
app.register_blueprint(profile_routes)

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
    app.run(debug=True, port=5000)
