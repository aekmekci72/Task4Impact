from datetime import datetime, timezone

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from firebase import db


def save_tasks(project_id, tasks):
    """Replace a project's whole task graph. tasks are dicts shaped like dependency_graph.Task."""
    batch = db.batch()
    for doc in _tasks(project_id).stream():
        batch.delete(doc.reference)
    for task in tasks:
        batch.set(_tasks(project_id).document(task["id"]), {
            "title": task["title"],
            "description": task.get("description", ""),
            "dependencies": task.get("dependencies", []),
            "suggested_skills": task.get("suggested_skills", []),
            "estimated_difficulty": task["estimated_difficulty"],
            "capacity": task.get("capacity"),
            "status": "todo",
            "assignee_ids": [],
            "completed_at": None,
        })
    batch.commit()


def get_tasks(project_id):
    return [_to_task(doc) for doc in _tasks(project_id).stream()]


def tasks_for_user(uid):
    query = db.collection_group("tasks").where(filter=FieldFilter("assignee_ids", "array_contains", uid))
    return [_to_task(doc) for doc in query.stream()]


def complete_task(project_id, task_id):
    """Mark a task done. Returns the updated task, or None if it doesn't exist."""
    ref = _tasks(project_id).document(task_id)
    if not ref.get().exists:
        return None
    ref.update({"status": "done", "completed_at": datetime.now(timezone.utc).isoformat()})
    return _to_task(ref.get())


def set_assignments(project_id, assignments):
    """Record assign_tasks output ({user_id: task_id}) on the tasks' assignee_ids."""
    batch = db.batch()
    for user_id, task_id in assignments.items():
        batch.update(_tasks(project_id).document(task_id), {"assignee_ids": firestore.ArrayUnion([user_id])})
    batch.commit()


def _tasks(project_id):
    return db.collection("projects").document(project_id).collection("tasks")


def _to_task(doc):
    return {"id": doc.id, "project_id": doc.reference.parent.parent.id, **doc.to_dict()}
