import { useEffect, useState } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { auth } from "./firebase";

function App() {
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    
    fetch("http://localhost:5000/api/hello")
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => {});

    fetch("http://localhost:5000/api/users")
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(() => {});

    return () => unsubscribe();
  }, []);

  const handleSignUp = (e) => {
    e.preventDefault();
    setError("");
    createUserWithEmailAndPassword(auth, email, password).catch(err => setError(err.message));
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    setError("");
    signInWithEmailAndPassword(auth, email, password).catch(err => setError(err.message));
  };

  const handleSignOut = () => signOut(auth);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Full Stack Demo</h1>
      <p>{message}</p>

      <div style={{ margin: "20px 0", padding: "15px", border: "1px solid #ccc", borderRadius: "8px", maxWidth: "400px" }}>
        <h2>Firebase Auth (Email/Password)</h2>
        {user ? (
          <div>
            <p>Signed in as: <strong>{user.email}</strong></p>
            <button onClick={handleSignOut} style={{ marginTop: "10px" }}>Sign Out</button>
          </div>
        ) : (
          <form style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
            {error && <p style={{ color: "red", fontSize: "0.85rem" }}>{error}</p>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleSignIn}>Sign In</button>
              <button onClick={handleSignUp}>Sign Up</button>
            </div>
          </form>
        )}
      </div>

      <h2>Users</h2>
      {users.map(u => (
        <div key={u.id}>{u.name}</div>
      ))}
    </div>
  );
}

export default App;
