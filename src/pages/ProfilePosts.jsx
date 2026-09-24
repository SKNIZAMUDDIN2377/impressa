import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Post from "../components/Post";
import "./ProfilePosts.css";

function ProfilePosts() {
  const navigate = useNavigate();
  const { username } = useParams();
  const [searchParams] = useSearchParams();

  const selectedPostId = searchParams.get("post");

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUserPosts = async () => {
      try {
        setLoading(true);
        setError("");

        const API_URL =
          `http://${window.location.hostname}:5000`;

        const response = await fetch(
          `${API_URL}/api/profile/${encodeURIComponent(
            username
          )}/posts`
        );

        const data = await response.json();

        console.log(
          "Profile Posts response:",
          data
        );

        if (!response.ok) {
          setError(
            data.message ||
              "Failed to load posts."
          );
          return;
        }

        // ==========================================
        // FORMAT BACKEND POSTS FOR POST COMPONENT
        // ==========================================

        const formattedPosts =
          (data.posts || []).map((post) => ({
            id: post._id,

            username:
              post.author?.username ||
              username,

            profileImage:
              post.author?.profilePicture ||
              "https://i.pravatar.cc/150",

            time: new Date(
              post.createdAt
            ).toLocaleDateString(),

            // Keep the complete media array
            media: post.media || [],

            // Keep music from backend
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
      } catch (error) {
        console.error(
          "Profile posts error:",
          error
        );

        setError(
          "Cannot connect to Impressa server."
        );
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchUserPosts();
    }
  }, [username]);

  // ==========================================
  // SCROLL TO SHARED POST
  // ==========================================

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

      {/* ==========================================
          HEADER
      ========================================== */}

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


      {/* ==========================================
          FEED
      ========================================== */}

      <section className="profile-posts-feed">

        {loading && (
          <div className="profile-posts-status">
            Loading posts...
          </div>
        )}


        {!loading && error && (
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


        {!loading &&
          !error &&
          posts.length > 0 && (

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