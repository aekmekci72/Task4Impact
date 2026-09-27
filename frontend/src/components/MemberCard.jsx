import { tagLabel } from "../tags.js";

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function Avatar({ name, large }) {
  return (
    <div className={`avatar${large ? " avatar-lg" : ""}`} aria-hidden="true">
      {initials(name || "?")}
    </div>
  );
}

export function TagList({ tags, variant }) {
  if (!tags?.length) return <span className="muted">None listed</span>;
  return (
    <ul className="chips">
      {tags.map((tag) => (
        <li key={tag} className={`chip ${variant}`}>
          {tagLabel(tag)}
        </li>
      ))}
    </ul>
  );
}

export default function MemberCard({ member, isMe, isPm }) {
  return (
    <article className={`card card-compact${isMe ? " card-me" : ""}`}>
      <header className="card-head">
        <Avatar name={member.name} />
        <div>
          <h3>
            {member.name}
            {isMe && <span className="you">You</span>}
          </h3>
          {isPm && <span className="role">PM/TL</span>}
        </div>
      </header>
      <TagList tags={member.strengths} variant="chip-strength" />
    </article>
  );
}
