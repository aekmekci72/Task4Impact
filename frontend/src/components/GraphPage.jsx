import { useEffect, useState } from "react";
import { generateTasks, getProject, getProjects, saveTasks } from "../api.js";
import DependencyGraphView from "./DependencyGraphView";

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
        {task.status === "done" ? (
          <span className="graph-badge">done</span>
        ) : (
          <DifficultyBadge level={task.estimated_difficulty} />
        )}
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

function AssignmentRow({ name, taskLabel }) {
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

// Generate a draft graph for a project, review it, then save it. Saving runs assignment,
// so the assignments column reflects the saved project, not the draft.
export default function GraphPage() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState(null); // saved project, with tasks and members
  const [draft, setDraft] = useState(null); // generated graph that hasn't been saved
  const [loading, setLoading] = useState(null); // "generate" | "save" | null
  const [error, setError] = useState(null);

  useEffect(() => {
    getProjects()
      .then((list) => {
        setProjects(list);
        if (list.length) setProjectId((current) => current || list[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    getProject(projectId)
      .then(setProject)
      .catch((e) => setError(e.message));
  }, [projectId]);

  function handleProjectChange(id) {
    setDraft(null);
    setProject(null);
    setError(null);
    setProjectId(id);
  }

  async function handleGenerate() {
    setLoading("generate");
    setError(null);
    try {
      setDraft(await generateTasks(projectId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleSave() {
    setLoading("save");
    setError(null);
    try {
      await saveTasks(projectId, draft.tasks);
      setProject(await getProject(projectId));
      setDraft(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  const tasks = draft?.tasks ?? project?.tasks ?? [];
  const names = Object.fromEntries((project?.members ?? []).map((m) => [m.id, m.name]));
  const assignments = (project?.tasks ?? [])
    .filter((t) => t.status === "todo")
    .flatMap((t) => t.assignee_ids.map((uid) => ({ uid, task: t })));

  return (
    <div className="graph-page">
      <header className="graph-page-header">
        <div>
          <h1>Dependency Graph &amp; Task Assignment</h1>
          <p className="muted">
            Generate a task graph from a project&rsquo;s description, review it, then save it to
            assign tasks to the team.
          </p>
        </div>
        <div className="graph-actions">
          <button
            className="btn btn-ghost"
            onClick={handleGenerate}
            disabled={!projectId || loading !== null}
            id="btn-generate-graph"
          >
            {loading === "generate" ? (
              <><span className="spinner" /> Generating… (can take ~30s)</>
            ) : (
              "Generate graph"
            )}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!draft || loading !== null}
            id="btn-save-graph"
          >
            {loading === "save" ? (
              <><span className="spinner" /> Saving…</>
            ) : (
              "Save & assign"
            )}
          </button>
        </div>
      </header>

      <label className="field" style={{ marginBottom: "1.5rem", maxWidth: 360 }}>
        <span className="label">Project</span>
        <select value={projectId} onChange={(e) => handleProjectChange(e.target.value)}>
          {projects.length === 0 && <option value="">No projects yet</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="error card" role="alert" style={{ marginBottom: "1.5rem" }}>
          {error}
        </p>
      )}

      <div className="graph-columns">
        {/* ── Graph column ── */}
        <section className="graph-col">
          <h2 className="graph-col-title">
            {draft ? "Draft (not saved)" : "Task Graph"}
            {tasks.length > 0 && <span className="graph-count">{tasks.length} tasks</span>}
          </h2>
          {draft && (
            <p className="muted">
              Review the draft, then &ldquo;Save &amp; assign&rdquo;. Tasks that keep the same id
              keep their progress.
            </p>
          )}
          {tasks.length === 0 ? (
            <p className="muted empty">
              No tasks yet. Hit &ldquo;Generate graph&rdquo; to draft them from the description.
            </p>
          ) : (
            graph.tasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </section>

        {/* ── Assignments column ── */}
        <section className="graph-col">
          <h2 className="graph-col-title">
            Current assignments
            {assignments.length > 0 && (
              <span className="graph-count">{assignments.length} assigned</span>
            )}
          </h2>
          {assignments.length === 0 ? (
            <p className="muted empty">
              No one is working on anything yet. Save a graph to assign the ready tasks.
            </p>
          ) : (
            <div className="card graph-assignments-card">
              {assignments.map(({ uid, task }) => (
                <AssignmentRow key={`${uid}-${task.id}`} name={names[uid] ?? uid} taskLabel={task.title} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}