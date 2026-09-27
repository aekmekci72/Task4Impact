from datetime import datetime, timezone

from firebase import db
from profile_repository import get_profile


def create_project(name, description, creator_id):
    project_ref = db.collection("projects").document()
    project = {
        "id": project_ref.id,
        "name": name,
        "description": description,
        "pm_user_id": creator_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    batch = db.batch()
    batch.set(project_ref, project)
    batch.set(_membership_ref(project_ref.id, creator_id), {
        "project_id": project_ref.id,
        "user_id": creator_id,
    })
    batch.commit()
    return get_project(project_ref.id)


def get_project(project_id):
    doc = db.collection("projects").document(project_id).get()
    if not doc.exists:
        return None

    members = []
    member_docs = db.collection("project_members").where("project_id", "==", project_id).stream()
    for member_doc in member_docs:
        profile = get_profile(member_doc.to_dict()["user_id"])
        if profile is not None:
            members.append(profile)
    members.sort(key=lambda profile: profile["name"].casefold())
    return {**doc.to_dict(), "id": doc.id, "members": members}


def list_projects():
    projects = [
        project
        for doc in db.collection("projects").stream()
        if (project := get_project(doc.id)) is not None
    ]
    return sorted(projects, key=lambda project: project["name"].casefold())


def update_project(project_id, fields):
    project_ref = db.collection("projects").document(project_id)
    if not project_ref.get().exists:
        return None
    project_ref.update(fields)
    return get_project(project_id)


def add_project_member(project_id, user_id):
    member_ref = _membership_ref(project_id, user_id)
    if member_ref.get().exists:
        return False
    member_ref.set({"project_id": project_id, "user_id": user_id})
    return True


def remove_project_member(project_id, user_id):
    member_ref = _membership_ref(project_id, user_id)
    if not member_ref.get().exists:
        return False
    member_ref.delete()
    return True


def _membership_ref(project_id, user_id):
    return db.collection("project_members").document(f"{project_id}:{user_id}")