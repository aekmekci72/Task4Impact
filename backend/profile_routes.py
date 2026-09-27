from flask import Blueprint, g, jsonify, request

from profile_repository import get_profile, list_profiles, save_profile
from profiles import validate_profile
from skills import SKILL_TAGS

bp = Blueprint("profiles", __name__, url_prefix="/api")


@bp.get("/skills")
def skills():
    return jsonify(list(SKILL_TAGS))


@bp.get("/me")
def get_me():
    profile = get_profile(g.user_id)
    if profile is None:
        return jsonify({"error": "Profile not found"}), 404
    return jsonify({**profile, "projects": []})


@bp.put("/me")
def put_me():
    try:
        fields = validate_profile(request.get_json(silent=True))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    profile, created = save_profile(g.user_id, g.user_email, fields)
    return jsonify({**profile, "projects": []}), 201 if created else 200


@bp.get("/me/tasks")
def my_tasks():
    # Placeholder until tasks are stored: nobody has assigned tasks yet.
    return jsonify([])


@bp.get("/users")
def users():
    return jsonify([{**p, "projects": []} for p in list_profiles()])
