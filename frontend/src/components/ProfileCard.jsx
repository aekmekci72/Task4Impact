import { Avatar, TagList } from "./MemberCard.jsx";

export default function ProfileCard({ profile }) {
  return (
    <article className="card">
      <header className="card-head">
        <Avatar name={profile.name} large />
        <h3>{profile.name}</h3>
      </header>
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
