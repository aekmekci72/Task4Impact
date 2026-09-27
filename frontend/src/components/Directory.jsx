import { useMemo, useState } from "react";
import { SKILL_TAGS, tagLabel } from "../tags.js";
import MemberCard from "./MemberCard.jsx";
import Perf from "./pixel/Perf.jsx";
import PixelScene from "./pixel/PixelScene.jsx";

export default function Directory({ members, meId, pmId, projectName }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .filter((m) => !tag || m.strengths?.includes(tag) || m.interests?.includes(tag))
      // Pin the signed-in member first so they can find their own card.
      .sort((a, b) => (b.id === meId) - (a.id === meId) || a.name.localeCompare(b.name));
  }, [members, query, tag, meId]);

  return (
    <section>
      <div className="directory-head ticket">
        <div>
          <h2>Your team</h2>
          <p className="muted">
            {members.length} {members.length === 1 ? "person" : "people"} on {projectName}
          </p>
        </div>
        <div className="filters">
          <input
            type="search"
            placeholder="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search members by name"
          />
          <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by skill">
            <option value="">All skills</option>
            {SKILL_TAGS.map((t) => (
              <option key={t} value={t}>
                {tagLabel(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card directory-empty">
          <PixelScene variant="platform" />
          <Perf />
          <p className="muted">No members match those filters.</p>
        </div>
      ) : (
        <div className="grid">
          {visible.map((m) => (
            <MemberCard key={m.id} member={m} isMe={m.id === meId} isPm={m.id === pmId} />
          ))}
        </div>
      )}
    </section>
  );
}
