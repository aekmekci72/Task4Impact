import { useState } from "react";

// Adjust for your setup (env var, proxy config, deployed URL, etc).
const API_BASE = "http://localhost:5001";

// TODO: wire this up to your real Firebase auth once David's auth work lands.
// Should return the current user's ID token, or null if not signed in.
async function getAuthToken() {
  return null;
}

async function apiPost(path) {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// Mirrors graph_routes.py's DUMMY_USERS just for name lookups in the UI —
// remove once /assign returns real user data instead of just ids.
const DUMMY_USER_NAMES = {
  u1: "David",
  u2: "Tiffany",
  u3: "Jonah",
  u4: "Anna",
};

const styles = {
  page: {
    fontFamily: "'Inter', system-ui, sans-serif",
    maxWidth: 760,
    margin: "0 auto",
    padding: "2.5rem 1.5rem",
    color: "#1c1c1c",
  },
  heading: {
    fontSize: "1.5rem",
    fontWeight: 600,
    marginBottom: "0.25rem",
  },
  subheading: {
    color: "#666",
    marginBottom: "1.75rem",
    fontSize: "0.95rem",
  },
  buttonRow: {
    display: "flex",
    gap: "0.75rem",
    marginBottom: "2rem",
  },
  button: {
    padding: "0.6rem 1.1rem",
    borderRadius: 6,
    border: "1px solid #1c1c1c",
    background: "#1c1c1c",
    color: "#fff",
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  error: {
    background: "#fdecea",
    color: "#8a1f11",
    padding: "0.75rem 1rem",
    borderRadius: 6,
    marginBottom: "1.5rem",
    fontSize: "0.9rem",
  },
  section: {
    marginBottom: "2rem",
  },
  sectionTitle: {
    fontSize: "1.05rem",
    fontWeight: 600,
    marginBottom: "0.75rem",
  },
  card: {
    border: "1px solid #e3e3e3",
    borderRadius: 8,
    padding: "0.9rem 1rem",
    marginBottom: "0.6rem",
  },
  taskTitle: {
    fontWeight: 600,
    marginBottom: "0.2rem",
  },
  taskDesc: {
    fontSize: "0.88rem",
    color: "#555",
    marginBottom: "0.5rem",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
    fontSize: "0.78rem",
  },
  tag: {
    background: "#f1f1f1",
    borderRadius: 4,
    padding: "0.15rem 0.5rem",
    color: "#444",
  },
  assignmentRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.6rem 0",
    borderBottom: "1px solid #eee",
    fontSize: "0.92rem",
  },
  empty: {
    color: "#888",
    fontSize: "0.9rem",
    fontStyle: "italic",
  },
};

export default function GraphPage() {
  const [graph, setGraph] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [loading, setLoading] = useState(null); // "generate" | "assign" | null
  const [error, setError] = useState(null);

  async function handleGenerate() {
    setLoading("generate");
    setError(null);
    try {
      const data = await apiPost("/api/graph/generate");
      setGraph(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleAssign() {
    setLoading("assign");
    setError(null);
    try {
      const data = await apiPost("/api/graph/assign");
      setAssignments(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  // Look up a task's title by id, falling back to the id itself if the
  // graph hasn't been generated in this session.
  function taskLabel(taskId) {
    const task = graph?.tasks?.find((t) => t.id === taskId);
    return task ? task.title : taskId;
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Dependency graph & task assignment</h1>
      <p style={styles.subheading}>
        Both buttons currently hit hardcoded dummy data on the backend — this
        page just exercises the two endpoints.
      </p>

      <div style={styles.buttonRow}>
        <button
          style={{
            ...styles.button,
            ...(loading === "generate" ? styles.buttonDisabled : {}),
          }}
          onClick={handleGenerate}
          disabled={loading !== null}
        >
          {loading === "generate" ? "Generating…" : "Generate graph"}
        </button>
        <button
          style={{
            ...styles.button,
            ...(loading === "assign" ? styles.buttonDisabled : {}),
          }}
          onClick={handleAssign}
          disabled={loading !== null}
        >
          {loading === "assign" ? "Assigning…" : "Assign tasks"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Graph</div>
        {!graph && <div style={styles.empty}>Not generated yet.</div>}
        {graph?.tasks?.map((task) => (
          <div key={task.id} style={styles.card}>
            <div style={styles.taskTitle}>{task.title}</div>
            <div style={styles.taskDesc}>{task.description}</div>
            <div style={styles.metaRow}>
              <span style={styles.tag}>{task.estimated_difficulty}</span>
              <span style={styles.tag}>capacity {task.capacity}</span>
              {task.suggested_skills?.map((s) => (
                <span key={s} style={styles.tag}>
                  {s}
                </span>
              ))}
              {task.dependencies?.length > 0 && (
                <span style={styles.tag}>
                  after: {task.dependencies.join(", ")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Assignments</div>
        {!assignments && <div style={styles.empty}>Not run yet.</div>}
        {assignments && Object.keys(assignments).length === 0 && (
          <div style={styles.empty}>No one was assigned (nothing unlocked, or no idle users).</div>
        )}
        {assignments &&
          Object.entries(assignments).map(([userId, taskId]) => (
            <div key={userId} style={styles.assignmentRow}>
              <span>{DUMMY_USER_NAMES[userId] || userId}</span>
              <span>{taskLabel(taskId)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
