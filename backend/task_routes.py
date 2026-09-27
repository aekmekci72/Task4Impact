from flask import Blueprint, g, jsonify, request
from pydantic import ValidationError

from dependency_graph import DependencyGraph, generate_dependency_graph, validate_graph
from project_repository import get_project
from task_assignment import assign_tasks
from task_repository import complete_task, get_tasks, save_tasks, set_assignments, tasks_for_user

bp = Blueprint("tasks", __name__, url_prefix="/api")


@bp.post("/projects/<project_id>/generate")
def generate(project_id):
    project = get_project(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    if not project["description"].strip():
        return jsonify({"error": "Add a project description before generating tasks"}), 400
    team = [{k: m[k] for k in ("strengths", "interests", "seniority")} for m in project["members"]]
    try:
        return jsonify(generate_dependency_graph(project["description"], dev_profiles=team))
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502


@bp.put("/projects/<project_id>/tasks")
def put_tasks(project_id):
    project = get_project(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    try:
        graph = DependencyGraph.model_validate(request.get_json(silent=True))
    except ValidationError as e:
        return jsonify({"error": f"Invalid task graph: {e.errors()[0]['msg']}"}), 400
    if not graph.tasks:
        return jsonify({"error": "Add at least one task"}), 400
    error = validate_graph(graph.tasks)
    if error:
        return jsonify({"error": error}), 400
    save_tasks(project_id, [task.model_dump() for task in graph.tasks])
    _run_assignment(project)
    return jsonify(get_tasks(project_id))


@bp.get("/me/tasks")
def my_tasks():
    return jsonify(tasks_for_user(g.user_id))


@bp.post("/projects/<project_id>/tasks/<task_id>/complete")
def complete(project_id, task_id):
    project = get_project(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    task = complete_task(project_id, task_id)
    if task is None:
        return jsonify({"error": "Task not found"}), 404
    _run_assignment(project)
    return jsonify(task)


def _run_assignment(project):
    """Assign idle project members to ready tasks and record the result on the tasks."""
    tasks = get_tasks(project["id"])
    open_task = {uid: t["id"] for t in tasks if t["status"] == "todo" for uid in t["assignee_ids"]}
    users = [{**m, "current_task": open_task.get(m["id"])} for m in project["members"]]
    completed = [t["id"] for t in tasks if t["status"] == "done"]
    set_assignments(project["id"], assign_tasks({"tasks": tasks}, users, completed))
