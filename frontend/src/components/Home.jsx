import { useCallback, useEffect, useState } from "react";
import { getMyProject } from "../api.js";
import Directory from "./Directory.jsx";
import ProfileCard from "./ProfileCard.jsx";
import ProjectCard from "./ProjectCard.jsx";
import Perf from "./pixel/Perf.jsx";
import PixelScene from "./pixel/PixelScene.jsx";
import PixelTrain, { Track } from "./pixel/PixelTrain.jsx";
import { SPRITES } from "./pixel/sprites.js";
import { Sprite } from "./pixel/Sprite.jsx";

// Decorative strip across the top of Home: a little village and a train on its track.
function HomeBanner() {
  return (
    <div className="home-banner" aria-hidden="true">
      <svg className="home-banner-village" viewBox="0 0 300 90" shapeRendering="crispEdges">
        <Sprite x={0} y={30} rects={SPRITES.pine()} />
        <Sprite x={44} y={20} rects={SPRITES.house("#f5c46b", "#c99a3e")} />
        <Sprite x={112} y={34} rects={SPRITES.tree()} />
        <Sprite x={156} y={16} rects={SPRITES.house("#129ea5", "#0b6e73")} />
        <Sprite x={224} y={30} rects={SPRITES.pine("#129ea5")} />
        <Sprite x={262} y={64} scale={4} rects={SPRITES.flowers()} />
      </svg>
      <Track />
      <div className="home-banner-train">
        <PixelTrain coach scale={2} faceRight={false} />
      </div>
    </div>
  );
}

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
      <div className="card">
        <PixelScene variant="blocked" />
        <Perf />
        <p className="error" role="alert">
          Couldn't load your project: {error}
        </p>
      </div>
    );
  } else if (project === undefined) {
    projectContent = (
      <div className="card">
        <PixelScene variant="loading" />
        <Perf />
        <p className="muted">Loading your project…</p>
      </div>
    );
  } else if (project === null) {
    projectContent = (
      <article className="card">
        <PixelScene variant="station" />
        <Perf />
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
      <HomeBanner />
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
