import { useEffect, useState } from "react";
import { getMe, onUserChanged, signIn, signOut, signUp } from "./api.js";
import Home from "./components/Home.jsx";
import ProfileForm from "./components/ProfileForm.jsx";
import "./App.css";

// Email/password sign-in and sign-up (Firebase Auth).
function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignUp = (e) => {
    e.preventDefault();
    setError("");
    signUp(email, password).catch((err) => setError(err.message));
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    setError("");
    signIn(email, password).catch((err) => setError(err.message));
  };

  return (
    <form className="panel profile-form" onSubmit={handleSignIn}>
      <header>
        <h2>Sign in</h2>
        <p className="hint">Use your email and password, or sign up if you're new.</p>
      </header>
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
        <button type="button" className="btn btn-ghost" onClick={handleSignUp}>
          Sign up
        </button>
        <button type="submit" className="btn btn-primary">
          Sign in
        </button>
      </div>
    </form>
  );
}

// Flow: sign in -> has profile? -> no: create profile -> home (your profile, your
// project's tasks, and your project team). Signed-in members can edit their profile from the header.
function App() {
  const [authUser, setAuthUser] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(undefined); // null = signed in, no profile yet
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [homeVersion, setHomeVersion] = useState(0);

  useEffect(
    () =>
      onUserChanged((user) => {
        setAuthUser(user);
        setProfile(undefined);
        setEditing(false);
        setError("");
        if (user) {
          getMe()
            .then(setProfile)
            .catch((err) => setError(err.message));
        }
      }),
    [],
  );

  function handleSaved(saved) {
    setProfile(saved);
    setEditing(false);
    setHomeVersion((v) => v + 1);
  }

  let content;
  if (authUser === undefined) {
    content = <p className="muted center">Loading…</p>;
  } else if (!authUser) {
    content = <SignInForm />;
  } else if (error) {
    content = <p className="error center" role="alert">Couldn't load your profile: {error}</p>;
  } else if (profile === undefined) {
    content = <p className="muted center">Loading your profile…</p>;
  } else if (profile === null) {
    content = <ProfileForm defaultName={authUser.name} onSaved={handleSaved} />;
  } else if (editing) {
    content = (
      <ProfileForm initial={profile} onSaved={handleSaved} onCancel={() => setEditing(false)} />
    );
  } else {
    content = <Home key={homeVersion} profile={profile} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Hack4Impact</span>
        {authUser && (
          <nav className="topbar-actions">
            {profile && !editing && (
              <button className="btn btn-ghost" onClick={() => setEditing(true)}>
                Edit profile
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => signOut()}>
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main>{content}</main>
    </div>
  );
}

export default App;
