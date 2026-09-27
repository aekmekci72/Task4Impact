import { SKILL_TAGS, tagLabel } from "../tags.js";

export default function TagPicker({ label, hint, value, onChange }) {
  const toggle = (tag) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);

  return (
    <fieldset className="field">
      <legend>{label}</legend>
      {hint && <p className="hint">{hint}</p>}
      <div className="tag-picker">
        {SKILL_TAGS.map((tag) => (
          <button
            type="button"
            key={tag}
            className={`chip chip-toggle${value.includes(tag) ? " selected" : ""}`}
            aria-pressed={value.includes(tag)}
            onClick={() => toggle(tag)}
          >
            {tagLabel(tag)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
