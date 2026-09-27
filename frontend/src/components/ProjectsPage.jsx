import { useEffect, useState } from "react";
import {
  addProjectMember,
  createProject,
  getProject,
  getProjects,
  getUsers,
  removeProjectMember,
  updateProject,
} from "../api.js";
import { Avatar } from "./MemberCard.jsx";

const sortProjects = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name));

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [memberUserId, setMemberUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getProjects(), getUsers()])
      .then(([projectList, userList]) => {
        if (!active) return;
        const sorted = sortProjects(projectList);
        setProjects(sorted);
        setUsers(userList);
        setSelectedId(sorted[0]?.id ?? null);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedProject = projects.find((project) => project.id === selectedId);
  const availableUsers = selectedProject
    ? users.filter((user) => !selectedProject.members.some((member) => member.id === user.id))
    : [];

  function replaceProject(updated) {
    setProjects((current) => sortProjects(current.map((project) => (
      project.id === updated.id ? updated : project
    ))));
  }

  function startCreate() {
    setCreating(true);
    setEditing(false);
    setForm({ name: "", description: "" });
    setError("");
    setNotice("");
  }

  function startEdit() {
    setCreating(false);
    setEditing(true);
    setForm({ name: selectedProject.name, description: selectedProject.description ?? "" });
    setError("");
    setNotice("");
  }

  function cancelForm() {
    setCreating(false);
    setEditing(false);
    setError("");
  }

  async function handleCreate(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await createProject({
        name: form.name.trim(),
        description: form.description.trim(),
      });
      setProjects((current) => sortProjects([...current, created]));
      setSelectedId(created.id);
      setCreating(false);
      setNotice("Project created.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await updateProject(selectedProject.id, {
        name: form.name.trim(),
        description: form.description.trim(),
      });
      replaceProject(updated);
      setEditing(false);
      setNotice("Project details saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshProject(projectId) {
    const updated = await getProject(projectId);
    replaceProject(updated);
  }

  async function handleAddMember(event) {
    event.preventDefault();
    if (!memberUserId) return;
    const userId = memberUserId;
    setBusyMemberId(userId);
    setError("");
    setNotice("");
    try {
      await addProjectMember(selectedProject.id, userId);
      await refreshProject(selectedProject.id);
      setMemberUserId("");
      setNotice("Member added.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMemberId("");
    }
  }

  async function handleRemoveMember(member) {
    if (!window.confirm(`Remove ${member.name} from ${selectedProject.name}?`)) return;
    setBusyMemberId(member.id);
    setError("");
    setNotice("");
    try {
      await removeProjectMember(selectedProject.id, member.id);
      await refreshProject(selectedProject.id);
      setNotice(`${member.name} removed from the project.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMemberId("");
    }
  }

  const creator = selectedProject
    ? users.find((user) => user.id === selectedProject.pm_user_id)
    : null;

  return (
    <div className="projects-page">
      <header className="projects-heading">
        <div>
          <h1>Projects</h1>
          <p className="muted">Project details and team membership</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={startCreate}>
          Create project
        </button>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="project-notice" role="status">{notice}</p>}

      <div className="projects-layout">
        <aside className="project-index" aria-label="Project list">
          <h2>All projects <span>{projects.length}</span></h2>
          {loading ? (
            <p className="muted">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="muted">No projects yet.</p>
          ) : (
            <ul className="project-index-list">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    className={`project-select${project.id === selectedId ? " selected" : ""}`}
                    aria-current={project.id === selectedId ? "true" : undefined}
                    onClick={() => {
                      setSelectedId(project.id);
                      setCreating(false);
                      setEditing(false);
                      setError("");
                      setNotice("");
                    }}
                  >
                    <span className="project-select-name">{project.name}</span>
                    <span className="project-select-meta">
                      {project.members.length} {project.members.length === 1 ? "member" : "members"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="project-detail" aria-live="polite">
          {creating ? (
            <form className="project-form" onSubmit={handleCreate}>
              <header>
                <h2>New project</h2>
                <p className="muted">Set up a project, then invite its members.</p>
              </header>
              <label className="field">
                <span className="label">Project name</span>
                <input
                  autoFocus
                  maxLength={120}
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="label">Description</span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
              <div className="actions">
                <button className="btn btn-ghost" type="button" onClick={cancelForm} disabled={busy}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={busy || !form.name.trim()}>
                  {busy ? "Creating…" : "Create project"}
                </button>
              </div>
            </form>
          ) : editing && selectedProject ? (
            <form className="project-form" onSubmit={handleSave}>
              <header>
                <h2>Edit project</h2>
                <p className="muted">Changes are shared with everyone on the project.</p>
              </header>
              <label className="field">
                <span className="label">Project name</span>
                <input
                  autoFocus
                  maxLength={120}
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="label">Description</span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
              <div className="actions">
                <button className="btn btn-ghost" type="button" onClick={cancelForm} disabled={busy}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={busy || !form.name.trim()}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          ) : selectedProject ? (
            <>
              <section className="project-summary">
                <div className="project-title-row">
                  <div>
                    <p className="project-kicker">Project</p>
                    <h2>{selectedProject.name}</h2>
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={startEdit}>
                    Edit details
                  </button>
                </div>
                <p className="project-description">
                  {selectedProject.description || <span className="muted">No description yet.</span>}
                </p>
                <div className="project-facts">
                  <span>PM/TL: {creator?.name ?? "Profile unavailable"}</span>
                  <span>{selectedProject.members.length} {selectedProject.members.length === 1 ? "member" : "members"}</span>
                </div>
              </section>

              <section className="project-team">
                <div className="team-heading">
                  <div>
                    <h3>Team</h3>
                    <p className="muted">Manage who belongs to this project.</p>
                  </div>
                </div>
                <form className="member-add-form" onSubmit={handleAddMember}>
                  <label className="field">
                    <span className="label">Add a member</span>
                    <select
                      value={memberUserId}
                      onChange={(event) => setMemberUserId(event.target.value)}
                      disabled={availableUsers.length === 0 || Boolean(busyMemberId)}
                    >
                      <option value="">
                        {availableUsers.length ? "Choose a person" : "Everyone is already on this project"}
                      </option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={!memberUserId || Boolean(busyMemberId)}
                  >
                    {busyMemberId ? "Updating…" : "Add member"}
                  </button>
                </form>

                {selectedProject.members.length === 0 ? (
                  <p className="muted team-empty">No members on this project.</p>
                ) : (
                  <ul className="project-member-list">
                    {selectedProject.members.map((member) => (
                      <li key={member.id} className="project-member-row">
                        <Avatar name={member.name} />
                        <div className="project-member-info">
                          <strong>{member.name}</strong>
                          <span className="muted">{member.email}</span>
                        </div>
                        {member.id === selectedProject.pm_user_id && <span className="role">PM/TL</span>}
                        <button
                          className="btn btn-remove"
                          type="button"
                          disabled={busyMemberId === member.id}
                          onClick={() => handleRemoveMember(member)}
                          aria-label={`Remove ${member.name}`}
                        >
                          {busyMemberId === member.id ? "Removing…" : "Remove"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : loading ? (
            <p className="muted">Loading projects…</p>
          ) : (
            <div className="projects-empty">
              <h2>Start a project</h2>
              <p className="muted">Create a project to organize its details and team.</p>
              <button className="btn btn-primary" type="button" onClick={startCreate}>
                Create project
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}