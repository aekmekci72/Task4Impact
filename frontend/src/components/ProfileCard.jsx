import { Avatar, TagList } from "./MemberCard.jsx";
import { seniorityLabel } from "../tags.js";
import Perf from "./pixel/Perf.jsx";

export default function ProfileCard({ profile }) {
  return (
    <article className="card">
      <header className="card-head">
        <Avatar name={profile.name} large />
        <div>
          <h3>{profile.name}</h3>
          {profile.seniority && <span className="muted">{seniorityLabel(profile.seniority)}</span>}
        </div>
      </header>
      <Perf />
      <section>
        <h4>Strengths</h4>
        <TagList tags={profile.strengths} variant="chip-strength" />
      </section>
      <section>
        <h4>Interests</h4>
        <TagList tags={profile.interests} variant="chip-interest" />
      </section>
    </article>
  );
}
