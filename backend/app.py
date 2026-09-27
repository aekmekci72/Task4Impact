from flask import Flask, jsonify
from flask_cors import CORS

from auth import verify_request
from profile_routes import bp as profile_routes
from project_routes import bp as project_routes
from task_routes import bp as task_routes

app = Flask(__name__)
CORS(app)
app.before_request(verify_request)
app.register_blueprint(profile_routes)
app.register_blueprint(project_routes)
app.register_blueprint(task_routes)

@app.get("/api/hello")
def hello():
    return jsonify({"message": "Hello from Flask!"})

if __name__ == "__main__":
    app.run(debug=True, port=5001)
