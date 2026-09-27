"""
task_assignment.py

Given a dependency graph (as produced by dependency_graph.py), a list of user
profiles, and which task ids are already completed, this finds the OPTIMAL
way to hand out currently-unlocked tasks to idle users, using Google OR-Tools'
CP-SAT constraint solver.

It optimizes for, in priority order:

  1. Assign as many idle people as task capacity allows (nobody sits out
     unnecessarily) — but NEVER put two people on the same task beyond that
     task's capacity. Most tasks have capacity 1, so if there are enough
     distinct unlocked tasks to go around, everyone gets a different one.
  2. Skill/interest match between each person and their task.
  3. Seniority vs. task difficulty fit.
  4. Graph "criticality" — tasks that unlock more future work are preferred,
     so the team doesn't stall on a bottleneck.
  5. A bonus for pairing a senior with a junior on the same task, when that
     task has room for two (capacity 2) — e.g. mentorship on a hard task.

Task capacity: a task holds 1 person unless its `capacity` field says
otherwise (see dependency_graph.py's Task.capacity), or it defaults to 2
for `hard` tasks if capacity wasn't explicitly set.

"Works well together" is currently inferred as senior+junior pairing. If you
later want explicit pairs instead, replace `_pair_bonus` with a lookup into
a COMPATIBLE_PAIRS set/dict of (user_id, user_id) -> bonus.

Requires: pip install ortools pydantic

Usage from Flask:

    from task_assignment import assign_tasks

    @app.route("/api/projects/<project_id>/assign", methods=["POST"])
    def run_assignment(project_id):
        graph = ...              # dict loaded from Firestore, {"tasks": [...]}
        users = ...               # list of dicts loaded from Firestore
        completed_task_ids = ...  # list of task id strings

        assignments = assign_tasks(graph, users, completed_task_ids)
        # assignments: {user_id: task_id}
        # write these back to Firestore (set each assigned user's current_task)
        return jsonify(assignments)

Run directly for a quick sanity check with dummy data:

    python task_assignment.py
"""

from collections import defaultdict
from typing import Dict, List, Optional

from ortools.sat.python import cp_model
from pydantic import BaseModel

from dependency_graph import Task
from skills import SKILL_TAGS

# ---------------------------------------------------------------------------
# Scoring weights — tune these as you playtest
# ---------------------------------------------------------------------------

STRENGTH_WEIGHT = 2.0        # matching a user's strength to a task's suggested_skills
INTEREST_WEIGHT = 1.0        # matching a user's interest to a task's suggested_skills
SENIORITY_FIT_WEIGHT = 1.0   # bonus for senior-on-hard / junior-on-easy pairing
CRITICALITY_WEIGHT = 1.5     # bonus for tasks that unlock more downstream work
SENIOR_JUNIOR_PAIR_BONUS = 3.0  # bonus for pairing a senior + junior on a capacity-2 task

# Dominates the fit-quality terms so the solver maximizes headcount assigned
# FIRST, then optimizes fit among all maximum-headcount solutions.
ASSIGNMENT_BONUS = 100.0

# CP-SAT wants integer coefficients; scale floats up before rounding.
SCORE_SCALE = 100

SENIORITY_RANK = {"junior": 0, "mid": 1, "senior": 2}
DIFFICULTY_RANK = {"easy": 0, "medium": 1, "hard": 2}


class UserProfile(BaseModel):
    id: str
    name: str
    strengths: List[str] = []
    interests: List[str] = []
    seniority: str = "mid"
    current_task: Optional[str] = None

# ---------------------------------------------------------------------------
# Graph helpers
# ---------------------------------------------------------------------------

def _build_dependents_map(tasks: List[Task]) -> Dict[str, List[str]]:
    """Maps task id -> list of task ids that directly depend on it."""
    dependents = defaultdict(list)
    for t in tasks:
        for dep in t.dependencies:
            dependents[dep].append(t.id)
    return dependents


def _count_descendants(task_id: str, dependents_map: Dict[str, List[str]]) -> int:
    """How many tasks (directly or transitively) become reachable once this one is done."""
    seen = set()
    stack = list(dependents_map.get(task_id, []))
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        stack.extend(dependents_map.get(node, []))
    return len(seen)


def get_available_tasks(
    tasks: List[Task],
    completed_task_ids: List[str],
    in_progress_task_ids: List[str],
) -> List[Task]:
    """Tasks whose dependencies are all completed, that aren't done, and aren't already claimed."""
    completed = set(completed_task_ids)
    unavailable = completed | set(in_progress_task_ids)
    return [
        t for t in tasks
        if t.id not in unavailable and all(dep in completed for dep in t.dependencies)
    ]


def _task_capacity(task: Task) -> int:
    """1 by default, 2 for hard tasks, unless the graph set capacity explicitly."""
    if task.capacity:
        return max(1, task.capacity)
    return 2 if task.estimated_difficulty == "hard" else 1


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _individual_score(user: UserProfile, task: Task, criticality_norm: float) -> float:
    task_skills = {s.lower() for s in task.suggested_skills}
    strengths = {s.lower() for s in user.strengths}
    interests = {s.lower() for s in user.interests}

    strength_matches = len(task_skills & strengths)
    interest_matches = len(task_skills & interests)

    seniority_gap = abs(
        SENIORITY_RANK.get(user.seniority, 1) - DIFFICULTY_RANK.get(task.estimated_difficulty, 1)
    )
    seniority_fit = 1.0 - (seniority_gap * 0.5)  # 1.0 exact match, 0.0 max mismatch

    return (
        STRENGTH_WEIGHT * strength_matches
        + INTEREST_WEIGHT * interest_matches
        + SENIORITY_FIT_WEIGHT * seniority_fit
        + CRITICALITY_WEIGHT * criticality_norm
    )


def _pair_bonus(u1: UserProfile, u2: UserProfile) -> float:
    """
    Inferred "works well together" signal: reward a senior+junior pairing.
    Swap this out for a lookup into an explicit compatibility list if/when
    you want people to set that themselves.
    """
    if {u1.seniority, u2.seniority} == {"senior", "junior"}:
        return SENIOR_JUNIOR_PAIR_BONUS
    return 0.0


# ---------------------------------------------------------------------------
# Core function
# ---------------------------------------------------------------------------

def assign_tasks(
    graph: dict,
    users: List[dict],
    completed_task_ids: List[str],
) -> Dict[str, str]:
    """
    Returns {user_id: task_id}, the optimal assignment of idle users to
    currently-unlocked tasks: maximum number of people assigned without
    exceeding any task's capacity, then best fit + pairing bonus among those
    solutions. Returns {} if there are no idle users or nothing is unlocked.
    """
    tasks = [Task(**t) for t in graph["tasks"]]
    profiles = [UserProfile(**u) for u in users]

    invalid_skills = [
        skill
        for profile in profiles
        for skill in profile.strengths + profile.interests
        if skill not in SKILL_TAGS
    ]

    if invalid_skills:
        raise ValueError(
            f"Invalid user skill tags: {invalid_skills}. "
            f"Valid tags are: {list(SKILL_TAGS)}"
        )

    dependents_map = _build_dependents_map(tasks)
    descendant_counts = {t.id: _count_descendants(t.id, dependents_map) for t in tasks}
    max_descendants = max(descendant_counts.values(), default=0) or 1

    in_progress_task_ids = [u.current_task for u in profiles if u.current_task]
    idle_users = [u for u in profiles if u.current_task is None]

    available = get_available_tasks(tasks, completed_task_ids, in_progress_task_ids)

    if not idle_users or not available:
        return {}

    model = cp_model.CpModel()

    # x[(user_id, task_id)] = 1 if that user is assigned that task
    x = {
        (u.id, t.id): model.NewBoolVar(f"x_{u.id}_{t.id}")
        for u in idle_users
        for t in available
    }

    # Each idle user gets at most one task.
    for u in idle_users:
        model.Add(sum(x[(u.id, t.id)] for t in available) <= 1)

    # Each task is filled up to (and never beyond) its capacity.
    for t in available:
        model.Add(sum(x[(u.id, t.id)] for u in idle_users) <= _task_capacity(t))

    # Pairing bonus variables: only created for user pairs with a nonzero
    # bonus, on tasks with room for two — keeps the model small.
    pair_terms = []
    for t in available:
        if _task_capacity(t) < 2:
            continue
        for i, u1 in enumerate(idle_users):
            for u2 in idle_users[i + 1:]:
                bonus = _pair_bonus(u1, u2)
                if bonus <= 0:
                    continue
                y = model.NewBoolVar(f"pair_{u1.id}_{u2.id}_{t.id}")
                model.AddMultiplicationEquality(y, [x[(u1.id, t.id)], x[(u2.id, t.id)]])
                pair_terms.append(int(round(bonus * SCORE_SCALE)) * y)

    # Objective: headcount assigned (dominant) + fit quality + pairing bonus.
    objective_terms = []
    for u in idle_users:
        for t in available:
            crit_norm = descendant_counts[t.id] / max_descendants
            score = _individual_score(u, t, crit_norm)
            coeff = int(round((ASSIGNMENT_BONUS + score) * SCORE_SCALE))
            objective_terms.append(coeff * x[(u.id, t.id)])
    objective_terms.extend(pair_terms)

    model.Maximize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)

    assignments = {}
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for u in idle_users:
            for t in available:
                if solver.Value(x[(u.id, t.id)]) == 1:
                    assignments[u.id] = t.id
    return assignments


# ---------------------------------------------------------------------------
# Manual test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    dummy_graph = {
        "tasks": [
            {"id": "setup-repo", "title": "Set up repo", "description": "Init project scaffolding",
            "dependencies": [], "suggested_skills": ["devops"], "estimated_difficulty": "easy"},            {"id": "design-mockups", "title": "Design mockups", "description": "UI mockups for core screens",
             "dependencies": [], "suggested_skills": ["ui-design"], "estimated_difficulty": "medium",
             "capacity": 2},
            {"id": "firebase-auth", "title": "Firebase auth", "description": "Wire up auth + protected routes",
             "dependencies": ["setup-repo"], "suggested_skills": ["backend", "auth", "firebase"],
             "estimated_difficulty": "medium"},
            {"id": "landing-page", "title": "Landing page", "description": "Sign-in landing page",
             "dependencies": ["firebase-auth"], "suggested_skills": ["frontend", "ui-design", "react"],
             "estimated_difficulty": "easy"},
            {"id": "profile-page", "title": "Profile page", "description": "Create/edit profile",
             "dependencies": ["firebase-auth"], "suggested_skills": ["frontend", "ui-design"],
             "estimated_difficulty": "medium"},
            {"id": "dependency-graph-ui", "title": "Graph UI", "description": "Render dependency graph interactively",
            "dependencies": ["profile-page"], "suggested_skills": ["frontend", "react", "data-ml"],
            "estimated_difficulty": "hard"},        
        ]
    }

    dummy_users = [
        {"id": "u1", "name": "David", "strengths": ["backend", "firebase", "auth"],
         "interests": ["backend"], "seniority": "senior", "current_task": None},
        {"id": "u2", "name": "Tiffany", "strengths": ["ui-design", "frontend", "react"],
         "interests": ["ui-design"], "seniority": "mid", "current_task": None},
        {"id": "u3", "name": "Jonah", "strengths": ["database"],
         "interests": ["ui-design"], "seniority": "junior", "current_task": None},
        {"id": "u4", "name": "Anna", "strengths": ["ui-design"],
         "interests": ["ui-design"], "seniority": "senior", "current_task": None},
    ]

    completed_task_ids = []

    result = assign_tasks(dummy_graph, dummy_users, completed_task_ids)
    for user_id, task_id in result.items():
        user_name = next(u["name"] for u in dummy_users if u["id"] == user_id)
        print(f"{user_name} -> {task_id}")

    unassigned = [u["name"] for u in dummy_users if u["id"] not in result]
    if unassigned:
        print(f"Still idle (no capacity left): {', '.join(unassigned)}")