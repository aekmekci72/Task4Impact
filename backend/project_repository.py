from collections import defaultdict
from datetime import datetime, timezone

from google.cloud.firestore_v1.base_query import FieldFilter

from firebase import db
from profile_repository import get_profiles


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

    member_docs = db.collection("project_members").where(filter=FieldFilter("project_id", "==", project_id)).stream()
    member_ids = [member_doc.to_dict()["user_id"] for member_doc in member_docs]
    return {**doc.to_dict(), "id": doc.id, "members": _sorted_by_name(get_profiles(member_ids))}


def list_projects():
    # Three reads in total (memberships, the members' profiles, projects) instead of
    # one read per member per project.
    member_ids = defaultdict(list)
    for doc in db.collection("project_members").stream():
        membership = doc.to_dict()
        member_ids[membership["project_id"]].append(membership["user_id"])
    all_ids = {uid for ids in member_ids.values() for uid in ids}
    profiles = {profile["id"]: profile for profile in get_profiles(all_ids)}
    projects = [
        {
            **doc.to_dict(),
            "id": doc.id,
            "members": _sorted_by_name([profiles[uid] for uid in member_ids[doc.id] if uid in profiles]),
        }
        for doc in db.collection("projects").stream()
    ]
    return _sorted_by_name(projects)


def projects_by_member():
    """Maps each user id to the projects they're on, as [{"id", "name"}] sorted by name."""
    names = {doc.id: doc.to_dict()["name"] for doc in db.collection("projects").stream()}
    by_member = defaultdict(list)
    for doc in db.collection("project_members").stream():
        membership = doc.to_dict()
        if membership["project_id"] in names:
            by_member[membership["user_id"]].append(
                {"id": membership["project_id"], "name": names[membership["project_id"]]}
            )
    for projects in by_member.values():
        projects.sort(key=lambda project: project["name"].casefold())
    return by_member


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


def _sorted_by_name(items):
    return sorted(items, key=lambda item: item["name"].casefold())
