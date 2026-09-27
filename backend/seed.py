"""Writes demo data to Firestore: fake member profiles and a demo project with a task graph.

    .venv/bin/python seed.py                            # create the demo data, or reset it
    .venv/bin/python seed.py --give-task-to you@x.com   # also give that member a task to check off
    .venv/bin/python seed.py --delete                   # remove all of it

Seed users can't sign in; their ids aren't real Firebase accounts. Re-running is safe:
it overwrites the same documents instead of adding duplicates.
"""
import argparse
from datetime import datetime, timezone

from google.cloud.firestore_v1.base_query import FieldFilter

from dependency_graph import Task, validate_graph
from firebase import db
from profile_repository import list_profiles, save_profile
from profiles import validate_profile
from project_repository import add_project_member, get_project
from task_repository import complete_task, get_tasks, save_tasks, set_assignees
from task_routes import run_assignment

SEED_PROFILES = {
    "seed-maya": {
        "name": "Maya Patel",
        "seniority": "oldie",
        "strengths": ["backend", "python", "database"],
        "interests": ["data-ml"],
    },
    "seed-leo": {
        "name": "Leo Martinez",
        "seniority": "newbie",
        "strengths": ["frontend", "react", "css"],
        "interests": ["ui-design", "javascript"],
    },
    "seed-priya": {
        "name": "Priya Shah",
        "seniority": "oldie",
        "strengths": ["ui-design", "product-management"],
        "interests": ["frontend", "mobile"],
    },
    "seed-sam": {
        "name": "Sam Okafor",
        "seniority": "newbie",
        "strengths": ["javascript", "node", "apis"],
        "interests": ["backend", "devops"],
    },
    "seed-grace": {
        "name": "Grace Kim",
        "seniority": "oldie",
        "strengths": ["devops", "testing", "firebase"],
        "interests": ["auth"],
    },
    "seed-noah": {
        "name": "Noah Brooks",
        "seniority": "newbie",
        "strengths": ["data-ml", "python"],
        "interests": ["backend", "database"],
    },
}

DEMO_PROJECT_ID = "seed-demo-project"
DEMO_PROJECT = {
    "name": "Demo: Food Bank Tracker",
    "description": "Track donations and volunteer shifts for a local food bank.",
    "pm_user_id": "seed-priya",
}


def _task(id, title, skills, difficulty, deps=()):
    return {"id": id, "title": title, "description": title + ".", "dependencies": list(deps),
            "suggested_skills": skills, "estimated_difficulty": difficulty}


DEMO_TASKS = [
    _task("setup-repo", "Set up repo and CI", ["backend", "devops"], "easy"),
    _task("design-wireframes", "Design volunteer and donation screens", ["ui-design", "product-management"], "medium"),
    _task("firebase-auth", "Add sign-in", ["auth", "firebase"], "medium", ["setup-repo"]),
    _task("donations-schema", "Design the donations schema", ["database", "backend"], "medium", ["setup-repo"]),
    _task("donations-api", "Build the donations API", ["backend", "apis", "python"], "hard", ["donations-schema", "firebase-auth"]),
    _task("volunteer-signup-ui", "Build volunteer sign-up", ["frontend", "react"], "medium", ["design-wireframes", "firebase-auth"]),
    _task("inventory-dashboard", "Build the inventory dashboard", ["frontend", "react", "css"], "hard", ["design-wireframes", "donations-api"]),
    _task("shift-reminders", "Send shift reminders", ["node", "javascript"], "medium", ["donations-api"]),
    _task("end-to-end-tests", "Write end-to-end tests", ["testing"], "easy", ["volunteer-signup-ui", "inventory-dashboard"]),
]
# Finished before the demo starts, so the project looks partway through.
DEMO_DONE = ["setup-repo", "design-wireframes"]
# The presenter's task. Finishing it unblocks volunteer-signup-ui, so the demo shows auto-assignment.
PRESENTER_TASK = "firebase-auth"


def seed():
    for uid, profile in SEED_PROFILES.items():
        _, created = save_profile(uid, f"{uid.removeprefix('seed-')}@example.com", validate_profile(profile))
        print(f"{'created' if created else 'updated'} {uid}")
    seed_demo_project()


def seed_demo_project():
    error = validate_graph([Task(**task) for task in DEMO_TASKS])
    if error:
        raise ValueError(f"DEMO_TASKS is invalid: {error}")
    db.collection("projects").document(DEMO_PROJECT_ID).set({
        **DEMO_PROJECT, "id": DEMO_PROJECT_ID, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    for uid in SEED_PROFILES:
        add_project_member(DEMO_PROJECT_ID, uid)
    save_tasks(DEMO_PROJECT_ID, DEMO_TASKS)
    run_assignment(get_project(DEMO_PROJECT_ID))
    for task_id in DEMO_DONE:
        complete_task(DEMO_PROJECT_ID, task_id)
        run_assignment(get_project(DEMO_PROJECT_ID))
    print(f"seeded {DEMO_PROJECT_ID} with {len(DEMO_TASKS)} tasks")


def give_task_to(email):
    """Make the member with this email the one working on PRESENTER_TASK in the demo project."""
    matches = [p for p in list_profiles() if p["email"].lower() == email.lower()]
    if not matches:
        raise SystemExit(f"No profile with email {email}. Sign up on the site and create a profile first.")
    uid = matches[0]["id"]
    add_project_member(DEMO_PROJECT_ID, uid)
    for task in get_tasks(DEMO_PROJECT_ID):
        if task["status"] == "todo" and uid in task["assignee_ids"] and task["id"] != PRESENTER_TASK:
            set_assignees(DEMO_PROJECT_ID, task["id"], [u for u in task["assignee_ids"] if u != uid])
    set_assignees(DEMO_PROJECT_ID, PRESENTER_TASK, [uid])
    run_assignment(get_project(DEMO_PROJECT_ID))
    print(f"{email} is now working on {PRESENTER_TASK}")


def delete():
    project = db.collection("projects").document(DEMO_PROJECT_ID)
    for doc in project.collection("tasks").stream():
        doc.reference.delete()
    members = db.collection("project_members").where(filter=FieldFilter("project_id", "==", DEMO_PROJECT_ID))
    for doc in members.stream():
        doc.reference.delete()
    project.delete()
    print(f"deleted {DEMO_PROJECT_ID}")
    for uid in SEED_PROFILES:
        db.collection("users").document(uid).delete()
        print(f"deleted {uid}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed or remove demo data.")
    parser.add_argument("--delete", action="store_true", help="remove all demo data")
    parser.add_argument("--give-task-to", metavar="EMAIL", help="after seeding, give this member the presenter task")
    args = parser.parse_args()
    if args.delete:
        delete()
    else:
        seed()
        if args.give_task_to:
            give_task_to(args.give_task_to)
