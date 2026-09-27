import { useEffect, useState } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { getMe, onUserChanged, signIn, signOut, signUp } from "./api.js";
import Home from "./components/Home.jsx";
import ProfileForm from "./components/ProfileForm.jsx";
import GraphPage from "./components/GraphPage.jsx";
import ProjectsPage from "./components/ProjectsPage.jsx";
import MapBackground from "./components/pixel/MapBackground.jsx";
import Perf from "./components/pixel/Perf.jsx";
import PixelScene from "./components/pixel/PixelScene.jsx";
import PixelTrain from "./components/pixel/PixelTrain.jsx";
import StationScene from "./components/pixel/StationScene.jsx";
import "./App.css";

// Email/password sign-in and sign-up (Firebase Auth).
// While a request is in flight, the station train pulls out and a mini train crosses the
// button. On success this form unmounts (App switches views); on failure the train rolls back.
function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // "in" | "up" | null
  const [stamped, setStamped] = useState(false);
  const [trainPhase, setTrainPhase] = useState("idle"); // "idle" | "departing" | "arriving"

  // After a failed attempt the train rolls back in, then waits at the platform again.
  useEffect(() => {
    if (trainPhase !== "arriving") return;
    const timer = setTimeout(() => setTrainPhase("idle"), 2200);
    return () => clearTimeout(timer);
  }, [trainPhase]);

  function submit(action, kind) {
    setError("");
    setPending(kind);
    setStamped(true);
    setTrainPhase("departing");
    action(email, password).catch((err) => {
      setError(err.message);
      setPending(null);
      setTrainPhase("arriving");
    });
  }

  const handleSignUp = (e) => {
    e.preventDefault();
    submit(signUp, "up");
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    submit(signIn, "in");
  };

  return (
    <div className="auth">
      <aside className="auth-hero">
        <h1>Start a project. We'll break it into tasks.</h1>
        <p>Describe what you're building, get a task graph, and let ready tasks find the right people.</p>
        <ul className="auth-points">
          <li>Profiles with strengths and interests</li>
          <li>Task graphs generated from a description</li>
          <li>Tasks auto-assigned as work unlocks</li>
        </ul>
        <StationScene phase={trainPhase} />
      </aside>
      <form className="panel auth-form profile-form" onSubmit={handleSignIn}>
        {stamped && <span className="ticket-stamp" aria-hidden="true" />}
        <header>
          <h2>Sign in</h2>
          <p className="hint">Use your email and password, or sign up if you're new.</p>
        </header>
        <Perf />
        <label className="field">
          <span className="label">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button
            type="button"
            className="btn btn-secondary btn-train"
            onClick={handleSignUp}
            disabled={pending !== null}
          >
            <span className="btn-train-label">Sign up</span>
            {pending === "up" && <ButtonTrain />}
          </button>
          <button type="submit" className="btn btn-primary btn-train" disabled={pending !== null}>
            <span className="btn-train-label">Sign in</span>
            {pending === "in" && <ButtonTrain />}
          </button>
        </div>
      </form>
    </div>
  );
}

// A mini train crossing a button while its request is in flight.
function ButtonTrain() {
  return (
    <span className="btn-train-run" aria-hidden="true">
      <PixelTrain scale={0.55} />
    </span>
  );
}

// Loading and error states that fill the page (before the profile has loaded).
function PageState({ variant, children }) {
  return (
    <div className="page-state card">
      <PixelScene variant={variant} />
      <Perf />
      {children}
    </div>
  );
}

// Flow: sign in -> has profile? -> no: create profile -> home.
function App() {
  const [authUser, setAuthUser] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(undefined);   // null = signed in, no profile yet
  const [error, setError] = useState("");
  const [homeVersion, setHomeVersion] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(
    () =>
      onUserChanged((user) => {
        setAuthUser(user);
        setProfile(undefined);
        setError("");
        if (user) {
          getMe()
            .then((p) => {
              setProfile(p);
              // First-time user: send them straight to profile creation
              if (!p) navigate("/edit-profile", { replace: true });
            })
            .catch((err) => setError(err.message));
        }
      }),
    [],
  );

  function handleSaved(saved) {
    setProfile(saved);
    setHomeVersion((v) => v + 1);
    navigate("/");
  }

  // Decide what to render for routes that need auth
  function AuthContent() {
    if (authUser === undefined) {
      return (
        <PageState variant="loading">
          <p className="muted">Loading…</p>
        </PageState>
      );
    }
    if (!authUser) return <SignInForm />;
    if (error) {
      return (
        <PageState variant="blocked">
          <p className="error" role="alert">Couldn't load your profile: {error}</p>
        </PageState>
      );
    }
    if (profile === undefined) {
      return (
        <PageState variant="loading">
          <p className="muted">Loading your profile…</p>
        </PageState>
      );
    }
    return null; // auth is fine — let the Route element render
  }

  const authContent = AuthContent();

  return (
    <div className="app">
      <MapBackground />
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Task<span className="brand-mark">4</span>Impact</span>

          {/* Nav links — only shown when signed in and profile exists */}
          {authUser && profile && (
            <nav className="topbar-actions">
              <Link
                to="/"
                className={`btn btn-ghost${location.pathname === "/" ? " btn-active" : ""}`}
              >
                Home
              </Link>
              <Link
                to="/graphpage"
                className={`btn btn-ghost${location.pathname === "/graphpage" ? " btn-active" : ""}`}
              >
                Graph
              </Link>
              <Link
                to="/projects"
                className={`btn btn-ghost${location.pathname === "/projects" ? " btn-active" : ""}`}
              >
                Projects
              </Link>
              <Link
                to="/edit-profile"
                className={`btn btn-ghost${location.pathname === "/edit-profile" ? " btn-active" : ""}`}
              >
                Edit profile
              </Link>
              <button className="btn btn-ghost" onClick={() => signOut()}>
                Sign out
              </button>
            </nav>
          )}

          {/* Signed in but no profile yet — still show sign-out */}
          {authUser && !profile && (
            <nav className="topbar-actions">
              <button className="btn btn-ghost" onClick={() => signOut()}>
                Sign out
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={authContent ?? <Home key={homeVersion} profile={profile} />}
          />
          <Route
            path="/graphpage"
            element={authContent ?? <GraphPage />}
          />
          <Route
            path="/projects"
            element={authContent ?? <ProjectsPage />}
          />
          <Route
            path="/edit-profile"
            element={
              authContent ?? (
                <ProfileForm
                  initial={profile}
                  defaultName={authUser?.name}
                  onSaved={handleSaved}
                  onCancel={() => navigate("/")}
                />
              )
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
