import { useState } from "react";
import { getToken } from "../api.js";

const API_BASE = "http://localhost:5001";

async function getAuthToken() {
  return getToken();
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

// Mirrors graph_routes.py's DUMMY_USERS just for name lookups in the UI.
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

  function taskLabel(taskId) {
    const task = graph?.tasks?.find((t) => t.id === taskId);
    return task ? task.title : taskId;
  }

  const hasAssignments = assignments && Object.keys(assignments).length > 0;

  return (
    <div className="graph-page">
      <header className="graph-page-header">
        <div>
          <h1>Dependency Graph &amp; Task Assignment</h1>
          <p className="muted">
            Generate a task DAG from your project description, then auto-assign tasks to your team.
          </p>
        </div>
        <div className="graph-actions">
          <button
            className="btn btn-ghost"
            onClick={handleGenerate}
            disabled={loading !== null}
            id="btn-generate-graph"
          >
            {loading === "generate" ? (
              <><span className="spinner" /> Generating…</>
            ) : (
              "Generate graph"
            )}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAssign}
            disabled={loading !== null}
            id="btn-assign-tasks"
          >
            {loading === "assign" ? (
              <><span className="spinner" /> Assigning…</>
            ) : (
              "Assign tasks"
            )}
          </button>
        </div>
      </header>

      {error && (
        <p className="error card" role="alert" style={{ marginBottom: "1.5rem" }}>
          {error}
        </p>
      )}

      <div className="graph-columns">
        {/* ── Graph column ── */}
        <section className="graph-col">
          <h2 className="graph-col-title">
            Task Graph
            {graph?.tasks && (
              <span className="graph-count">{graph.tasks.length} tasks</span>
            )}
          </h2>
          {!graph ? (
            <p className="muted empty">Hit &ldquo;Generate graph&rdquo; to build the DAG.</p>
          ) : (
            graph.tasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </section>

        {/* ── Assignments column ── */}
        <section className="graph-col">
          <h2 className="graph-col-title">
            Assignments
            {hasAssignments && (
              <span className="graph-count">{Object.keys(assignments).length} assigned</span>
            )}
          </h2>
          {!assignments ? (
            <p className="muted empty">Hit &ldquo;Assign tasks&rdquo; to run the optimizer.</p>
          ) : !hasAssignments ? (
            <p className="muted empty">
              No one assigned — nothing unlocked yet, or no idle team members.
            </p>
          ) : (
            <div className="card graph-assignments-card">
              {Object.entries(assignments).map(([userId, taskId]) => (
                <AssignmentRow
                  key={userId}
                  userId={userId}
                  taskId={taskId}
                  taskLabel={taskLabel(taskId)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
