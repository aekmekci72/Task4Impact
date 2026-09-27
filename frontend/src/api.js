// Auth + API client. Every request carries the Firebase ID token (PRD R1).
//
// Endpoints and fields follow the API and data model in CLAUDE.md (all under /api):
//   GET  /me           -> own profile { id, name, email, strengths, interests, created_at },
//                         or 404 if the user has not created one yet
//   PUT  /me           -> body { name, strengths, interests }; returns the saved profile
//   GET  /users        -> [profile, ...]
//   GET  /me/tasks     -> tasks assigned to me:
//                         [{ id, project_id, title, description, suggested_skills,
//                            estimated_difficulty, dependencies,
//                            status: "draft" | "todo" | "done", assignee_id, completed_at }]
//   GET  /projects/:id -> CLAUDE.md says "project, team, tasks, edges" but doesn't fix the shape.
//                         Assumed until the route exists (edges = each task's dependencies):
//                         { id, name, description, pm_user_id, members: [profile, ...], tasks }
// Task field names follow backend/dependency_graph.py (Task).
//
// Skill tag values must match backend/skills.py (see tags.js).

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

// Real mode uses the Firebase `auth` from firebase.js (email/password sign-in). It's loaded
// lazily so mock mode never initializes Firebase.
function firebaseAuth({ auth }) {
  return {
    onUserChanged: (cb) =>
      onAuthStateChanged(auth, (u) => cb(u && { uid: u.uid, email: u.email, name: u.displayName })),
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signUp: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    signOut: () => firebaseSignOut(auth),
    getToken: () => auth.currentUser?.getIdToken() ?? null,
  };
}

const authModule = USE_MOCK ? import("./mock.js") : import("./firebase.js").then(firebaseAuth);

export const onUserChanged = (cb) => {
  let unsubscribe = () => {};
  let cancelled = false;
  authModule.then((m) => {
    if (!cancelled) unsubscribe = m.onUserChanged(cb);
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
};
export const signIn = (email, password) => authModule.then((m) => m.signIn(email, password));
export const signUp = (email, password) => authModule.then((m) => m.signUp(email, password));
export const signOut = () => authModule.then((m) => m.signOut());

async function request(method, path, body) {
  if (USE_MOCK) {
    const { mockRequest } = await authModule;
    return mockRequest(method, path, body);
  }

  const { getToken } = await authModule;
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).error ?? message;
    } catch {
      // non-JSON error body
    }
    throw Object.assign(new Error(message), { status: res.status });
  }
  return res.json();
}

export async function getMe() {
  try {
    return await request("GET", "/me");
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export const saveMe = (profile) => request("PUT", "/me", profile);
export const getUsers = () => request("GET", "/users");

export const getMyTasks = () => request("GET", "/me/tasks");
export const getProject = (id) => request("GET", `/projects/${id}`);

// There's no "which project am I on" endpoint yet, so use project_id from /me if the API adds
// it (asked Jonah), otherwise the project of the tasks assigned to me. Each member is on one
// project. Returns null if neither tells us a project.
export async function getMyProject(profile) {
  const tasks = await getMyTasks();
  const projectId = profile.project_id ?? tasks[0]?.project_id;
  if (!projectId) return null;
  const project = await getProject(projectId);
  return { ...project, myTasks: tasks.filter((t) => t.project_id === projectId) };
}
