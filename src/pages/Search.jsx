import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Search.css";

function Search() {
  // ==========================================
  // RESTORE SEARCH STATE
  // ==========================================

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
    useState([]);

  const [following, setFollowing] =
    useState(savedFollowing);

  const navigate = useNavigate();

  // ==========================================
  // API URL
  // ==========================================

  const API_URL =
    `http://${window.location.hostname}:5000`;

  // ==========================================
  // SAVE SEARCH TEXT
  // ==========================================

  useEffect(() => {
    sessionStorage.setItem(
      "impressa_search_text",
      searchText
    );
  }, [searchText]);

  // ==========================================
  // SAVE FOLLOWING STATE
  // ==========================================

  useEffect(() => {
    sessionStorage.setItem(
      "impressa_search_following",
      JSON.stringify(following)
    );
  }, [following]);

  // ==========================================
  // RESTORE SCROLL POSITION
  // ==========================================

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

        const fetchedUsers =
          data.users || [];

        setUsers(fetchedUsers);

        // ==========================================
        // GET REAL FOLLOW STATUS
        // ==========================================

        const followingIds = [];

        await Promise.all(
          fetchedUsers.map(
            async (user) => {
              try {
                const statusResponse =
                  await fetch(
                    `${API_URL}/api/follow/status/${encodeURIComponent(
                      user.username
                    )}`,
                    {
                      method: "GET",
                      signal:
                        controller.signal,
                      headers: {
                        Authorization:
                          `Bearer ${token}`,
                      },
                    }
                  );

                const statusData =
                  await statusResponse.json();

                if (
                  statusResponse.ok &&
                  statusData.following === true
                ) {
                  followingIds.push(
                    user.id
                  );
                }
              } catch (error) {
                if (
                  error.name !==
                  "AbortError"
                ) {
                  console.error(
                    "Follow status error ❌",
                    error
                  );
                }
              }
            }
          )
        );

        setFollowing(
          followingIds
        );

      } catch (error) {
        if (
          error.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "Search users error ❌",
          error
        );

        setUsers([]);
        setFollowing([]);
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

    const isCurrentlyFollowing =
      following.includes(user.id);

    // ==========================================
    // UPDATE UI IMMEDIATELY
    // ==========================================

    setFollowing((previous) => {
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
        // ==========================================
        // ROLLBACK IF BACKEND FAILS
        // ==========================================

        setFollowing((previous) => {
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

    } catch (error) {
      console.error(
        "Follow connection error ❌",
        error
      );

      // ==========================================
      // ROLLBACK IF SERVER CONNECTION FAILS
      // ==========================================

      setFollowing((previous) => {
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
    }
  };

  return (
    <main className="search-page">

      {/* =====================================
          HEADER
      ===================================== */}

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


      {/* =====================================
          SEARCH BAR
      ===================================== */}

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


      {/* =====================================
          SEARCH RESULT INFO
      ===================================== */}

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


      {/* =====================================
          USERS
      ===================================== */}

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

          users.map((user) => {

            const isFollowing =
              following.includes(
                user.id
              );

            return (
              <article
                className="user-card"
                key={user.id}
                onClick={() =>
                  navigate(
                    `/profile/${user.username}`
                  )
                }
              >

                {/* PROFILE */}

                <div className="user-main">

                  <img
                    className="user-avatar"
                    src={
                      user.image ||
                      "https://i.pravatar.cc/150"
                    }
                    alt={user.username}
                  />

                  <div className="user-details">

                    <h3>
                      {user.name}

                      {user.isOfficial === true && (
                        <span className="official-badge">
                          ●
                        </span>
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


                {/* FOLLOW */}

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