"""
graph_routes.py

Two endpoints, both currently backed by hardcoded dummy data:

  POST /api/graph/generate  -> generates a dependency graph via Gemini
  POST /api/graph/assign    -> runs the OR-Tools task assignment

Swap the DUMMY_* constants below for request.json / Firestore reads once
the project-creation and profile flows are wired up to real data. The
functions themselves (generate_dependency_graph, assign_tasks) don't need
to change — only what you pass into them.
"""

from flask import Blueprint, jsonify

from dependency_graph import generate_dependency_graph
from task_assignment import assign_tasks

bp = Blueprint("graph", __name__, url_prefix="/api/graph")


# ---------------------------------------------------------------------------
# Dummy data — replace with real reads later
# ---------------------------------------------------------------------------

DUMMY_PROJECT_DESCRIPTION = (
    "A web app where hackathon teams create profiles, get grouped into "
    "projects, and get tasks assigned automatically based on a generated "
    "dependency graph. Needs Firebase auth, a home page listing members, a "
    "profile page, and a project creation flow for PMs/TLs."
)

DUMMY_DEV_PROFILES = [
    {"id": "u1", "name": "David", "strengths": ["backend", "firebase", "auth"],
     "interests": ["backend"], "seniority": "senior"},
    {"id": "u2", "name": "Tiffany", "strengths": ["ui-design", "frontend", "react"],
     "interests": ["ui-design"], "seniority": "mid"},
    {"id": "u3", "name": "Jonah", "strengths": ["react"],
     "interests": ["ui-design"], "seniority": "junior"},
    {"id": "u4", "name": "Anna", "strengths": ["ui-design"],
     "interests": ["ui-design"], "seniority": "senior"},
]

DUMMY_GRAPH = {
    "tasks": [
        {"id": "setup-repo", "title": "Set up repo", "description": "Init project scaffolding",
         "dependencies": [], "suggested_skills": ["react"], "estimated_difficulty": "easy", "capacity": 1},
        {"id": "design-mockups", "title": "Design mockups", "description": "UI mockups for core screens",
         "dependencies": [], "suggested_skills": ["ui-design"], "estimated_difficulty": "medium", "capacity": 2},
        {"id": "firebase-auth", "title": "Firebase auth", "description": "Wire up auth + protected routes",
         "dependencies": ["setup-repo"], "suggested_skills": ["backend", "auth", "firebase"],
         "estimated_difficulty": "medium", "capacity": 1},
        {"id": "landing-page", "title": "Landing page", "description": "Sign-in landing page",
         "dependencies": ["firebase-auth"], "suggested_skills": ["frontend", "ui-design", "react"],
         "estimated_difficulty": "easy", "capacity": 1},
        {"id": "profile-page", "title": "Profile page", "description": "Create/edit profile",
         "dependencies": ["firebase-auth"], "suggested_skills": ["frontend", "ui-design"],
         "estimated_difficulty": "medium", "capacity": 1},
        {"id": "dependency-graph-ui", "title": "Graph UI", "description": "Render dependency graph interactively",
         "dependencies": ["profile-page"], "suggested_skills": ["frontend", "react", "data"],
         "estimated_difficulty": "hard", "capacity": 2},
    ]
}

DUMMY_USERS = [
    {"id": "u1", "name": "David", "strengths": ["backend", "firebase", "auth"],
     "interests": ["backend"], "seniority": "senior", "current_task": None},
    {"id": "u2", "name": "Tiffany", "strengths": ["ui-design", "frontend", "react"],
     "interests": ["ui-design"], "seniority": "mid", "current_task": None},
    {"id": "u3", "name": "Jonah", "strengths": ["auth"],
     "interests": ["ui-design"], "seniority": "junior", "current_task": None},
    {"id": "u4", "name": "Anna", "strengths": ["ui-design"],
     "interests": ["ui-design"], "seniority": "senior", "current_task": None},
]

DUMMY_COMPLETED_TASK_IDS = []


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@bp.post("/generate")
def generate_graph():
    """Generates a dependency graph. Uses hardcoded dummy inputs for now."""
    try:
        graph = generate_dependency_graph(
            project_description=DUMMY_PROJECT_DESCRIPTION,
            dev_profiles=DUMMY_DEV_PROFILES,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(graph)


@bp.post("/assign")
def assign():
    """Runs task assignment. Uses hardcoded dummy graph/users/progress for now."""
    try:
        assignments = assign_tasks(
            graph=DUMMY_GRAPH,
            users=DUMMY_USERS,
            completed_task_ids=DUMMY_COMPLETED_TASK_IDS,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(assignments)