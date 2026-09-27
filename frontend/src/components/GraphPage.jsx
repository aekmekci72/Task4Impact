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

const DIFFICULTY_CLASS = {
  easy: "diff-easy",
  medium: "diff-medium",
  hard: "diff-hard",
};

function DifficultyBadge({ level }) {
  return (
    <span className={`graph-badge graph-badge-diff ${DIFFICULTY_CLASS[level] ?? ""}`}>
      {level}
    </span>
  );
}

function SkillBadge({ skill }) {
  return <span className="graph-badge graph-badge-skill">{skill}</span>;
}

function TaskCard({ task }) {
  return (
    <article className="card card-compact graph-task-card">
      <div className="graph-task-header">
        <span className="graph-task-title">{task.title}</span>
        <DifficultyBadge level={task.estimated_difficulty} />
      </div>
      <p className="graph-task-desc">{task.description}</p>
      <div className="graph-task-meta">
        {task.suggested_skills?.map((s) => (
          <SkillBadge key={s} skill={s} />
        ))}
        {task.dependencies?.length > 0 && (
          <span className="graph-badge graph-badge-dep">
            after: {task.dependencies.join(", ")}
          </span>
        )}
        {task.capacity && task.capacity > 1 && (
          <span className="graph-badge graph-badge-cap">×{task.capacity} people</span>
        )}
      </div>
    </article>
  );
}

function AssignmentRow({ userId, taskId, taskLabel }) {
  const name = DUMMY_USER_NAMES[userId] || userId;
  return (
    <div className="graph-assignment-row">
      <div className="graph-assignment-user">
        <span className="graph-avatar">{name[0]}</span>
        <span className="graph-assignment-name">{name}</span>
      </div>
      <div className="graph-assignment-arrow">→</div>
      <div className="graph-assignment-task">{taskLabel}</div>
    </div>
  );
}

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
