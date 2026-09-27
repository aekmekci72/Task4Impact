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
- Backend dev: `cd backend && .venv/bin/python app.py` (serves on port 5000). Needs `firebase-service-account.json` in `backend/`.
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

PM/TL is per-project, not an account type: whoever creates a project is its PM/TL (`projects.pm_user_id`). Everyone else on it is a dev.

- Any signed-in user: view directory, create/edit own profile, create a project, view and check off OWN tasks.
- PM/TL of a project: edit project, add/remove devs, generate/edit/save tasks, view all tasks on the project, check off any task on the project.
- Enforce every permission in the API. Hiding a button in the UI is not a permission check.

## Data model (Firestore)

Firestore has no schema, so the API is the only thing enforcing these shapes. Validate every write in the backend. `id` below means the document ID.

| Collection | Fields | Notes |
| --- | --- | --- |
| users | id (Firebase uid), name, email, seniority (`newbie` / `oldie`), strengths, interests | strengths/interests = arrays of skill tags; seniority is used in assignment scoring (`backend/task_assignment.py`) |
| projects | id, name, description, pm_user_id → users id, created_at | |
| project_members | project_id, user_id | one doc per membership |
| tasks | id, project_id, title, description, tags, difficulty (`easy`/`medium`/`hard`), status (`draft`/`todo`/`done`), assignee_id (nullable), completed_at | tags = array |
| task_deps | task_id, depends_on_id | one doc per edge |

`project_members` and `task_deps` are carried over from the relational design and haven't been re-decided for Firestore. Storing them as arrays on the parent doc is an option. Ask before changing it.

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
| GET | /projects/:id | project members + PM/TL | project, team, tasks, edges |
| PUT | /projects/:id | PM/TL | edit name/description |
| POST / DELETE | /projects/:id/members | PM/TL | add/remove a dev |
| POST | /projects/:id/generate | PM/TL | return LLM draft; saves NOTHING |
| PUT | /projects/:id/tasks | PM/TL | save whole graph, validate, run assignment |
| GET | /me/tasks | signed in | tasks assigned to me |
| POST | /tasks/:id/complete | assignee or PM/TL | mark done, run assignment |

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

- Send project name, description, and the skill tag list. Require JSON only, shaped like:

```json
{
  "tasks": [
    {
      "id": "t1",
      "title": "Set up D1 schema",
      "description": "Create users, projects, tasks tables",
      "tags": ["backend", "database"],
      "difficulty": "medium",
      "depends_on": []
    }
  ]
}
```

- Validate before returning the draft (and again on save):
  1. Parses; every task has id, title, tags from the allowed list.
  2. Every `depends_on` id exists.
  3. No cycles, checked with Kahn's algorithm (leftover nodes = cycle).
  4. 3–25 tasks.
- On failure retry once, then return an error the UI can show.
- The draft is only shown to the PM/TL for review. Nothing is saved or assigned until `PUT /projects/:id/tasks`.

## Assignment

Runs after the graph is saved and after every check-off. Put it in one pure function that is easy to unit test.

- A task is **ready** if status is `todo`, it has no assignee, and every task it depends on is `done`.
- Order ready tasks by number of downstream tasks (most first).
- For each task, score every dev on the project and pick the highest; ties go to fewer open tasks:
  `score = 2*|strengths ∩ tags| + 1*|interests ∩ tags| − 1.5*openTasks`
- A dev holds at most 2 open tasks per project. If no dev has room, the task waits.
- Weights are starting values; keep them as named constants.

## Working rules for Claude Code

- Work on the specific part I name; keep changes small and focused.
- Explain what you changed and why after each change. I need to understand and be able to explain all the code.
- Ask before adding a new dependency or changing the schema or API contract above.
- Never commit secrets. Use `.env` files and the service account JSON, both gitignored.
- Don't hand-edit Firestore data in the console. Seed or fix data with a script checked into `backend/`.
- Out of scope unless I ask: GitHub sync, Notion embeds, weekly availability, automatic team formation.
