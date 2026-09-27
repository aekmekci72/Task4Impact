// Stand-in for Firebase + the API so the UI can be built before the backend is ready.
// Enabled with VITE_USE_MOCK=true. Everything lives in localStorage.

import { SENIORITY_LEVELS, SKILL_TAGS } from "./tags.js";

const USERS_KEY = "mock:users:v3";
const PROJECTS_KEY = "mock:projects:v4";
const SESSION_KEY = "mock:session";
const ME = "mock-me";

// Shapes follow the Firestore data model in CLAUDE.md, including snake_case field names.
const SEED_USERS = [
  { id: "seed-1", name: "Jonah Park", email: "jonah@example.com", strengths: ["backend", "database", "devops"], interests: ["data-ml"] },
  { id: "seed-2", name: "Priya Shah", email: "priya@example.com", strengths: ["frontend", "ui-design"], interests: ["auth"] },
  { id: "seed-3", name: "Marcus Lee", email: "marcus@example.com", strengths: ["data-ml", "backend"], interests: ["frontend"] },
  { id: "seed-4", name: "Ana Ruiz", email: "ana@example.com", strengths: ["frontend", "auth"], interests: ["ui-design"] },
  { id: "seed-5", name: "Dev Kumar", email: "dev@example.com", strengths: ["devops", "auth"], interests: ["backend"] },
  { id: "seed-6", name: "Lena Okafor", email: "lena@example.com", strengths: ["ui-design"], interests: ["data-ml"] },
];

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

// Each project carries its member ids and tasks here; the real API keeps them in the
// project_members and tasks collections. New mock profiles join p1 (see PUT /me).
const SEED_PROJECTS = [
  {
    id: "p1",
    name: "Food Bank Tracker",
    description: "Track donations and volunteer shifts for a local food bank.",
    pm_user_id: "seed-1",
    member_ids: ["seed-1", "seed-2", "seed-4", "seed-5"],
    tasks: [
      { id: "t1", title: "Set up React project", suggested_skills: ["frontend"], estimated_difficulty: "easy", dependencies: [], status: "done", assignee_id: ME, completed_at: daysAgo(9) },
      { id: "t2", title: "Draft volunteer flow wireframes", suggested_skills: ["ui-design"], estimated_difficulty: "medium", dependencies: [], status: "done", assignee_id: ME, completed_at: daysAgo(3) },
      { id: "t3", title: "Build volunteer sign-up form", suggested_skills: ["frontend", "auth"], estimated_difficulty: "medium", dependencies: [], status: "todo", assignee_id: ME, completed_at: null },
      { id: "t4", title: "Design inventory dashboard", suggested_skills: ["ui-design", "frontend"], estimated_difficulty: "hard", dependencies: [], status: "todo", assignee_id: ME, completed_at: null },
      { id: "t5", title: "Design donations schema", suggested_skills: ["database"], estimated_difficulty: "medium", dependencies: [], status: "todo", assignee_id: "seed-1", completed_at: null },
      { id: "t6", title: "Set up CI pipeline", suggested_skills: ["devops"], estimated_difficulty: "easy", dependencies: [], status: "done", assignee_id: "seed-5", completed_at: daysAgo(2) },
      { id: "t7", title: "Add shift reminders", suggested_skills: ["backend"], estimated_difficulty: "medium", dependencies: [], status: "draft", assignee_id: null, completed_at: null },
    ],
  },
  { id: "p2", name: "Shelter Finder", description: "", pm_user_id: "seed-3", member_ids: ["seed-3", "seed-6"], tasks: [] },
];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const listeners = new Set();

export function onUserChanged(callback) {
  listeners.add(callback);
  callback(load(SESSION_KEY, null));
  return () => listeners.delete(callback);
}

function setSession(user) {
  save(SESSION_KEY, user);
  listeners.forEach((cb) => cb(user));
}

// Any email and password work. Everyone signs in as the same mock user so the seed tasks show up.
export async function signIn(email) {
  setSession({ uid: ME, email: email || "you@example.com", name: "Demo User" });
}
export const signUp = signIn;

export async function signOut() {
  setSession(null);
}

export async function getToken() {
  return load(SESSION_KEY, null) ? "mock-token" : null;
}

const httpError = (status, message) => Object.assign(new Error(message), { status });

function projectResponse(project, users) {
  const { member_ids, tasks, ...rest } = project;
  return {
    ...rest,
    members: users.filter((user) => member_ids.includes(user.id)),
    tasks: (tasks ?? []).map((task) => ({ ...task, project_id: project.id })),
  };
}

export async function mockRequest(method, path, body) {
  const session = load(SESSION_KEY, null);
  if (!session) throw httpError(401, "Not signed in");
  const users = load(USERS_KEY, SEED_USERS);
  const projects = load(PROJECTS_KEY, SEED_PROJECTS);
  const me = users.find((u) => u.id === session.uid);
  const withProjectId = (task, project) => ({ ...task, project_id: project.id });

  if (path === "/users" && method === "GET") return users;
  if (path === "/projects" && method === "GET") {
    return projects
      .map((project) => projectResponse(project, users))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  if (path === "/projects" && method === "POST") {
    if (!body?.name?.trim()) throw httpError(400, "Project name is required");
    if (body.description != null && typeof body.description !== "string") {
      throw httpError(400, "Project description must be a string");
    }
    const project = {
      id: `mock-${Date.now()}`,
      name: body.name.trim(),
      description: body.description?.trim() ?? "",
      pm_user_id: session.uid,
      created_at: new Date().toISOString(),
      member_ids: [session.uid],
      tasks: [],
    };
    save(PROJECTS_KEY, [...projects, project]);
    return projectResponse(project, users);
  }

  const memberMatch = path.match(/^\/projects\/([^/]+)\/members$/);
  if (memberMatch && (method === "POST" || method === "DELETE")) {
    const project = projects.find((p) => p.id === memberMatch[1]);
    if (!project) throw httpError(404, "Project not found");
    const userId = body?.user_id;
    if (typeof userId !== "string" || !userId.trim()) {
      throw httpError(400, "A user_id is required");
    }
    if (method === "POST") {
      if (!users.some((user) => user.id === userId)) throw httpError(404, "User profile not found");
      if (!project.member_ids.includes(userId)) {
        project.member_ids = [...project.member_ids, userId];
        save(PROJECTS_KEY, projects);
      }
    } else {
      if (!project.member_ids.includes(userId)) throw httpError(404, "Project member not found");
      project.member_ids = project.member_ids.filter((id) => id !== userId);
      save(PROJECTS_KEY, projects);
    }
    return { project_id: project.id, user_id: userId };
  }

  if (path === "/me") {
    if (method === "GET") {
      if (!me) throw httpError(404, "No profile");
      return me;
    }
    if (method === "PUT") {
      // Same checks as validate_profile in backend/profiles.py, so tag mismatches show up here too.
      const unknown = [...(body.strengths ?? []), ...(body.interests ?? [])].filter(
        (t) => !SKILL_TAGS.includes(t),
      );
      if (!body.name?.trim()) throw httpError(400, "Name is required");
      if (!SENIORITY_LEVELS.includes(body.seniority)) throw httpError(400, "Seniority must be newbie or oldie");
      if (unknown.length) throw httpError(400, `Unknown tags: ${unknown.join(", ")}`);
      if (!body.strengths?.length) throw httpError(400, "Pick at least one strength");

      const updated = {
        created_at: new Date().toISOString(),
        ...me,
        name: body.name.trim(),
        seniority: body.seniority,
        strengths: body.strengths,
        interests: body.interests ?? [],
        id: session.uid,
        email: session.email,
      };
      save(USERS_KEY, me ? users.map((u) => (u.id === me.id ? updated : u)) : [...users, updated]);
      if (!me) {
        save(
          PROJECTS_KEY,
          projects.map((p) => (p.id === "p1" ? { ...p, member_ids: [...p.member_ids, session.uid] } : p)),
        );
      }
      return updated;
    }
  }

  if (path === "/me/tasks" && method === "GET") {
    return projects.flatMap((p) =>
      p.tasks.filter((t) => t.assignee_id === session.uid).map((t) => withProjectId(t, p)),
    );
  }

  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectIndex = projects.findIndex((p) => p.id === projectMatch[1]);
    const project = projects[projectIndex];
    if (!project) throw httpError(404, "Project not found");
    if (method === "GET") return projectResponse(project, users);
    if (method === "PUT") {
      if (!body || !Object.keys(body).length || Object.keys(body).some((key) => !["name", "description"].includes(key))) {
        throw httpError(400, "Only name and description can be updated");
      }
      if ("name" in body && !body.name?.trim()) throw httpError(400, "Project name cannot be empty");
      if ("description" in body && typeof body.description !== "string") {
        throw httpError(400, "Project description must be a string");
      }
      const updated = {
        ...project,
        ...body,
        ...(body.name && { name: body.name.trim() }),
        ...(body.description != null && { description: body.description.trim() }),
      };
      projects[projectIndex] = updated;
      save(PROJECTS_KEY, projects);
      return projectResponse(updated, users);
    }
  }

  throw httpError(404, `Mock has no route for ${method} ${path}`);
}
