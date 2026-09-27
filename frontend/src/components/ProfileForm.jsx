import { useState } from "react";
import { saveMe } from "../api.js";
import TagPicker from "./TagPicker.jsx";

// Used for both first-time profile creation (R2) and editing your own profile (R3).
export default function ProfileForm({ initial, defaultName, onSaved, onCancel }) {
  const isNew = !initial;
  const [name, setName] = useState(initial?.name ?? defaultName ?? "");
  const [strengths, setStrengths] = useState(initial?.strengths ?? []);
  const [interests, setInterests] = useState(initial?.interests ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);

  const missing = [
    !name.trim() && "name",
    strengths.length === 0 && "at least one strength",
  ].filter(Boolean);

  async function handleSubmit(e) {
    e.preventDefault();
    setAttempted(true);
    if (missing.length) return;
    setSaving(true);
    setError("");
    try {
      onSaved(await saveMe({ name: name.trim(), strengths, interests }));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="panel profile-form" onSubmit={handleSubmit}>
      <header>
        <h2>{isNew ? "Create your profile" : "Edit your profile"}</h2>
        <p className="hint">
          {isNew
            ? "This is how you'll appear in the member directory and how tasks get matched to you."
            : "Changes show up in the directory right away."}
        </p>
      </header>

      <label className="field">
        <span className="label">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>

      <TagPicker
        label="Strengths"
        hint="What you're already good at. These weigh most when assigning tasks."
        value={strengths}
        onChange={setStrengths}
      />
      <TagPicker
        label="Interests"
        hint="What you'd like to get better at."
        value={interests}
        onChange={setInterests}
      />

      {attempted && missing.length > 0 ? (
        <p className="error" role="alert">Please add {missing.join(", ")}.</p>
      ) : (
        error && <p className="error" role="alert">{error}</p>
      )}

      <div className="actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : isNew ? "Create profile" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
