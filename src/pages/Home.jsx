import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Post from "../components/Post";
import { getCache, setCache } from "../utils/impressaCache";
import "./Home.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

// Posts per request
const PAGE_SIZE = 10;

// true  = random order inside each batch (your original behavior)
// false = plain newest-first
const SHUFFLE_FEED = true;

const FEED_CACHE_PREFIX = "home_feed_v2_";

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
// CACHE HELPERS
// ==========================================

// The old cache key contained the login token, so every login left an
// orphaned copy of the feed behind. Remove those once.
const purgeLegacyFeedCaches = () => {
  try {
    const doomed = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);

      if (key && key.includes("home_posts")) {
        doomed.push(key);
      }
    }

    doomed.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    // ignore
  }
};

purgeLegacyFeedCaches();

const getFeedCacheKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");

    const who = String(user?.username || user?.id || "me").toLowerCase();

    return `${FEED_CACHE_PREFIX}${who}`;
  } catch (error) {
    return `${FEED_CACHE_PREFIX}me`;
  }
};

const readCachedFeed = (key) => {
  try {
    const value = getCache(key);

    return Array.isArray(value)
      ? value.filter((post) => post && post.id)
      : [];
  } catch (error) {
    return [];
  }
};

const writeCachedFeed = (key, posts) => {
  try {
    setCache(key, posts);
  } catch (error) {
    // storage full or blocked: the feed still works without a cache
  }
};

// ==========================================
// NETWORK HELPERS
// ==========================================

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(Object.assign(new Error("aborted"), { code: "aborted" }));
      },
      { once: true }
    );
  });

// fetch with timeout + safe JSON parsing.
// Resolves { ok, status, data }. Rejects with error.code =
// "timeout" | "network" | "aborted".
const fetchJson = async (
  url,
  { headers = {}, signal, timeoutMs = 20000 } = {}
) => {
  const controller = new AbortController();

  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      data = {};
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    if (timedOut) {
      throw Object.assign(new Error("timeout"), { code: "timeout" });
    }

    if (signal?.aborted) {
      throw Object.assign(new Error("aborted"), { code: "aborted" });
    }

    throw Object.assign(new Error("network"), { code: "network" });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
};

// One automatic retry for network errors, timeouts and 5xx
// (covers a sleeping / cold-starting server).
const getWithRetry = async (url, headers, signal) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await fetchJson(url, {
        headers,
        signal,
        timeoutMs: attempt === 0 ? 20000 : 35000,
      });

      if (result.status >= 500 && attempt === 0) {
        await wait(1200, signal);
        continue;
      }

      return result;
    } catch (error) {
      if (error.code === "aborted" || attempt === 1) {
        throw error;
      }

      await wait(1200, signal);
    }
  }

  throw Object.assign(new Error("network"), { code: "network" });
};

const describeError = (error) => {
  if (error.code === "timeout") {
    return "The server is taking too long to respond. Please try again.";
  }

  if (error.code === "network") {
    return "Cannot connect to Impressa server.";
  }

  return error.message || "Failed to load posts.";
};

// ==========================================
// FEED HELPERS
// ==========================================

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

const orderBatch = (items) =>
  SHUFFLE_FEED ? shufflePosts(items) : items;

const formatPost = (post) => ({
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
    isOfficial: post.author?.isOfficial === true,

  ...(typeof post.impressed === "boolean"
    ? { impressed: post.impressed }
    : {}),
});

// Updates posts you are already looking at without reordering them.
// Posts that no longer exist disappear, brand-new posts go on top.
const mergeFeed = (existing, fresh) => {
  const freshById = new Map(fresh.map((post) => [post.id, post]));

  const kept = existing
    .filter((post) => freshById.has(post.id))
    .map((post) => freshById.get(post.id));

  const keptIds = new Set(kept.map((post) => post.id));

  const added = fresh.filter((post) => !keptIds.has(post.id));

  return [...added, ...kept];
};

function Home() {
  const navigate = useNavigate();

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // ==========================================
  // CACHE-FIRST INITIAL STATE
  // ==========================================

  const cacheKeyRef = useRef(null);

  if (cacheKeyRef.current === null) {
    cacheKeyRef.current = getFeedCacheKey();
  }

  const cacheKey = cacheKeyRef.current;

  const initialPostsRef = useRef(null);

  if (initialPostsRef.current === null) {
    initialPostsRef.current = readCachedFeed(cacheKey);
  }

  const hadCacheRef = useRef(initialPostsRef.current.length > 0);

  const [posts, setPosts] = useState(initialPostsRef.current);
  const [loading, setLoading] = useState(!hadCacheRef.current);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [slowLoad, setSlowLoad] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const postsRef = useRef(posts);
  postsRef.current = posts;

  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const moreAbortRef = useRef(null);
  const cursorRef = useRef(null);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef(null);

  const touchRef = useRef({ x: null, y: null, axis: null });
  const pullRef = useRef(0);

  const applyHasMore = (value) => {
    hasMoreRef.current = value;
    setHasMore(value);
  };

  const handleSessionExpired = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigateRef.current("/signin", { replace: true });
  };

  // ==========================================
  // FETCH FIRST PAGE
  // ==========================================

  const fetchFirstPage = useCallback(
    async (isRefresh = false) => {
      const requestId = ++requestIdRef.current;

      abortRef.current?.abort();
      moreAbortRef.current?.abort();

      loadingMoreRef.current = false;
      setLoadingMore(false);

      const controller = new AbortController();
      abortRef.current = controller;

      const token = localStorage.getItem("token");

      if (!token) {
        navigateRef.current("/signin", { replace: true });
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else if (!hadCacheRef.current) {
        setLoading(true);
      }

      setError("");

      try {
        const result = await getWithRetry(
          `${API_URL}/api/posts?limit=${PAGE_SIZE}`,
          { Authorization: `Bearer ${token}` },
          controller.signal
        );

        if (requestId !== requestIdRef.current) return;

        if (result.status === 401) {
          handleSessionExpired();
          return;
        }

        if (!result.ok) {
          throw new Error(
            result.data.message || "Failed to load posts."
          );
        }

        const fresh = (result.data.posts || []).map(formatPost);

        const cursor = result.data.nextCursor || null;

        const current = postsRef.current;

        const next =
          !isRefresh && hadCacheRef.current && current.length > 0
            ? mergeFeed(current, fresh)
            : orderBatch(fresh);

        hadCacheRef.current = true;

        cursorRef.current = cursor;

        applyHasMore(result.data.hasMore === true && !!cursor);

        setMoreError(false);
        setPosts(next);

        writeCachedFeed(cacheKey, next.slice(0, PAGE_SIZE));
      } catch (fetchError) {
        if (
          fetchError.code === "aborted" ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        console.error("Fetch posts error:", fetchError);

        if (postsRef.current.length === 0) {
          setError(describeError(fetchError));
        } else if (isRefresh) {
          setNotice("Couldn't refresh. Showing saved posts.");
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [cacheKey]
  );

  // ==========================================
  // FETCH NEXT PAGE (infinite scroll)
  // ==========================================

  const fetchMore = useCallback(async () => {
    if (
      loadingMoreRef.current ||
      !hasMoreRef.current ||
      !cursorRef.current
    ) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) return;

    const requestId = requestIdRef.current;

    loadingMoreRef.current = true;

    setLoadingMore(true);
    setMoreError(false);

    const controller = new AbortController();
    moreAbortRef.current = controller;

    try {
      const result = await getWithRetry(
        `${API_URL}/api/posts?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(
          cursorRef.current
        )}`,
        { Authorization: `Bearer ${token}` },
        controller.signal
      );

      if (requestId !== requestIdRef.current) return;

      if (result.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!result.ok) {
        throw new Error(
          result.data.message || "Failed to load more posts."
        );
      }

      const incoming = (result.data.posts || []).map(formatPost);

      const cursor = result.data.nextCursor || null;

      cursorRef.current = cursor;

      applyHasMore(result.data.hasMore === true && !!cursor);

      setPosts((previous) => {
        const seen = new Set(previous.map((post) => post.id));

        const additions = orderBatch(incoming).filter(
          (post) => !seen.has(post.id)
        );

        return additions.length > 0
          ? [...previous, ...additions]
          : previous;
      });
    } catch (moreFetchError) {
      if (
        moreFetchError.code === "aborted" ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      console.error("Fetch more posts error:", moreFetchError);

      setMoreError(true);
    } finally {
      loadingMoreRef.current = false;

      if (requestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, []);

  // ==========================================
  // INITIAL LOAD + NAVBAR HOME REFRESH
  // ==========================================

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });

    fetchFirstPage(false);

    const handleHomeRefresh = () => {
      window.scrollTo({ top: 0, behavior: "instant" });
      fetchFirstPage(true);
    };

    window.addEventListener("impressa-home-refresh", handleHomeRefresh);

    return () => {
      window.removeEventListener(
        "impressa-home-refresh",
        handleHomeRefresh
      );

      abortRef.current?.abort();
      moreAbortRef.current?.abort();
    };
  }, [fetchFirstPage]);

  // ==========================================
  // INFINITE SCROLL SENTINEL
  // ==========================================

  useEffect(() => {
    if (!hasMore || moreError) return undefined;

    const element = sentinelRef.current;

    if (!element) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchMore();
        }
      },
      { rootMargin: "800px 0px" }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [hasMore, moreError, posts.length, fetchMore]);

  // ==========================================
  // "WAKING UP THE SERVER" HINT + NOTICE TIMER
  // ==========================================

  useEffect(() => {
    if (!loading || posts.length > 0) {
      setSlowLoad(false);
      return undefined;
    }

    const timer = setTimeout(() => setSlowLoad(true), 6000);

    return () => clearTimeout(timer);
  }, [loading, posts.length]);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = setTimeout(() => setNotice(""), 4000);

    return () => clearTimeout(timer);
  }, [notice]);

  // ==========================================
  // PULL TO REFRESH
  // (ignores horizontal swipes, e.g. on a carousel)
  // ==========================================

  const handleTouchStart = (event) => {
    if (window.scrollY <= 0 && !loading && !refreshing) {
      const touch = event.touches[0];

      touchRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        axis: null,
      };
    }
  };

  const handleTouchMove = (event) => {
    const state = touchRef.current;

    if (
      state.y === null ||
      window.scrollY > 0 ||
      loading ||
      refreshing
    ) {
      return;
    }

    const touch = event.touches[0];

    const deltaY = touch.clientY - state.y;
    const deltaX = touch.clientX - state.x;

    if (state.axis === null) {
      if (Math.abs(deltaX) + Math.abs(deltaY) < 8) return;

      state.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
    }

    if (state.axis === "x") return;

    if (deltaY > 0) {
      const distance = Math.min(deltaY * 0.5, 100);

      pullRef.current = distance;

      setPullDistance(Math.round(distance));
    }
  };

  const handleTouchEnd = async () => {
    if (touchRef.current.y === null) {
      return;
    }

    const shouldRefresh = pullRef.current >= 60;

    touchRef.current = { x: null, y: null, axis: null };

    pullRef.current = 0;

    setPullDistance(0);

    if (shouldRefresh) {
      window.scrollTo({ top: 0, behavior: "smooth" });

      await fetchFirstPage(true);
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
      onTouchCancel={handleTouchEnd}
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

        {notice && <div className="home-notice">{notice}</div>}

        <section className="home-feed">
          {error && posts.length === 0 && (
            <div className="home-state">
              <div className="home-state-icon">!</div>

              <h3>Something went wrong</h3>

              <p>{error}</p>

              <button type="button" onClick={() => fetchFirstPage(true)}>
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

          {showSkeleton && slowLoad && (
            <p className="home-slow-note">
              Waking up the server… this can take a few seconds.
            </p>
          )}

          {showEmpty && (
            <div className="home-state">
              <div className="home-state-icon">i</div>

              <h3>Nothing here yet</h3>

              <p>New impressions will show up here as people post.</p>

              <button type="button" onClick={() => fetchFirstPage(true)}>
                Refresh
              </button>
            </div>
          )}

          {posts.map((post, index) => (
            <Post key={post.id} post={post} priority={index === 0} />
          ))}

          {posts.length > 0 && hasMore && (
            <div className="feed-more" ref={sentinelRef}>
              {moreError ? (
                <button type="button" onClick={fetchMore}>
                  Couldn't load more · Tap to retry
                </button>
              ) : loadingMore ? (
                <span className="feed-spinner" aria-label="Loading more" />
              ) : null}
            </div>
          )}

          {posts.length > 0 && !hasMore && !loading && (
            <div className="feed-end">You're all caught up</div>
          )}
        </section>
      </div>
    </main>
  );
}

export default Home;