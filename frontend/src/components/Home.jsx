import { useCallback, useEffect, useState } from "react";
import { getMyProject } from "../api.js";
import Directory from "./Directory.jsx";
import ProfileCard from "./ProfileCard.jsx";
import ProjectCard from "./ProjectCard.jsx";

export default function Home({ profile }) {
  const [project, setProject] = useState(undefined); // null = not on a project
  const [error, setError] = useState("");

  const loadProject = useCallback(
    () =>
      getMyProject(profile)
        .then(setProject)
        .catch((err) => setError(err.message)),
    [profile],
  );

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  let projectContent;
  if (error) {
    projectContent = (
      <p className="error card" role="alert">
        Couldn't load your project: {error}
      </p>
    );
  } else if (project === undefined) {
    projectContent = <p className="muted card">Loading your project…</p>;
  } else if (project === null) {
    projectContent = (
      <article className="card">
        <h3>No project yet</h3>
        <p className="muted">
          You haven't been assigned to a project. Your tasks and team will show up here once you are.
        </p>
      </article>
    );
  } else {
    projectContent = <ProjectCard project={project} meId={profile.id} onChange={loadProject} />;
  }

  return (
    <div className="home">
      <div className="home-top">
        <ProfileCard profile={profile} />
        {projectContent}
      </div>
      {project && (
        <Directory
          members={project.members}
          meId={profile.id}
          pmId={project.pm_user_id}
          projectName={project.name}
        />
      )}
    </div>
  );
}
