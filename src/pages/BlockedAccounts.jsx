import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import ConfirmDialog from "../components/ConfirmDialog";
import { getBlockedUsers, unblockUser } from "../utils/safetyApi";

import "../styles/safety.css";

const DEFAULT_PROFILE_PIC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#E9E9E9"/>
      <circle cx="150" cy="115" r="55" fill="#C2C2C2"/>
      <path d="M150 188c-68 0-122 42-122 95v17h244v-17c0-53-54-95-122-95z" fill="#C2C2C2"/>
    </svg>`
  );

function BlockedAccounts() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unblockTarget, setUnblockTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const requestIdRef = useRef(0);

  // Loads the list, and re-loads (debounced) when the search text changes
  useEffect(() => {
    const requestId = ++requestIdRef.current;

    const timer = setTimeout(
      async () => {
        try {
          setError("");
          setLoading(true);

          const data = await getBlockedUsers(search.trim());

          if (requestId !== requestIdRef.current) return;

          setUsers(data.users || []);
        } catch (err) {
          if (requestId !== requestIdRef.current) return;

          setError(err.message || "Unable to load blocked accounts.");
        } finally {
          if (requestId === requestIdRef.current) {
            setLoading(false);
          }
        }
      },
      search ? 250 : 0
    );

    return () => clearTimeout(timer);
  }, [search]);

  const confirmUnblock = async () => {
    if (!unblockTarget || busy) return;

    try {
      setBusy(true);

      await unblockUser(unblockTarget.username);

      setUsers((current) =>
        current.filter((user) => user._id !== unblockTarget._id)
      );

      setUnblockTarget(null);
    } catch (err) {
      alert(err.message || "Unable to unblock this user.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="safety-page">
      <div className="safety-header">
        <button
          type="button"
          className="safety-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ←
        </button>

        <h1>Blocked Accounts</h1>
      </div>

      <input
        className="safety-search"
        type="search"
        placeholder="Search blocked accounts..."
        value={search}
        maxLength={50}
        onChange={(event) => setSearch(event.target.value)}
      />

      {loading && users.length === 0 && (
        <div className="safety-state">Loading...</div>
      )}

      {!loading && error && (
        <div className="safety-state safety-error-text">{error}</div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="safety-state">
          <h3>{search ? "No results" : "No blocked accounts"}</h3>

          <p>
            {search
              ? "No blocked account matches your search."
              : "Accounts you block will appear here."}
          </p>
        </div>
      )}

      {!error &&
        users.map((user) => (
          <div className="safety-user" key={user._id}>
            <img
              src={user.profilePicture || DEFAULT_PROFILE_PIC}
              alt=""
            />

            <div className="safety-user-info">
              <strong>@{user.username}</strong>
              {user.name && <span>{user.name}</span>}
            </div>

            <button
              type="button"
              className="safety-unblock"
              onClick={() => setUnblockTarget(user)}
            >
              Unblock
            </button>
          </div>
        ))}

      <ConfirmDialog
        open={Boolean(unblockTarget)}
        title={`Unblock @${unblockTarget?.username || ""}?`}
        message={`You and @${
          unblockTarget?.username || ""
        } will be able to find and interact with each other again.`}
        confirmLabel="Unblock"
        busy={busy}
        onCancel={() => setUnblockTarget(null)}
        onConfirm={confirmUnblock}
      />
    </div>
  );
}

export default BlockedAccounts;