from flask import Blueprint, g, jsonify, request
from pydantic import ValidationError

from dependency_graph import DependencyGraph, Task, generate_dependency_graph, validate_graph
from project_repository import get_project
from task_assignment import assign_tasks, task_capacity
from task_repository import (
    complete_task,
    get_task,
    get_tasks,
    save_tasks,
    set_assignees,
    set_assignments,
    tasks_for_user,
)

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
    except Exception as e:  # missing key, LLM errors after retries, or no valid graph after retries
        return jsonify({"error": f"Couldn't generate tasks: {e}"}), 502


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
    save_tasks(project_id, _carry_over_progress(graph.tasks, get_tasks(project_id)))
    run_assignment(project)
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
    run_assignment(project)
    return jsonify(task)



@bp.put("/projects/<project_id>/tasks/<task_id>/assignees")
def put_assignees(project_id, task_id):
    project = get_project(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    task = get_task(project_id, task_id)
    if task is None:
        return jsonify({"error": "Task not found"}), 404
    if task["status"] == "done":
        return jsonify({"error": "This task is already done"}), 400
    data = request.get_json(silent=True)
    user_ids = data.get("assignee_ids") if isinstance(data, dict) else None
    if not isinstance(user_ids, list) or not all(isinstance(u, str) for u in user_ids):
        return jsonify({"error": "assignee_ids must be a list of user ids"}), 400
    user_ids = list(dict.fromkeys(user_ids))
    outsiders = [u for u in user_ids if u not in {m["id"] for m in project["members"]}]
    if outsiders:
        return jsonify({"error": f"Not on this project: {outsiders}"}), 400
    capacity = task_capacity(Task(**task))
    if len(user_ids) > capacity:
        return jsonify({"error": f"This task has room for {capacity} at most"}), 400
    tasks = get_tasks(project_id)
    done = {t["id"] for t in tasks if t["status"] == "done"}
    waiting_on = [dep for dep in task["dependencies"] if dep not in done]
    if user_ids and waiting_on:
        return jsonify({"error": f"This task is still waiting on: {waiting_on}"}), 400
    busy = sorted({u for t in tasks
                   if t["status"] == "todo" and t["id"] != task_id
                   for u in t["assignee_ids"] if u in user_ids})
    if busy:
        return jsonify({"error": f"Already working on another task: {busy}"}), 400
    return jsonify(set_assignees(project_id, task_id, user_ids))



def _carry_over_progress(tasks, old_tasks):
    """Keep status and assignees for tasks that survive an edit, unless that would break assignment rules."""
    old = {t["id"]: t for t in old_tasks}
    kept_done = {task.id for task in tasks if task.id in old and old[task.id]["status"] == "done"}
    merged = []
    for task in tasks:
        fields = task.model_dump()
        previous = old.get(task.id)
        if previous:
            still_valid = previous["status"] == "done" or (
                all(dep in kept_done for dep in task.dependencies)
                and len(previous["assignee_ids"]) <= task_capacity(task)
            )
            fields["status"] = previous["status"]
            fields["completed_at"] = previous["completed_at"]
            fields["assignee_ids"] = previous["assignee_ids"] if still_valid else []
        merged.append(fields)
    return merged


def run_assignment(project):
    """Assign idle project members to ready tasks and record the result on the tasks."""
    tasks = get_tasks(project["id"])
    open_task = {uid: t["id"] for t in tasks if t["status"] == "todo" for uid in t["assignee_ids"]}
    users = [{**m, "current_task": open_task.get(m["id"])} for m in project["members"]]
    completed = [t["id"] for t in tasks if t["status"] == "done"]
    set_assignments(project["id"], assign_tasks({"tasks": tasks}, users, completed))
