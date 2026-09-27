from flask import Blueprint, g, jsonify, request

from profile_repository import get_profile, list_profiles, save_profile
from profiles import validate_profile
from project_repository import projects_by_member
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
    return jsonify({**profile, "projects": projects_by_member().get(g.user_id, [])})


@bp.put("/me")
def put_me():
    try:
        fields = validate_profile(request.get_json(silent=True))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    profile, created = save_profile(g.user_id, g.user_email, fields)
    return jsonify({**profile, "projects": projects_by_member().get(g.user_id, [])}), 201 if created else 200


@bp.get("/users")
def users():
    member_projects = projects_by_member()
    return jsonify([{**p, "projects": member_projects.get(p["id"], [])} for p in list_profiles()])
