# Hack4Impact Intro Project

A web app where Hack4Impact members keep profiles, any member can start a project, an LLM turns the project description into a task dependency graph, and ready tasks are auto-assigned to devs by strengths and interests.

Full product spec lives in the team PRD (Claude Doc). This file is the engineering summary. If something here conflicts with the PRD, ask before choosing.

## Team and ownership

- **Jonah:** setup, API (Flask), database, auth middleware, LLM generation, assignment logic, deploy.
- **Tiffany:** UI (React pages and components).
- Do not edit files outside the area the current task is about unless asked. If a change needs the other side (e.g. an API change that breaks a page), say so instead of silently editing it.

## Stack

The stack is what the repo scaffold already uses (it replaced the original Hono/Workers/D1 plan in the PRD).

- **API:** Flask (Python), with `flask-cors`
- **Frontend:** React + Vite, npm
- **Database:** Firestore, accessed from the API through `firebase-admin`. The frontend never talks to Firestore directly; all reads and writes go through the API.
- **Auth:** Firebase Auth (Google sign-in)
- **LLM:** Gemini, via the `google-genai` SDK (`backend/dependency_graph.py`). The key is read from the `GEMINI_API_KEY` environment variable; keep it in a gitignored `.env`, never in frontend code or the repo.
- **Deploy:** API on Render, frontend on Firebase Hosting

## Repo layout

```
/frontend     React + Vite app
/backend      Flask API (routes, auth, Firestore access, logic)
```

## Commands

<!-- Fill in the TBDs as setup lands -->
- Frontend install / dev: `cd frontend && npm install && npm run dev`
- Backend install: `cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
- Backend dev: `cd backend && .venv/bin/python app.py` (serves on port 5001; macOS AirPlay takes port 5000). Needs `firebase-service-account.json` in `backend/`.
- Seed demo profiles: `cd backend && .venv/bin/python seed_profiles.py` (add `--delete` to remove them). Seed ids start with `seed-` and can't sign in.
- Firestore access goes through `db` in `backend/firebase.py`; each collection gets its own `*_repository.py` (e.g. `profile_repository.py`).
- Deploy (API): Render web service, root directory `backend`, build `pip install -r requirements.txt`, start `gunicorn app:app`. The service account key is a Render secret file; `FIREBASE_CREDENTIALS_PATH=/etc/secrets/firebase-service-account.json` points `firebase.py` at it.
- Deploy (frontend): TBD (Firebase Hosting)

## Secrets

- `backend/firebase-service-account.json` is a private key with full admin access to the Firebase project. It must be gitignored and never committed or pasted anywhere.

## Auth

- Frontend signs in with the Firebase JS SDK and sends the Firebase ID token as `Authorization: Bearer <token>` on every API call.
- The backend verifies the token with `firebase_admin.auth.verify_id_token` in one shared decorator (or `before_request` hook) that puts the Firebase uid on Flask's `g` as `g.user_id`.
- Every route except health checks and `/api/skills` requires a valid token.

## Roles and permissions

PM/TL is per-project, not an account type: whoever creates a project is its PM/TL (`projects.pm_user_id`). The creator is also added as a project member, so they get tasks too, and can remove themselves. Everyone else on it is a dev.

- Any signed-in user: view directory, create/edit own profile, create projects, edit project details, add/remove project members, view and check off OWN tasks.
- PM/TL of a project: generate/edit/save tasks, view all tasks on the project, check off any task on the project.
- Enforce every permission in the API. Hiding a button in the UI is not a permission check.

## Data model (Firestore)

Firestore has no schema, so the API is the only thing enforcing these shapes. Validate every write in the backend. `id` below means the document ID.

| Collection | Fields | Notes |
| --- | --- | --- |
| users | id (Firebase uid), name, email, seniority (`newbie` / `oldie`), strengths, interests | strengths/interests = arrays of skill tags; seniority is used in assignment scoring (`backend/task_assignment.py`) |
| projects | id (auto), name, description, pm_user_id → users id, created_at | |
| project_members | project_id, user_id | one doc per membership, id `{project_id}:{user_id}`; the PM/TL is a member too |
| projects/{id}/tasks | id (the slug Gemini returns, e.g. `setup-firebase`), title, description, dependencies, suggested_skills, estimated_difficulty (`easy`/`medium`/`hard`), capacity (1 or 2), status (`todo`/`done`), assignee_ids, completed_at (timestamp or null) | subcollection under its project; dependencies = array of sibling task ids; suggested_skills = array of skill tags; assignee_ids = array of uids |

Why this shape (full reasoning in the team proposal doc):
- Tasks are a subcollection because Gemini's task ids are only unique within one graph. The slug is the document id, so `dependencies` point straight at sibling tasks.
- Assignments live on the task (`assignee_ids`), never on the user. A user can be on several projects, and a capacity-2 task holds two people. Code that needs a user's current task derives it from the task docs.
- Drafts are never stored. Generating returns a draft; saving writes every task as `todo`.
- `GET /api/me/tasks` is a collection-group query on `tasks` where `assignee_ids` contains the caller. It needs a one-time Firestore index; the first error message links to it.

Skill tags are one fixed shared list used by both profiles and tasks: `SKILL_TAGS` in `backend/skills.py`. Import it; never hardcode tags elsewhere. The current values are placeholders until the team agrees on the final list.

## API

All routes are served under the `/api` prefix (e.g. `/api/me`), matching the existing scaffold.

| Method | Path | Allowed | Purpose |
| --- | --- | --- | --- |
| GET / PUT | /me | signed in | read or create/update own profile |
| GET | /users | signed in | member directory |
| GET | /skills | anyone (no token) | the shared skill tag list |
| PUT | /users/:id | PM/TL sharing a project with that user (P1) | edit a dev's profile |
| POST | /projects | signed in | create project; caller becomes PM/TL |
| GET | /projects/:id | signed in | project, team, tasks, edges |
| PUT | /projects/:id | signed in | edit name/description |
| POST / DELETE | /projects/:id/members | signed in | add/remove a dev |
| POST | /projects/:id/generate | PM/TL | return LLM draft; saves NOTHING |
| PUT | /projects/:id/tasks | PM/TL | save whole graph, validate, run assignment |
| GET | /me/tasks | signed in | tasks assigned to me |
| POST | /projects/:id/tasks/:taskId/complete | assignee or PM/TL | mark done, run assignment (under the project because task ids are only unique per project) |

Return JSON errors with a clear message and correct status codes (400 validation, 401 no/invalid token, 403 not allowed, 404 not found).

### Profile endpoint shapes

Every error is `{"error": "<message>"}`. All routes except `/skills` need `Authorization: Bearer <Firebase ID token>`, or they return 401.

A **profile** is:

```json
{
  "id": "firebase-uid",
  "name": "Alice Chen",
  "email": "alice@gmail.com",
  "seniority": "newbie",
  "strengths": ["backend", "database"],
  "interests": ["devops"]
}
```

- `GET /api/me`: 200 with my profile, or 404 if I haven't created one yet. The frontend uses the 404 to send new users to profile creation.
- `PUT /api/me`: body is `{name, seniority, strengths, interests}`, all required; it replaces the whole profile. 201 on first save, 200 after; both return the saved profile. 400 if validation fails (`validate_profile` in `backend/profiles.py`). `id` and `email` come from the token and are ignored if sent.
- `GET /api/users`: 200 with an array of profiles sorted by name. Each also has `"projects": [{"id", "name"}]` for the directory cards; it's `[]` until projects exist.
- `GET /api/skills`: 200 with the `SKILL_TAGS` array. The frontend reads tag options from here instead of hardcoding them.

## Task generation (LLM)

- Implemented in `backend/dependency_graph.py` (`generate_dependency_graph`), using Gemini structured output. The `Task` model there is the source of truth for task fields. A draft looks like:

```json
{
  "tasks": [
    {
      "id": "setup-firebase",
      "title": "Set up Firebase",
      "description": "Create the Firebase project and connect the backend",
      "dependencies": [],
      "suggested_skills": ["backend", "firebase"],
      "estimated_difficulty": "medium",
      "capacity": null
    }
  ]
}
```

- Validate before returning the draft (and again on save): every task has an id and title, skills come from `SKILL_TAGS`, every dependency id exists, and there are no cycles. On failure the generator retries, then raises an error the UI can show.
- The draft is only shown to the PM/TL for review. Nothing is saved or assigned until `PUT /projects/:id/tasks`.

## Assignment

Runs after the graph is saved and after every check-off. Implemented as a pure function, `assign_tasks` in `backend/task_assignment.py`, which uses the OR-Tools CP-SAT solver.

- A task is **ready** if it isn't done, isn't already taken, and every task it depends on is done.
- Each person holds **one open task at a time**. Only idle members of the project are assigned.
- A task holds up to `capacity` people: 1 by default, 2 for hard tasks unless set.
- The solver first assigns as many idle people as capacity allows, then maximizes fit: strength and interest matches, seniority vs. difficulty, how much downstream work a task unlocks, and a bonus for pairing an oldie with a newbie on a capacity-2 task.
- Weights are named constants at the top of `task_assignment.py`; tune them there.
- `assign_tasks` takes users with a `current_task` field. Routes build that from the task docs' `assignee_ids` before calling it; don't store `current_task` on user docs.

## Working rules for Claude Code

- Work on the specific part I name; keep changes small and focused.
- Explain what you changed and why after each change. I need to understand and be able to explain all the code.
- Ask before adding a new dependency or changing the schema or API contract above.
- Never commit secrets. Use `.env` files and the service account JSON, both gitignored.
- Don't hand-edit Firestore data in the console. Seed or fix data with a script checked into `backend/`.
- Out of scope unless I ask: GitHub sync, Notion embeds, weekly availability, automatic team formation.
