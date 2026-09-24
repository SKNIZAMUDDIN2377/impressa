import { useCallback, useEffect, useState } from "react";
import Post from "../components/Post";
import "./Home.css";

function Home() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [touchStartY, setTouchStartY] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);

  // ==========================================
  // RANDOMIZE FEED ORDER
  // ==========================================

  const shufflePosts = (items) => {
    const shuffled = [...items];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const randomIndex = Math.floor(
        Math.random() * (i + 1)
      );

      [
        shuffled[i],
        shuffled[randomIndex],
      ] = [
        shuffled[randomIndex],
        shuffled[i],
      ];
    }

    return shuffled;
  };

  // ==========================================
  // FETCH POSTS
  // ==========================================

  const fetchPosts = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const token =
          localStorage.getItem("token");

        if (!token) {
          console.error(
            "No login token found."
          );

          setError(
            "Please sign in again."
          );

          return;
        }

       const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

        console.log(
          "Impressa Home API:",
          `${API_URL}/api/posts`
        );

        const response = await fetch(
          `${API_URL}/api/posts`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        const data =
          await response.json();

        console.log(
          "Impressa Home response:",
          data
        );

        if (!response.ok) {
          console.error(
            "Failed to fetch posts:",
            data
          );

          setError(
            data.message ||
              "Failed to load posts."
          );

          return;
        }

        const formattedPosts =
          (data.posts || []).map(
            (post) => ({
              id: post._id,

              username:
                post.author?.username ||
                "unknown",

              profileImage:
                post.author?.profilePicture ||
                "https://i.pravatar.cc/150",

              time: new Date(
                post.createdAt
              ).toLocaleDateString(),

              media:
                post.media || [],

              music:
                post.music || {
                  id: null,
                  title: "",
                  artist: "",
                  audioUrl: "",
                },

              caption:
                post.caption || "",

              commentsCount:
                post.commentsCount || 0,

              impressions:
                post.impressionsCount || 0,
            })
          );

        // ==========================================
        // NEW RANDOM FEED ORDER
        // ==========================================

        const randomizedPosts =
          shufflePosts(formattedPosts);

        setPosts(randomizedPosts);

      } catch (error) {
        console.error(
          "Fetch posts error:",
          error
        );

        setError(
          "Cannot connect to Impressa server."
        );

      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // ==========================================
  // INITIAL HOME LOAD
  // + NAVBAR HOME REFRESH
  // ==========================================

  useEffect(() => {
    // Always start Home at the top
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });

    // Initial feed
    fetchPosts();

    // ------------------------------------------
    // Listen for Home icon refresh
    // ------------------------------------------

    const handleHomeRefresh = () => {
      // Go to top
      window.scrollTo({
        top: 0,
        behavior: "instant",
      });

      // Fetch latest posts
      fetchPosts(true);
    };

    window.addEventListener(
      "impressa-home-refresh",
      handleHomeRefresh
    );

    return () => {
      window.removeEventListener(
        "impressa-home-refresh",
        handleHomeRefresh
      );
    };
  }, [fetchPosts]);

  // ==========================================
  // PULL TO REFRESH
  // ==========================================

  const handleTouchStart = (event) => {
    if (
      window.scrollY <= 0 &&
      !loading &&
      !refreshing
    ) {
      setTouchStartY(
        event.touches[0].clientY
      );
    }
  };

  const handleTouchMove = (event) => {
    if (
      touchStartY === null ||
      window.scrollY > 0 ||
      loading ||
      refreshing
    ) {
      return;
    }

    const currentY =
      event.touches[0].clientY;

    const distance =
      currentY - touchStartY;

    if (distance > 0) {
      setPullDistance(
        Math.min(distance * 0.5, 100)
      );
    }
  };

  const handleTouchEnd = async () => {
    if (touchStartY === null) {
      return;
    }

    const shouldRefresh =
      pullDistance >= 60;

    setTouchStartY(null);
    setPullDistance(0);

    if (shouldRefresh) {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      await fetchPosts(true);
    }
  };

  return (
    <main
      className="home-page"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ==========================================
          PULL TO REFRESH INDICATOR
      ========================================== */}

      {(pullDistance > 0 ||
        refreshing) && (
        <div
          style={{
            height:
              refreshing
                ? "50px"
                : `${pullDistance}px`,

            display: "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            overflow: "hidden",

            transition:
              refreshing
                ? "height 0.2s ease"
                : "none",

            fontSize: "14px",

            color: "#ff6a00",

            fontWeight: "600",
          }}
        >
          {refreshing
            ? "Refreshing..."
            : pullDistance >= 60
            ? "Release to refresh"
            : "Pull to refresh"}
        </div>
      )}

      <div className="home-container">

        <header className="home-header">

          <h1>
            home
          </h1>

          <p>
            Discover impressions
          </p>

        </header>

        <section className="home-feed">

          {loading && (
            <p>
              Loading posts...
            </p>
          )}

          {!loading &&
            error && (
              <p>
                {error}
              </p>
            )}

          {!loading &&
            !error &&
            posts.length === 0 && (
              <p>
                No posts yet.
              </p>
            )}

          {!loading &&
            !error &&
            posts.map((post) => (
              <Post
                key={post.id}
                post={post}
              />
            ))}

        </section>

      </div>
    </main>
  );
}

export default Home;