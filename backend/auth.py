from flask import g, jsonify, request
from firebase_admin import auth

import firebase  # noqa: F401 (initializes the Firebase app before verify_id_token runs)

PUBLIC_PATHS = {"/api/hello", "/api/skills"}


def verify_request():
    """Runs before every request. Rejects anything without a valid Firebase ID token."""
    if request.method == "OPTIONS" or request.path in PUBLIC_PATHS:
        return None
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return jsonify({"error": "Missing sign-in token"}), 401
    try:
        claims = auth.verify_id_token(header.removeprefix("Bearer "))
    except (ValueError, auth.InvalidIdTokenError):
        return jsonify({"error": "Invalid or expired sign-in token"}), 401
    g.user_id = claims["uid"]
    g.user_email = claims.get("email")
    return None
