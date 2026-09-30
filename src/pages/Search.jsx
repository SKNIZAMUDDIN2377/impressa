import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCache,
  setCache,
} from "../utils/impressaCache";
import "./Search.css";

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#E9E9E9"/>
      <circle cx="150" cy="115" r="55" fill="#C2C2C2"/>
      <path d="M150 188c-68 0-122 42-122 95v17h244v-17c0-53-54-95-122-95z" fill="#C2C2C2"/>
    </svg>`
  );

function Search() {
  const savedSearchText =
    sessionStorage.getItem("impressa_search_text") || "";

  const savedFollowing =
    JSON.parse(
      sessionStorage.getItem(
        "impressa_search_following"
      ) || "null"
    ) || [];

  const [searchText, setSearchText] =
    useState(savedSearchText);

  const [users, setUsers] =
  useState(() => {
    const cached =
      getCache(
        `search_${
          localStorage.getItem("token") ||
          "guest"
        }_${savedSearchText
          .trim()
          .toLowerCase()}`
      );

    return cached?.users || [];
  });

  const [following, setFollowing] =
    useState(savedFollowing);

  // Mirrors `following` so async callbacks never read a stale
  // closure, and so the cache can be updated right after a toggle.
  const followingRef = useRef(following);

  // Tracks which search request is the "latest" one so an older,
  // slower response can never overwrite state set by a newer search.
  const searchRequestIdRef = useRef(0);

  // Tracks user ids with an in-flight follow/unfollow request, so
  // rapid double-clicks don't fire duplicate requests — and so a
  // stale follow-status check can't undo a toggle the user just made.
  const pendingFollowRef = useRef(new Set());

  const navigate = useNavigate();
  const token =
  localStorage.getItem("token");

const searchCacheKey = `search_${token || "guest"}_${searchText
  .trim()
  .toLowerCase()}`;

 const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

  const updateFollowing = (updater) => {
    setFollowing((previous) => {
      const next =
        typeof updater === "function"
          ? updater(previous)
          : updater;

      followingRef.current = next;

      return next;
    });
  };

  useEffect(() => {
    sessionStorage.setItem(
      "impressa_search_text",
      searchText
    );
  }, [searchText]);

  useEffect(() => {
    sessionStorage.setItem(
      "impressa_search_following",
      JSON.stringify(following)
    );
  }, [following]);

  useEffect(() => {
    const savedScroll =
      sessionStorage.getItem(
        "impressa_search_scroll"
      );

    if (savedScroll !== null) {
      requestAnimationFrame(() => {
        window.scrollTo(
          0,
          Number(savedScroll)
        );
      });
    }

    const saveScroll = () => {
      sessionStorage.setItem(
        "impressa_search_scroll",
        String(window.scrollY)
      );
    };

    window.addEventListener(
      "scroll",
      saveScroll
    );

    return () => {
      saveScroll();

      window.removeEventListener(
        "scroll",
        saveScroll
      );
    };
  }, []);

  // ==========================================
  // FETCH USERS + FOLLOW STATUS
  // ==========================================

  useEffect(() => {
    const controller =
      new AbortController();

    const requestId =
      ++searchRequestIdRef.current;

    const fetchUsers = async () => {
      try {
        const token =
          localStorage.getItem("token");

        const response = await fetch(
          `${API_URL}/api/profile/search?query=${encodeURIComponent(
            searchText.trim()
          )}`,
          {
            signal: controller.signal,
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to fetch users"
          );
        }

        if (
          requestId !==
          searchRequestIdRef.current
        ) {
          return;
        }

        const fetchedUsers =
  data.users || [];

// Show the list immediately — don't wait for follow-status
// checks before the user sees any results.
setUsers(fetchedUsers);

        // ==========================================
        // GET REAL FOLLOW STATUS — progressively
        // ==========================================
        //
        // Each check updates state as soon as IT resolves, instead
        // of the whole batch waiting on Promise.all. This means
        // follow buttons fill in one by one rather than the entire
        // list staying in a stale/default state until every check
        // is done.
        //

        fetchedUsers.forEach((user) => {
          fetch(
            `${API_URL}/api/follow/status/${encodeURIComponent(
              user.username
            )}`,
            {
              method: "GET",
              signal: controller.signal,
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          )
            .then((statusResponse) =>
              statusResponse
                .json()
                .then((statusData) => ({
                  ok: statusResponse.ok,
                  statusData,
                }))
            )
            .then(({ ok, statusData }) => {
              // A newer search has replaced this one — drop it.
              if (
                requestId !==
                searchRequestIdRef.current
              ) {
                return;
              }

              // Don't let a follow-status check overwrite a toggle
              // the user already made for this user while the
              // check was in flight.
              if (pendingFollowRef.current.has(user.id)) {
                return;
              }

              if (!ok) return;

              updateFollowing((previous) => {
                const isFollowing =
                  previous.includes(user.id);

                if (
                  statusData.following === true &&
                  !isFollowing
                ) {
                  return [...previous, user.id];
                }

                if (
                  statusData.following !== true &&
                  isFollowing
                ) {
                  return previous.filter(
                    (userId) => userId !== user.id
                  );
                }

                return previous;
              });

              setCache(searchCacheKey, {
                users: fetchedUsers,
                following: followingRef.current,
              });
            })
            .catch((error) => {
              if (error.name !== "AbortError") {
                console.error(
                  "Follow status error ❌",
                  error
                );
              }
            });
        });

      } catch (error) {
        if (
          error.name ===
          "AbortError"
        ) {
          return;
        }

        if (
          requestId !==
          searchRequestIdRef.current
        ) {
          return;
        }

        console.error(
          "Search users error ❌",
          error
        );

       if (!getCache(searchCacheKey)) {
  setUsers([]);
  updateFollowing([]);
}
      }
    };

    const delay =
      setTimeout(() => {
        fetchUsers();
      }, 300);

    return () => {
      clearTimeout(delay);
      controller.abort();
    };
  }, [searchText]);

  // ==========================================
  // FOLLOW / UNFOLLOW
  // ==========================================

  const toggleFollow = async (user) => {
    const token =
      localStorage.getItem("token");

    if (!token) {
      alert("Please sign in again.");
      return;
    }

    if (pendingFollowRef.current.has(user.id)) {
      return;
    }

    pendingFollowRef.current.add(user.id);

    const isCurrentlyFollowing =
      followingRef.current.includes(user.id);

    updateFollowing((previous) => {
      if (isCurrentlyFollowing) {
        return previous.filter(
          (userId) =>
            userId !== user.id
        );
      }

      return [
        ...previous,
        user.id,
      ];
    });

    try {
      const response =
        await fetch(
          `${API_URL}/api/follow/${encodeURIComponent(
            user.username
          )}`,
          {
            method:
              isCurrentlyFollowing
                ? "DELETE"
                : "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        updateFollowing((previous) => {
          if (isCurrentlyFollowing) {
            return [
              ...previous,
              user.id,
            ];
          }

          return previous.filter(
            (userId) =>
              userId !== user.id
          );
        });

        console.error(
          "Follow update error ❌",
          data
        );

        return;
      }

      const cached = getCache(searchCacheKey);

      setCache(searchCacheKey, {
        users: cached?.users || users,
        following: followingRef.current,
      });

    } catch (error) {
      console.error(
        "Follow connection error ❌",
        error
      );

      updateFollowing((previous) => {
        if (isCurrentlyFollowing) {
          return [
            ...previous,
            user.id,
          ];
        }

        return previous.filter(
          (userId) =>
            userId !== user.id
        );
      });
    } finally {
      // Release the lock slightly after the state settles, so a
      // follow-status check already in flight for this user (fired
      // just before the click) doesn't land right after release
      // and immediately re-overwrite what the user just set.
      setTimeout(() => {
        pendingFollowRef.current.delete(user.id);
      }, 400);
    }
  };

  return (
    <main className="search-page">

      <header className="search-header">

        <span className="search-small-title">
          impressa
        </span>

        <h1>Search</h1>

        <p>
          Find people and discover the Impressa
          community.
        </p>

      </header>

      <div className="search-box">

        <span className="search-icon">
          ⌕
        </span>

        <input
          type="text"
          value={searchText}
          onChange={(e) =>
            setSearchText(
              e.target.value
            )
          }
          placeholder="Search users..."
          aria-label="Search users"
        />

        {searchText && (
          <button
            className="clear-search"
            onClick={() =>
              setSearchText("")
            }
            aria-label="Clear search"
          >
            ×
          </button>
        )}

      </div>

      <div className="search-result-heading">

        <h2>
          {searchText
            ? "Search Results"
            : "People on Impressa"}
        </h2>

        <span>
          {users.length} users
        </span>

      </div>

      <section className="users-list">

        {users.length === 0 ? (

          <div className="no-results">

            <div className="no-results-icon">
              🔎
            </div>

            <h3>
              No users found
            </h3>

            <p>
              Try searching with another
              name or username.
            </p>

          </div>

        ) : (

          users.map((user, index) => {

            const isFollowing =
              following.includes(
                user.id
              );

            return (
              <article
                className="user-card"
                key={user.id}
                style={{
                  animationDelay: `${Math.min(index, 10) * 0.04}s`,
                }}
                onClick={() =>
                  navigate(
                    `/profile/${user.username}`
                  )
                }
              >

                <div className="user-main">

                  <img
                    className="user-avatar"
                    src={
                      user.image ||
                      DEFAULT_AVATAR
                    }
                    alt={user.username}
                  />

                  <div className="user-details">

                    <h3>
                      {user.name}

                      {user.isOfficial === true && (
                        <span className="official-badge" title="Official Impressa account" />
                      )}
                    </h3>

                    <span>
                      @{user.username}
                    </span>

                    <p>
                      {user.bio}
                    </p>

                  </div>

                </div>

                <button
                  className={
                    isFollowing
                      ? "follow-button following"
                      : "follow-button"
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFollow(user);
                  }}
                >
                  {isFollowing
                    ? "Following"
                    : "Follow"}
                </button>

              </article>
            );
          })
        )}

      </section>

    </main>
  );
}

export default Search;