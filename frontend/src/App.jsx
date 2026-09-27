import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/hello")
      .then(res => res.json())
      .then(data => setMessage(data.message));

    fetch("http://localhost:5000/api/users")
      .then(res => res.json())
      .then(data => setUsers(data));
  }, []);

  return (
    <div>
      <h1>Full Stack Demo</h1>
      <p>{message}</p>

      <h2>Users</h2>
      {users.map(user => (
        <div key={user.id}>
          {user.name}
        </div>
      ))}
    </div>
  );
}

export default App;
