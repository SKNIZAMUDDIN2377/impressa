import { useEffect, useRef, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Post from "../components/Post";
import "./ProfilePosts.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

// ==========================================
// NORMALIZE A SINGLE MEDIA ITEM'S URL
// ==========================================
//
// Backend media can come back as a relative path ("/uploads/x.jpg")
// or a hardcoded localhost URL from local testing. Both break once
// the frontend is deployed to a different origin (e.g. Netlify),
// so every media URL is rewritten to point at the real API host —
// the same normalization Profile.jsx already applies to post images.
//

const normalizeMediaUrl = (url) => {
  if (!url) return url;

  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }

  if (url.startsWith("http://localhost:5000")) {
    return url.replace(
      "http://localhost:5000",
      API_BASE_URL
    );
  }

  return url;
};

const normalizeMediaItem = (item) => {
  if (typeof item === "string") {
    return normalizeMediaUrl(item);
  }

  if (item && typeof item === "object") {
    return {
      ...item,
      url: normalizeMediaUrl(item.url),
      path: normalizeMediaUrl(item.path),
      src: normalizeMediaUrl(item.src),
    };
  }

  return item;
};

// ==========================================
// PROFILE POSTS CACHE
// ==========================================

const getCachedProfilePosts = (username) => {
  try {
    if (!username) return null;

    return JSON.parse(
      localStorage.getItem(
        `impressa_profile_posts_page_${username.toLowerCase()}`
      ) || "null"
    );
  } catch (error) {
    console.error(
      "Profile posts page cache read error:",
      error
    );

    return null;
  }
};

const setCachedProfilePosts = (username, posts) => {
  try {
    if (!username) return;

    localStorage.setItem(
      `impressa_profile_posts_page_${username.toLowerCase()}`,
      JSON.stringify(posts)
    );
  } catch (error) {
    console.error(
      "Profile posts page cache write error:",
      error
    );
  }
};

const clearCachedProfilePosts = (username) => {
  try {
    if (!username) return;

    localStorage.removeItem(
      `impressa_profile_posts_page_${username.toLowerCase()}`
    );
  } catch (error) {
    console.error(
      "Profile posts page cache clear error:",
      error
    );
  }
};

function ProfilePosts() {
  const navigate = useNavigate();
  const { username } = useParams();
  const [searchParams] = useSearchParams();

  const selectedPostId = searchParams.get("post");

  const initialCachedPosts = getCachedProfilePosts(username);

  const [posts, setPosts] = useState(
    initialCachedPosts || []
  );

  const [loading, setLoading] = useState(
    !initialCachedPosts
  );

  const [error, setError] = useState("");

  const requestIdRef = useRef(0);

  useEffect(() => {
    const cachedForThisUser = getCachedProfilePosts(username);

    setPosts(cachedForThisUser || []);
    setLoading(!cachedForThisUser);
    setError("");

    const requestId = ++requestIdRef.current;

    const fetchUserPosts = async () => {
      try {
        setError("");

        const token = localStorage.getItem("token");

        const response = await fetch(
          `${API_BASE_URL}/api/profile/${encodeURIComponent(
            username
          )}/posts`,
          {
            method: "GET",
            headers: token
              ? { Authorization: `Bearer ${token}` }
              : {},
          }
        );

        const data = await response.json();

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok) {
          // Deleted, not found, or blocked: never show a stale cached copy
          if (response.status === 404) {
            clearCachedProfilePosts(username);

            setPosts([]);
            setError("This profile isn't available.");

            return;
          }

          if (!getCachedProfilePosts(username)) {
            setError(
              data.message ||
                "Failed to load posts."
            );
          }
          return;
        }

        const formattedPosts =
          (data.posts || []).map((post) => ({
            id: post._id,

            username:
              post.author?.username ||
              username,

            profileImage: normalizeMediaUrl(
              post.author?.profilePicture
            ) || "https://i.pravatar.cc/150",

            time: new Date(
              post.createdAt
            ).toLocaleDateString(),

            media: (post.media || []).map(
              normalizeMediaItem
            ),

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

            shares:
              post.sharesCount || 0,

            impressions:
              post.impressionsCount || 0,
          }));

        setPosts(formattedPosts);
        setCachedProfilePosts(username, formattedPosts);
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.error(
          "Profile posts error:",
          error
        );

        if (!getCachedProfilePosts(username)) {
          setError(
            "Cannot connect to Impressa server."
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    if (username) {
      fetchUserPosts();
    } else {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (
      loading ||
      !selectedPostId ||
      posts.length === 0
    ) {
      return;
    }

    const targetPost = document.getElementById(
      `post-${selectedPostId}`
    );

    if (!targetPost) {
      return;
    }

    setTimeout(() => {
      targetPost.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
  }, [
    loading,
    selectedPostId,
    posts,
  ]);

  return (
    <main className="profile-posts-page">

      <header className="profile-posts-header">

        <button
          type="button"
          className="profile-posts-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ←
        </button>

        <div>
          <span>
            IMPRESSA
          </span>

          <h1>
            @{username}
          </h1>

          <p>
            Posts & impressions
          </p>
        </div>

      </header>


      <section className="profile-posts-feed">

        {loading && posts.length === 0 && (
          <div className="profile-posts-status">
            Loading posts...
          </div>
        )}


        {!loading && error && posts.length === 0 && (
          <div className="profile-posts-status">
            {error}
          </div>
        )}


        {!loading &&
          !error &&
          posts.length === 0 && (

            <div className="profile-posts-empty">

              <div>
                i
              </div>

              <h2>
                No posts yet
              </h2>

              <p>
                @{username} hasn't shared
                any posts yet.
              </p>

            </div>

        )}


        {posts.length > 0 && (

            <div className="profile-posts-list">

              {posts.map((post) => (
                <div
                  key={post.id}
                  id={`post-${post.id}`}
                >
                  <Post
                    post={post}
                  />
                </div>
              ))}

            </div>

        )}

      </section>

    </main>
  );
}

export default ProfilePosts;