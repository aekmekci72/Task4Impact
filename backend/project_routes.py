from flask import Blueprint, g, jsonify, request

from profile_repository import get_profile
from project_repository import (
    add_project_member,
    create_project,
    get_project,
    list_projects as list_project_records,
    remove_project_member,
    update_project,
)
from task_repository import get_tasks, set_assignees
from task_routes import run_assignment

bp = Blueprint("projects", __name__, url_prefix="/api")


@bp.get("/projects")
def get_projects():
    return jsonify(list_project_records())


@bp.post("/projects")
def post_project():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400

    name = data.get("name")
    description = data.get("description", "")
    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Project name is required"}), 400
    if not isinstance(description, str):
        return jsonify({"error": "Project description must be a string"}), 400

    project = create_project(name.strip(), description.strip(), g.user_id)
    return jsonify(project), 201


@bp.get("/projects/<project_id>")
def get_project_route(project_id):
    project = get_project(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    return jsonify({**project, "tasks": get_tasks(project_id)})


@bp.put("/projects/<project_id>")
def put_project(project_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data:
        return jsonify({"error": "Provide a project name or description to update"}), 400
    if set(data) - {"name", "description"}:
        return jsonify({"error": "Only name and description can be updated"}), 400
    if "name" in data and (not isinstance(data["name"], str) or not data["name"].strip()):
        return jsonify({"error": "Project name cannot be empty"}), 400
    if "description" in data and not isinstance(data["description"], str):
        return jsonify({"error": "Project description must be a string"}), 400

    fields = {
        key: value.strip() if isinstance(value, str) else value
        for key, value in data.items()
    }
    project = update_project(project_id, fields)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(project)


@bp.post("/projects/<project_id>/members")
def post_project_member(project_id):
    project = get_project(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404

    data = request.get_json(silent=True)
    user_id = data.get("user_id") if isinstance(data, dict) else None
    if not isinstance(user_id, str) or not user_id.strip():
        return jsonify({"error": "A user_id is required"}), 400
    user_id = user_id.strip()
    if get_profile(user_id) is None:
        return jsonify({"error": "User profile not found"}), 404

    created = add_project_member(project_id, user_id)
    if created:
        # A new member may be free to pick up a ready task right away.
        run_assignment(get_project(project_id))
    return jsonify({"project_id": project_id, "user_id": user_id}), 201 if created else 200


@bp.delete("/projects/<project_id>/members")
def delete_project_member(project_id):
    project = get_project(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404

    data = request.get_json(silent=True)
    user_id = data.get("user_id") if isinstance(data, dict) else None
    if not isinstance(user_id, str) or not user_id.strip():
        return jsonify({"error": "A user_id is required"}), 400

    user_id = user_id.strip()
    if not remove_project_member(project_id, user_id):
        return jsonify({"error": "Project member not found"}), 404
    # Free up their unfinished tasks for someone else; finished ones keep their name.
    for task in get_tasks(project_id):
        if task["status"] == "todo" and user_id in task["assignee_ids"]:
            set_assignees(project_id, task["id"], [uid for uid in task["assignee_ids"] if uid != user_id])
    run_assignment(get_project(project_id))
    return jsonify({"project_id": project_id, "user_id": user_id})