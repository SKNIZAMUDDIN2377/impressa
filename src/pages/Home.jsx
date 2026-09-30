import { useCallback, useEffect, useRef, useState } from "react";
import Post from "../components/Post";
import { getCache, setCache } from "../utils/impressaCache";
import "./Home.css";

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#E9E9E9"/>
      <circle cx="150" cy="115" r="55" fill="#C2C2C2"/>
      <path d="M150 188c-68 0-122 42-122 95v17h244v-17c0-53-54-95-122-95z" fill="#C2C2C2"/>
    </svg>`
  );

const shufflePosts = (items) => {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[i],
    ];
  }

  return shuffled;
};

function Home() {
  const token = localStorage.getItem("token");

  const homeCacheKey = token ? `home_posts_${token}` : "home_posts";

  // ==========================================
  // CACHE-FIRST INITIAL STATE
  // ==========================================

  const initialCachedPosts = getCache(homeCacheKey);

  const hadCacheRef = useRef(
    Array.isArray(initialCachedPosts) && initialCachedPosts.length > 0
  );

  const [posts, setPosts] = useState(() => initialCachedPosts || []);
  const [loading, setLoading] = useState(!hadCacheRef.current);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [touchStartY, setTouchStartY] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);

  const requestIdRef = useRef(0);

  // ==========================================
  // FETCH POSTS
  // ==========================================

  const fetchPosts = useCallback(
    async (isRefresh = false) => {
      const requestId = ++requestIdRef.current;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else if (!hadCacheRef.current) {
          setLoading(true);
        }

        setError("");

        const currentToken = localStorage.getItem("token");

        if (!currentToken) {
          if (requestId === requestIdRef.current) {
            setError("Please sign in again.");
          }

          return;
        }

        const API_URL =
          import.meta.env.VITE_API_URL || "http://localhost:5000";

        const response = await fetch(`${API_URL}/api/posts`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });

        const data = await response.json();

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok) {
          console.error("Failed to fetch posts:", data);

          setError(data.message || "Failed to load posts.");

          return;
        }

        const formattedPosts = (data.posts || []).map((post) => ({
          id: post._id,

          username: post.author?.username || "unknown",

          profileImage: post.author?.profilePicture || DEFAULT_AVATAR,

          time: new Date(post.createdAt).toLocaleDateString(),

          media: post.media || [],

          music: post.music || {
            id: null,
            title: "",
            artist: "",
            audioUrl: "",
          },

          caption: post.caption || "",

          commentsCount: post.commentsCount || 0,

          impressions: post.impressionsCount || 0,
        }));

        const randomizedPosts = shufflePosts(formattedPosts);

        hadCacheRef.current = true;

        setPosts(randomizedPosts);
        setCache(homeCacheKey, randomizedPosts);
      } catch (fetchError) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.error("Fetch posts error:", fetchError);

        if (!getCache(homeCacheKey)) {
          setError("Cannot connect to Impressa server.");
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [homeCacheKey]
  );

  // ==========================================
  // INITIAL LOAD + NAVBAR HOME REFRESH
  // ==========================================

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });

    fetchPosts();

    const handleHomeRefresh = () => {
      window.scrollTo({ top: 0, behavior: "instant" });
      fetchPosts(true);
    };

    window.addEventListener("impressa-home-refresh", handleHomeRefresh);

    return () => {
      window.removeEventListener("impressa-home-refresh", handleHomeRefresh);
    };
  }, [fetchPosts]);

  // ==========================================
  // PULL TO REFRESH
  // ==========================================

  const handleTouchStart = (event) => {
    if (window.scrollY <= 0 && !loading && !refreshing) {
      setTouchStartY(event.touches[0].clientY);
    }
  };

  const handleTouchMove = (event) => {
    if (touchStartY === null || window.scrollY > 0 || loading || refreshing) {
      return;
    }

    const distance = event.touches[0].clientY - touchStartY;

    if (distance > 0) {
      setPullDistance(Math.min(distance * 0.5, 100));
    }
  };

  const handleTouchEnd = async () => {
    if (touchStartY === null) {
      return;
    }

    const shouldRefresh = pullDistance >= 60;

    setTouchStartY(null);
    setPullDistance(0);

    if (shouldRefresh) {
      window.scrollTo({ top: 0, behavior: "smooth" });

      await fetchPosts(true);
    }
  };

  const showSkeleton = !error && loading && posts.length === 0;
  const showEmpty = !error && !loading && posts.length === 0;

  return (
    <main
      className="home-page"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullDistance > 0 || refreshing) && (
        <div
          className="pull-indicator"
          style={{
            height: refreshing ? "48px" : `${pullDistance}px`,
            transition: refreshing ? "height 0.2s ease" : "none",
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
          <div>
            <h1>home</h1>
            <p>Discover impressions</p>
          </div>
        </header>

        <section className="home-feed">
          {error && (
            <div className="home-state">
              <div className="home-state-icon">!</div>

              <h3>Something went wrong</h3>

              <p>{error}</p>

              <button type="button" onClick={() => fetchPosts(true)}>
                Try again
              </button>
            </div>
          )}

          {showSkeleton &&
            [0, 1, 2].map((key) => (
              <div className="feed-skeleton" key={key}>
                <div className="feed-skeleton-head">
                  <span className="sk sk-avatar" />
                  <span className="sk sk-line sk-w40" />
                </div>

                <span className="sk sk-media" />

                <div className="feed-skeleton-foot">
                  <span className="sk sk-line sk-w70" />
                  <span className="sk sk-line sk-w50" />
                </div>
              </div>
            ))}

          {showEmpty && (
            <div className="home-state">
              <div className="home-state-icon">i</div>

              <h3>Nothing here yet</h3>

              <p>New impressions will show up here as people post.</p>

              <button type="button" onClick={() => fetchPosts(true)}>
                Refresh
              </button>
            </div>
          )}

          {!error && posts.map((post) => <Post key={post.id} post={post} />)}
        </section>
      </div>
    </main>
  );
}

export default Home;