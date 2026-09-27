import { useState } from "react";
import { tagLabel } from "../tags.js";

function TaskRow({ task }) {
  const done = task.status === "done";
  return (
    <li className={`task${done ? " task-done" : ""}`}>
      <span className="task-check" aria-hidden="true">
        {done ? "✓" : ""}
      </span>
      <div className="task-body">
        <span className="task-title">{task.title}</span>
        {task.suggested_skills?.map((tag) => (
          <span key={tag} className="chip chip-strength">
            {tagLabel(tag)}
          </span>
        ))}
      </div>
      {!done && task.estimated_difficulty && (
        <span className={`difficulty difficulty-${task.estimated_difficulty}`}>
          {task.estimated_difficulty}
        </span>
      )}
    </li>
  );
}

// project.myTasks = my tasks on this project (from GET /me/tasks). Draft tasks haven't been
// saved by the PM/TL yet, so they're left out.
export default function ProjectCard({ project, meId }) {
  const [showCompleted, setShowCompleted] = useState(false);

  const upcoming = project.myTasks.filter((t) => t.status === "todo");
  const completed = project.myTasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const total = upcoming.length + completed.length;
  const percent = total ? Math.round((completed.length / total) * 100) : 0;
  const myRole = project.pm_user_id === meId ? "PM/TL" : "dev";

  return (
    <article className="card">
      <header className="project-head">
        <h3>{project.name}</h3>
        <span className="muted">You're a {myRole}</span>
      </header>

      <div>
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Your tasks completed"
        >
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="hint">
          {completed.length} of {total} of your tasks done
        </p>
      </div>

      <section>
        <h4>Upcoming · {upcoming.length}</h4>
        {upcoming.length === 0 ? (
          <p className="muted">You're all caught up.</p>
        ) : (
          <ul className="tasks">
            {upcoming.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        )}
      </section>

      {completed.length > 0 && (
        <section>
          <button
            className="section-toggle"
            onClick={() => setShowCompleted((v) => !v)}
            aria-expanded={showCompleted}
          >
            Completed · {completed.length}
            <span className={`chevron${showCompleted ? " open" : ""}`} aria-hidden="true" />
          </button>
          {showCompleted && (
            <ul className="tasks">
              {completed.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
