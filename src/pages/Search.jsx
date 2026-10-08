import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCache,
  setCache,
} from "../utils/impressaCache";
import { getStoredTheme } from "../utils/theme";
import "./Search.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

// Only used while typing. The first load and clearing the box are instant.
const SEARCH_DEBOUNCE_MS = 300;

// Follow-status checks are only needed when the search response does not
// already include `isFollowing`.
const STATUS_CONCURRENCY = 8;

const SKELETON_ROWS = 4;

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#E9E9E9"/>
      <circle cx="150" cy="115" r="55" fill="#C2C2C2"/>
      <path d="M150 188c-68 0-122 42-122 95v17h244v-17c0-53-54-95-122-95z" fill="#C2C2C2"/>
    </svg>`
  );

// ==========================================
// SMALL HELPERS
// ==========================================

const readSession = (key, fallback = "") => {
  try {
    const value = sessionStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
};

const writeSession = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch (error) {
    // ignore
  }
};

// Safe JSON parsing: a non-JSON body never throws.
const parseJson = async (response) => {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    return {};
  }
};

// The logged-in user, so they never appear in their own results.
const getViewer = () => {
  try {
    const raw = localStorage.getItem("user");
    const stored = raw ? JSON.parse(raw) : null;

    return {
      id: stored?.id ? String(stored.id) : "",
      username: String(stored?.username || "").toLowerCase(),
    };
  } catch (error) {
    return { id: "", username: "" };
  }
};

const isViewer = (user, viewer) =>
  (viewer.id && String(user.id) === viewer.id) ||
  (viewer.username &&
    String(user.username || "").toLowerCase() === viewer.username);

// Normalises ids, drops duplicates, users without a username, and the viewer.
const cleanUsers = (list, viewer) => {
  if (!Array.isArray(list)) return [];

  const seen = new Set();
  const result = [];

  list.forEach((raw) => {
    if (!raw) return;

    const id = raw.id ?? raw._id;

    if (!id || !raw.username || seen.has(String(id))) return;

    const user = { ...raw, id };

    if (isViewer(user, viewer)) return;

    seen.add(String(id));
    result.push(user);
  });

  return result;
};

// Reads a cached result set. Understands the old cache shape
// ({ users, following: [ids] }) as well as the new one
// ({ users, followState: { id: boolean } }).
const readCachedResults = (key, viewer) => {
  try {
    const cached = getCache(key);

    if (!cached || !Array.isArray(cached.users)) return null;

    const users = cleanUsers(cached.users, viewer);

    let followState = {};

    if (cached.followState && typeof cached.followState === "object") {
      followState = { ...cached.followState };
    } else if (Array.isArray(cached.following)) {
      cached.following.forEach((id) => {
        followState[id] = true;
      });
    }

    return { users, followState };
  } catch (error) {
    return null;
  }
};

const persistResults = (key, users, followState) => {
  try {
    const picked = {};

    users.forEach((user) => {
      if (typeof followState[user.id] === "boolean") {
        picked[user.id] = followState[user.id];
      }
    });

    setCache(key, { users, followState: picked });
  } catch (error) {
    // caching is optional
  }
};

// Small inline icon (no icon library needed).
function SearchGlyph({ size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <circle cx="11" cy="11" r="1.6" fill="currentColor" stroke="none" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

// ==========================================
// SEARCH
// ==========================================

function Search() {
  const navigate = useNavigate();

  const viewer = useMemo(getViewer, []);

  // Theme is read once; the page sets its own colours in both themes
  const isDark = useMemo(() => getStoredTheme() === "dark", []);

  const cacheKeyFor = (query) =>
    `search_${viewer.username || "guest"}_${query.toLowerCase()}`;

  // Read once: saved search text + cached results for it, so the page
  // paints instantly on refresh / return.
  const initialRef = useRef(null);

  if (initialRef.current === null) {
    const text = readSession("impressa_search_text");

    // Follow state is no longer kept in sessionStorage (it went stale)
    try {
      sessionStorage.removeItem("impressa_search_following");
    } catch (error) {
      // ignore
    }

    initialRef.current = {
      text,
      cached: readCachedResults(cacheKeyFor(text.trim()), viewer),
    };
  }

  const initial = initialRef.current;

  const [searchText, setSearchText] = useState(initial.text);

  const [users, setUsers] = useState(initial.cached?.users || []);

  // { [userId]: true | false }. A missing id means "not known yet".
  const [followState, setFollowState] = useState(
    initial.cached?.followState || {}
  );

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);

  const [toast, setToast] = useState("");

  // Mirrors, so async code never reads stale state
  const usersRef = useRef(initial.cached?.users || []);

  const followRef = useRef(initial.cached?.followState || {});

  const resultsKeyRef = useRef(cacheKeyFor(initial.text.trim()));

  // Only the newest search may update the page
  const requestIdRef = useRef(0);

  // Ids whose follow requests are still being sent to the server.
  // Server status answers never overwrite these.
  const pendingRef = useRef(new Set());

  // What the button shows / what the user last asked for, per id
  const desiredRef = useRef({});

  // What the server last confirmed, per id
  const confirmedRef = useRef({});

  // Ids that currently have a request loop running
  const syncingRef = useRef(new Set());

  // Bumped on every toggle; a follow-status check that started before the
  // toggle is ignored, so it can never undo what the user just did.
  const followVersionRef = useRef({});

  // Ids whose follow state was confirmed by the server in this visit
  const verifiedRef = useRef(new Set());

  const hasFetchedRef = useRef(false);

  const restoredScrollRef = useRef(false);

  const toastTimerRef = useRef(null);


  // ==========================================
  // FOLLOW STATE HELPERS
  // ==========================================

  // Applies { id: boolean }. Server answers never overwrite a user whose
  // toggle is still being sent; the toggle itself passes force = true.
  const applyFollow = (entries, force = false) => {
    const next = { ...followRef.current };

    let changed = false;

    Object.keys(entries).forEach((id) => {
      if (!force && pendingRef.current.has(id)) return;

      if (next[id] !== entries[id]) {
        next[id] = entries[id];
        changed = true;
      }
    });

    if (changed) {
      followRef.current = next;
      setFollowState(next);
    }
  };

  const showToast = (message) => {
    setToast(message);

    clearTimeout(toastTimerRef.current);

    toastTimerRef.current = setTimeout(() => setToast(""), 3200);
  };

  useEffect(() => {
    return () => clearTimeout(toastTimerRef.current);
  }, []);


  // ==========================================
  // PERSIST SEARCH TEXT + SCROLL
  // ==========================================

  useEffect(() => {
    writeSession("impressa_search_text", searchText);
  }, [searchText]);

  useEffect(() => {
    let frame = 0;

    const saveScroll = () => {
      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;
        writeSession("impressa_search_scroll", String(window.scrollY));
      });
    };

    window.addEventListener("scroll", saveScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", saveScroll);

      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Restore the scroll position once, as soon as there are rows to scroll
  useEffect(() => {
    if (restoredScrollRef.current || users.length === 0) return;

    restoredScrollRef.current = true;

    const saved = readSession("impressa_search_scroll");

    if (saved !== "") {
      requestAnimationFrame(() => {
        window.scrollTo(0, Number(saved));
      });
    }
  }, [users.length]);


  // ==========================================
  // FETCH USERS (+ follow state only when needed)
  // ==========================================

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/signin", { replace: true });
      return undefined;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const requestId = ++requestIdRef.current;

    const query = searchText.trim();

    const cacheKey = cacheKeyFor(query);

    const headers = { Authorization: `Bearer ${token}` };

    const isCurrent = () =>
      !signal.aborted && requestId === requestIdRef.current;

    setLoading(true);
    setError(false);

    // Show cached results for this query immediately; the request below
    // refreshes them in the background.
    const cached = readCachedResults(cacheKey, viewer);

    if (cached) {
      usersRef.current = cached.users;
      resultsKeyRef.current = cacheKey;

      setUsers(cached.users);

      const unknownOnly = {};

      Object.keys(cached.followState).forEach((id) => {
        if (followRef.current[id] === undefined) {
          unknownOnly[id] = cached.followState[id];
        }
      });

      applyFollow(unknownOnly);
    }

    const checkOne = async (user) => {
      const version = followVersionRef.current[user.id] || 0;

      try {
        const response = await fetch(
          `${API_URL}/api/follow/status/${encodeURIComponent(
            user.username
          )}`,
          { method: "GET", signal, headers }
        );

        const data = await parseJson(response);

        if (!isCurrent() || !response.ok) return;

        if ((followVersionRef.current[user.id] || 0) !== version) return;

        verifiedRef.current.add(user.id);

        applyFollow({ [user.id]: data.following === true });
      } catch (checkError) {
        if (checkError.name !== "AbortError") {
          console.error("Follow status error:", checkError);
        }
      }
    };

    // Small worker pool: at most STATUS_CONCURRENCY requests at once
    const checkFollowStatuses = async (list) => {
      const queue = [...list];

      const worker = async () => {
        while (queue.length > 0 && isCurrent()) {
          await checkOne(queue.shift());
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(STATUS_CONCURRENCY, queue.length) },
          worker
        )
      );
    };

    const delay =
      hasFetchedRef.current && query !== "" ? SEARCH_DEBOUNCE_MS : 0;

    const timer = setTimeout(async () => {
      hasFetchedRef.current = true;

      try {
        const response = await fetch(
          `${API_URL}/api/profile/search?query=${encodeURIComponent(query)}`,
          { signal, headers }
        );

        const data = await parseJson(response);

        if (!isCurrent()) return;

        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/signin", { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch users");
        }

        const list = cleanUsers(data.users, viewer);

        usersRef.current = list;
        resultsKeyRef.current = cacheKey;

        // If the backend already says who is followed, use it directly
        const fromServer = {};

        list.forEach((user) => {
          if (typeof user.isFollowing === "boolean") {
            fromServer[user.id] = user.isFollowing;
            verifiedRef.current.add(user.id);
          }
        });

        // Results appear right away; nothing waits on follow checks
        setUsers(list);
        applyFollow(fromServer);
        setLoading(false);

        persistResults(cacheKey, list, followRef.current);

        // Only users the server has not described yet need a status check
        const toCheck = list.filter(
          (user) => !verifiedRef.current.has(user.id)
        );

        if (toCheck.length > 0) {
          await checkFollowStatuses(toCheck);

          if (!isCurrent()) return;

          // A check that failed must not leave a button stuck
          // in its loading state forever.
          const fallback = {};

          list.forEach((user) => {
            if (followRef.current[user.id] === undefined) {
              fallback[user.id] = false;
            }
          });

          applyFollow(fallback);

          persistResults(cacheKey, list, followRef.current);
        }
      } catch (fetchError) {
        if (fetchError.name === "AbortError" || !isCurrent()) return;

        console.error("Search users error:", fetchError);

        setLoading(false);
        setError(true);

        if (usersRef.current.length > 0) {
          showToast("Couldn't refresh results.");
        }
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchText, reloadTick]);


  // ==========================================
  // FOLLOW / UNFOLLOW (optimistic, never locked)
  // ==========================================
  //
  // Every tap changes the button at once. Requests for one user are sent
  // one after another until the server matches what the button shows, so
  // fast follow / unfollow taps can never overlap or arrive out of order.

  const toggleFollow = async (user) => {
    const token = localStorage.getItem("token");

    if (!token) {
      showToast("Please sign in again.");
      navigate("/signin", { replace: true });
      return;
    }

    const id = user.id;

    const current = followRef.current[id];

    // State not known yet: nothing safe to toggle
    if (typeof current !== "boolean") return;

    const next = !current;

    // Remember the last server-confirmed state before the first change
    if (!syncingRef.current.has(id)) {
      confirmedRef.current[id] = current;
    }

    desiredRef.current[id] = next;

    pendingRef.current.add(id);

    followVersionRef.current[id] = (followVersionRef.current[id] || 0) + 1;

    // The button changes immediately
    applyFollow({ [id]: next }, true);

    // A request loop is already running for this user: it will pick up
    // the new desired state by itself.
    if (syncingRef.current.has(id)) return;

    syncingRef.current.add(id);

    const revertToConfirmed = (message) => {
      const confirmed = confirmedRef.current[id];

      desiredRef.current[id] = confirmed;

      applyFollow({ [id]: confirmed }, true);

      showToast(message);
    };

    try {
      while (confirmedRef.current[id] !== desiredRef.current[id]) {
        const target = desiredRef.current[id];

        const response = await fetch(
          `${API_URL}/api/follow/${encodeURIComponent(user.username)}`,
          {
            method: target ? "POST" : "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await parseJson(response);

        if (!response.ok) {
          revertToConfirmed(
            data.message ||
              (target
                ? "Couldn't follow. Please try again."
                : "Couldn't unfollow. Please try again.")
          );

          break;
        }

        confirmedRef.current[id] = target;

        verifiedRef.current.add(id);
      }
    } catch (toggleError) {
      console.error("Follow connection error:", toggleError);

      revertToConfirmed("Unable to connect to Impressa server.");
    } finally {
      syncingRef.current.delete(id);
      pendingRef.current.delete(id);

      // Any status check that started during the toggle is now outdated
      followVersionRef.current[id] = (followVersionRef.current[id] || 0) + 1;

      // Cache only; no extra API call
      persistResults(
        resultsKeyRef.current,
        usersRef.current,
        followRef.current
      );
    }
  };

  const openProfile = (user) => {
    navigate(`/profile/${encodeURIComponent(user.username)}`);
  };

  const retrySearch = () => {
    setReloadTick((tick) => tick + 1);
  };


  // ==========================================
  // RENDER
  // ==========================================

  const trimmed = searchText.trim();

  const showSkeleton = loading && users.length === 0;

  const showError = !loading && error && users.length === 0;

  const showEmpty = !loading && !error && users.length === 0;

  return (
    <main className={`search-page ${isDark ? "theme-dark" : ""}`}>

      <header className="search-header">

        <span className="search-eyebrow">IMPRESSA</span>

        <h1>
          Discover<span className="search-h1-dot">.</span>
        </h1>

        <p>Find people. Rise through impressions.</p>

      </header>

      <div className={`search-box ${loading ? "is-loading" : ""}`}>

        <span className="search-box-icon">
          <SearchGlyph size={20} />
        </span>

        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search people on Impressa"
          aria-label="Search users"
        />

        {searchText && (
          <button
            type="button"
            className="search-clear"
            onClick={() => setSearchText("")}
            aria-label="Clear search"
          >
            ×
          </button>
        )}

        <span className="search-progress" aria-hidden="true" />

      </div>

      <div className="search-result-heading">

        <h2>
          {trimmed ? "Results" : "People on Impressa"}
        </h2>

        <span className="search-count">
          {loading
            ? "Searching…"
            : `${users.length} ${users.length === 1 ? "person" : "people"}`}
        </span>

      </div>

      <section className="search-list" aria-busy={loading}>

        {showSkeleton && (
          <>
            <div
              className="search-loading"
              role="status"
              aria-live="polite"
            >
              <span className="search-spinner" aria-hidden="true" />

              <p>Finding people…</p>
            </div>

            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <div
                className="search-card search-card-skeleton"
                key={`skeleton-${index}`}
                aria-hidden="true"
              >
                <span className="search-sk search-sk-avatar" />

                <span className="search-sk-text">
                  <span className="search-sk search-sk-line search-sk-name" />
                  <span className="search-sk search-sk-line search-sk-handle" />
                </span>

                <span className="search-sk search-sk-button" />
              </div>
            ))}
          </>
        )}

        {showError && (
          <div className="search-state" role="alert">

            <div className="search-state-icon search-state-icon-error">
              !
            </div>

            <h3>Couldn't load people</h3>

            <p>Check your connection and try again.</p>

            <button
              type="button"
              className="search-retry"
              onClick={retrySearch}
            >
              Try again
            </button>

          </div>
        )}

        {showEmpty && (
          <div className="search-state">

            <div className="search-state-icon">
              <SearchGlyph size={28} />
            </div>

            <h3>
              {trimmed ? "No one found" : "No people to show yet"}
            </h3>

            <p>
              {trimmed
                ? `Nothing matches “${trimmed}”. Try another name or username.`
                : "New people will show up here as Impressa grows."}
            </p>

          </div>
        )}

        {users.map((user) => {
          const state = followState[user.id];

          const known = typeof state === "boolean";

          const isFollowing = state === true;

          const displayName = user.name || user.username;

          return (
            <article
              className={`search-card ${isFollowing ? "is-following" : ""}`}
              key={user.id}
            >

              <button
                type="button"
                className="search-card-open"
                onClick={() => openProfile(user)}
                aria-label={`Open ${displayName}'s profile`}
              >

                <span className="search-avatar">
                  <img
                    src={user.image || user.profilePicture || DEFAULT_AVATAR}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.src !== DEFAULT_AVATAR) {
                        event.currentTarget.src = DEFAULT_AVATAR;
                      }
                    }}
                  />
                </span>

                <span className="search-card-text">

                  <strong className="search-card-name">
                    <span className="search-card-name-text">
                      {displayName}
                    </span>

                    {user.isOfficial === true && (
                      <span
                        className="official-badge"
                        title="Official Impressa account"
                      />
                    )}
                  </strong>

                  <span className="search-card-handle">
                    @{user.username}
                  </span>

                  {user.bio ? (
                    <span className="search-card-bio">{user.bio}</span>
                  ) : null}

                </span>

              </button>

              <button
                type="button"
                className={`search-follow ${
                  isFollowing ? "is-following" : ""
                } ${!known ? "is-checking" : ""}`}
                onClick={() => toggleFollow(user)}
                disabled={!known}
                aria-pressed={isFollowing}
                aria-busy={!known}
                aria-label={`${isFollowing ? "Unfollow" : "Follow"} @${
                  user.username
                }`}
              >
                {known ? (isFollowing ? "Following" : "Follow") : "Follow"}
              </button>

            </article>
          );
        })}

      </section>

      {toast && (
        <div className="search-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

    </main>
  );
}

export default Search;