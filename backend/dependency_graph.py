"""
dependency_graph.py

Generates a task dependency graph from a project description (and, optionally,
developer profiles) using the Gemini API's structured output mode.

Usage from Flask:

    from dependency_graph import generate_dependency_graph

    @app.route("/api/projects/<project_id>/graph", methods=["POST"])
    def create_graph(project_id):
        data = request.json
        graph = generate_dependency_graph(
            project_description=data["description"],
            dev_profiles=data.get("devs"),
        )
        return jsonify(graph)

Run directly for a quick sanity check without Flask:

    python dependency_graph.py
"""

import os
import json
from typing import List, Optional

from google import genai
from pydantic import BaseModel, Field

from skills import SKILL_TAGS

MODEL_NAME = "gemini-3.8-flash"


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

class Task(BaseModel):
    id: str = Field(description="Short unique slug, e.g. 'setup-firebase'")
    title: str
    description: str = Field(
        description="1-2 sentences on what this task involves"
    )
    dependencies: List[str] = Field(
        default_factory=list,
        description=(
            "List of task ids that must be completed before this one. "
            "Empty list if none."
        ),
    )
    suggested_skills: List[str] = Field(
        default_factory=list,
        description=(
            "Skill tags from the fixed SKILL_TAGS list. "
            "Do not invent new tags."
        ),
    )
    estimated_difficulty: str = Field(
        description="One of: 'easy', 'medium', 'hard'"
    )
    capacity: Optional[int] = Field(
        default=None,
        description=(
            "How many people can work on this task at once. Usually omit this "
            "(defaults to 1, or 2 for hard tasks). Set explicitly to 2 only "
            "for tasks that would genuinely benefit from two people, such as "
            "a complex integration worth pairing on."
        ),
    )


class DependencyGraph(BaseModel):
    tasks: List[Task]


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def _get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable is not set")

    return genai.Client(api_key=api_key)


def _build_prompt(
    project_description: str,
    dev_profiles: Optional[List[dict]],
    existing_graph: Optional[dict],
    regen_instruction: Optional[str],
) -> str:
    parts = [
        "You are helping a hackathon team break a project into a task dependency graph.",
        "Break the project description below into a set of concrete, actionable tasks.",
        "Every task must have a unique id (short slug, lowercase, hyphenated).",
        "Dependencies must reference other task ids in this same list — never invent ids that aren't tasks.",
        "The graph must be a valid DAG: no task may depend on itself, and there must be no cycles.",
        "Keep the task list reasonably sized (roughly 8-25 tasks) — not overly granular.",
        "For suggested_skills, choose only from this fixed tag list (do not invent new tags): "
        + ", ".join(SKILL_TAGS),
        "",
        f"PROJECT DESCRIPTION:\n{project_description}",
    ]

    if dev_profiles:
        parts.append(
            "\nTEAM MEMBERS (for context on suggested_skills only — "
            "do not assign people to tasks here):\n"
            + json.dumps(dev_profiles, indent=2)
        )

    if existing_graph and regen_instruction:
        parts.append(
            "\nAn existing graph already exists. Modify it according to this "
            "instruction, keeping unaffected tasks/ids stable where possible:\n"
            f"INSTRUCTION: {regen_instruction}\n"
            f"EXISTING GRAPH:\n{json.dumps(existing_graph, indent=2)}"
        )

    return "\n".join(parts)


def _has_cycle(tasks: List[Task]) -> bool:
    """Simple DFS cycle check so we can catch a bad LLM output before it hits the DB."""
    graph = {task.id: task.dependencies for task in tasks}

    WHITE, GRAY, BLACK = 0, 1, 2
    color = {task_id: WHITE for task_id in graph}

    def visit(node):
        if color.get(node) == GRAY:
            return True

        if color.get(node) == BLACK or node not in graph:
            return False

        color[node] = GRAY

        for dependency in graph[node]:
            if visit(dependency):
                return True

        color[node] = BLACK
        return False

    return any(visit(task_id) for task_id in graph)


# ---------------------------------------------------------------------------
# Graph generation
# ---------------------------------------------------------------------------

def generate_dependency_graph(
    project_description: str,
    dev_profiles: Optional[List[dict]] = None,
    existing_graph: Optional[dict] = None,
    regen_instruction: Optional[str] = None,
    max_retries: int = 2,
) -> dict:
    """
    Returns a dict:

        {
            "tasks": [
                {
                    "id": ...,
                    "title": ...,
                    "description": ...,
                    "dependencies": [...],
                    "suggested_skills": [...],
                    "estimated_difficulty": ...,
                    "capacity": ...
                }
            ]
        }

    Pass existing_graph + regen_instruction together to ask for a targeted
    edit of a graph that's already been generated.
    """

    client = _get_client()
    prompt = _build_prompt(
        project_description,
        dev_profiles,
        existing_graph,
        regen_instruction,
    )

    last_error = None

    for attempt in range(max_retries + 1):
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=(
                prompt
                if attempt == 0
                else prompt
                + (
                    f"\n\nYour previous attempt was invalid: {last_error}. "
                    "Fix this and return a valid DAG with no cycles, "
                    "no unknown dependency ids, and only valid skill tags."
                )
            ),
            config={
                "response_mime_type": "application/json",
                "response_schema": DependencyGraph,
            },
        )

        try:
            parsed: DependencyGraph = response.parsed
        except Exception as e:
            last_error = (
                f"could not parse response as DependencyGraph ({e})"
            )
            continue

        task_ids = {task.id for task in parsed.tasks}

        unknown_refs = [
            dependency
            for task in parsed.tasks
            for dependency in task.dependencies
            if dependency not in task_ids
        ]

        if unknown_refs:
            last_error = (
                f"dependencies reference unknown task ids: {unknown_refs}"
            )
            continue

        invalid_skills = [
            skill
            for task in parsed.tasks
            for skill in task.suggested_skills
            if skill not in SKILL_TAGS
        ]

        if invalid_skills:
            last_error = (
                f"tasks contain invalid skill tags: {invalid_skills}. "
                f"Valid tags are: {list(SKILL_TAGS)}"
            )
            continue

        if _has_cycle(parsed.tasks):
            last_error = "the generated graph contains a cycle"
            continue

        return parsed.model_dump()

    raise RuntimeError(
        "Failed to generate a valid dependency graph after retries: "
        f"{last_error}"
    )


# ---------------------------------------------------------------------------
# Manual test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    sample_description = (
        "A web app where hackathon teams create profiles, get grouped into "
        "projects, and get tasks assigned automatically based on a generated "
        "dependency graph. Needs Firebase auth, a home page listing members, "
        "a profile page, and a project creation flow for PMs/TLs."
    )

    graph = generate_dependency_graph(sample_description)

    print(json.dumps(graph, indent=2))