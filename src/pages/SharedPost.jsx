import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import Post from "../components/Post";

function SharedPost() {
  const { postId } = useParams();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          setError("Please sign in to view this post.");
          setLoading(false);
          return;
        }

        const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";
        const response = await fetch(
          `${API_URL}/api/posts/${postId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          setError(
            data.message ||
              "Unable to load this post."
          );
          setLoading(false);
          return;
        }

        const backendPost = data.post;

        if (!backendPost) {
          setError("Post not found.");
          setLoading(false);
          return;
        }

        setPost({
          id: backendPost._id,

          username:
            backendPost.author?.username ||
            "user",

          profileImage:
            backendPost.author?.profilePicture ||
            "",

          time: backendPost.createdAt
            ? new Date(
                backendPost.createdAt
              ).toLocaleString()
            : "",

          media:
            backendPost.media || [],

          music:
            backendPost.music || null,

          caption:
            backendPost.caption || "",

          impressions:
            backendPost.impressionsCount || 0,

          commentsCount:
            backendPost.commentsCount || 0,

          shares:
            backendPost.sharesCount || 0,
        });

        setLoading(false);
      } catch (err) {
        console.error(
          "Shared post error:",
          err
        );

        setError(
          "Unable to connect to Impressa."
        );

        setLoading(false);
      }
    };

    if (postId) {
      fetchPost();
    }
  }, [postId]);

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "30px 16px",
          textAlign: "center",
        }}
      >
        Loading post...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "30px 16px",
          textAlign: "center",
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 8px",
            }}
          >
            Post unavailable
          </h3>

          <p
            style={{
              margin: 0,
              color: "#777",
            }}
          >
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "20px 0 40px",
      }}
    >
      <Post post={post} />
    </div>
  );
}

export default SharedPost;