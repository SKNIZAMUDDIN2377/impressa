import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Action from "./Action";
import ConfirmDialog from "./ConfirmDialog";
import ReportModal from "./ReportModal";
import { blockUser } from "../utils/safetyApi";

import "./Post.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#E9E9E9"/>
      <circle cx="150" cy="115" r="55" fill="#C2C2C2"/>
      <path d="M150 188c-68 0-122 42-122 95v17h244v-17c0-53-54-95-122-95z" fill="#C2C2C2"/>
    </svg>`
  );

function normalizeUrl(url) {
  if (!url || typeof url !== "string") return url;

  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }

  if (url.startsWith("http://localhost:5000")) {
    return url.replace("http://localhost:5000", API_BASE_URL);
  }

  return url;
}

function getStoredUsername() {
  try {
    return (
      JSON.parse(localStorage.getItem("user") || "null")?.username || ""
    );
  } catch (error) {
    return "";
  }
}

/* =========================================================
   COMMENT BOX
========================================================= */

function CommentBox({
  comments,
  loading,
  error,
  sending,
  currentUsername,
  canModerate,
  onAddComment,
  onDeleteComment,
}) {
  const [text, setText] = useState("");

  function submitComment(event) {
    event.preventDefault();

    const value = text.trim();

    if (!value || sending) return;

    onAddComment(value);
    setText("");
  }

  return (
    <div className="comment-box">
      <div className="comment-list">
        {loading && (
          <p className="comment-state">Loading comments...</p>
        )}

        {!loading && error && (
          <p className="comment-state comment-error">{error}</p>
        )}

        {!loading && !error && comments.length === 0 && (
          <p className="comment-state">
            No comments yet. Be the first to comment.
          </p>
        )}

        {comments.map((comment) => {
          const isMine =
            currentUsername &&
            comment.username === currentUsername;

          return (
            <div className="comment-item" key={comment.id}>
              {comment.profilePicture ? (
                <img
                  className="comment-avatar comment-avatar-img"
                  src={normalizeUrl(comment.profilePicture)}
                  alt=""
                />
              ) : (
                <div className="comment-avatar">
                  {(comment.username || "u").charAt(0).toUpperCase()}
                </div>
              )}

              <div className="comment-content">
                <strong>@{comment.username}</strong>
                <span>{comment.text}</span>
              </div>

              {(isMine || canModerate) && !comment.pending && (
                <button
                  type="button"
                  className="comment-delete"
                  onClick={() => onDeleteComment(comment.id)}
                  aria-label="Delete comment"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form className="comment-form" onSubmit={submitComment}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a comment..."
          aria-label="Add a comment"
          maxLength={500}
        />

        <button type="submit" disabled={!text.trim() || sending}>
          Post
        </button>
      </form>
    </div>
  );
}

/* =========================================================
   POST
========================================================= */

function Post({ post }) {
  const rawMediaItems = post.media?.length
    ? post.media
    : post.postImages?.length
    ? post.postImages.map((url) => ({ url, type: "image" }))
    : post.postImage
    ? [{ url: post.postImage, type: "image" }]
    : [];

  const mediaItems = rawMediaItems.map((item) => {
    if (typeof item === "string") {
      return { url: normalizeUrl(item), type: "image" };
    }

    return {
      ...item,
      url: normalizeUrl(item?.url),
      type: item?.type || "image",
    };
  });

  const profileImageUrl =
    normalizeUrl(post.profileImage) || DEFAULT_AVATAR;

  const currentUsername = getStoredUsername();

  const [currentMedia, setCurrentMedia] = useState(0);

  const [impressions, setImpressions] = useState(
    post.impressions ?? post.impressionsCount ?? 0
  );

  const [impressed, setImpressed] = useState(false);

  const [impressionAnimation, setImpressionAnimation] = useState(0);

  const impressionPendingRef = useRef(false);

  // ---------------- COMMENTS ----------------

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsCount, setCommentsCount] = useState(
    post.commentsCount ?? 0
  );
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // ---------------- SAFETY (report / block) ----------------

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [hidden, setHidden] = useState(false);

  const menuRef = useRef(null);

  const isOwnPost =
    currentUsername && post.username === currentUsername;

  /* ---------- close ⋮ menu when tapping outside ---------- */

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutside);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
    };
  }, [menuOpen]);

  /* ---------- check if I already gave an impression ---------- */

  useEffect(() => {
    const checkUserImpression = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token || !post.id) return;

        const response = await fetch(
          `${API_BASE_URL}/api/posts/${post.id}/impression`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.error("Check impression failed:", data);
          return;
        }

        setImpressed(data.impressed === true);
      } catch (error) {
        console.error("Check impression error:", error);
      }
    };

    checkUserImpression();
  }, [post.id]);

  /* ---------- music ---------- */

  const audioRef = useRef(null);
  const postRef = useRef(null);

  const music = post.music;

  const musicAudioUrl = normalizeUrl(music?.audioUrl);

  const hasMusic = Boolean(musicAudioUrl && music?.title);

  useEffect(() => {
    if (!hasMusic) return;

    const postElement = postRef.current;
    const audio = audioRef.current;

    if (!postElement || !audio) return;

    const stopMusic = () => {
      if (!audio.paused) audio.pause();
      audio.currentTime = 0;
    };

    const playMusic = () => {
      window.dispatchEvent(
        new CustomEvent("impressa:stop-other-music", {
          detail: { postId: post.id },
        })
      );

      if (audio.src !== musicAudioUrl) {
        audio.src = musicAudioUrl;
      }

      const playPromise = audio.play();

      if (playPromise) {
        playPromise.catch((error) => {
          console.log("Post music autoplay was blocked:", error);
        });
      }
    };

    const handleOtherMusic = (event) => {
      if (event.detail?.postId !== post.id) stopMusic();
    };

    window.addEventListener(
      "impressa:stop-other-music",
      handleOtherMusic
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          playMusic();
        } else {
          stopMusic();
        }
      },
      { threshold: [0, 0.6] }
    );

    observer.observe(postElement);

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "impressa:stop-other-music",
        handleOtherMusic
      );

      stopMusic();
    };
  }, [hasMusic, musicAudioUrl, post.id]);

  /* ---------- impression toggle ---------- */

  async function giveImpression() {
    if (impressionPendingRef.current) return;

    impressionPendingRef.current = true;

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        console.error("No login token found.");
        return;
      }

      const wasImpressed = impressed;

      // instant UI
      setImpressed(!wasImpressed);

      setImpressions((value) =>
        wasImpressed ? Math.max(0, value - 1) : value + 1
      );

      setImpressionAnimation((value) => value + 1);

      const response = await fetch(
        `${API_BASE_URL}/api/posts/${post.id}/impression`,
        {
          method: wasImpressed ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Impression request failed:", data);

        // rollback
        setImpressed(wasImpressed);

        setImpressions((value) =>
          wasImpressed ? value + 1 : Math.max(0, value - 1)
        );

        return;
      }

      if (typeof data.impressions === "number") {
        setImpressions(data.impressions);
      }
    } catch (error) {
      console.error("Impression error:", error);
    } finally {
      impressionPendingRef.current = false;
    }
  }

  /* ---------- share ---------- */

  async function sharePost() {
    const shareData = {
      title: `Impressa • @${post.username}`,
      text:
        post.caption ||
        `Check out @${post.username}'s post on Impressa.`,
      url: `${window.location.origin}/post/${post.id}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      const shareText = `${shareData.text}\n${shareData.url}`;

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        window.alert("Share link copied.");
        return;
      }

      window.prompt("Copy this link to share:", shareData.url);
    } catch (error) {
      if (error?.name === "AbortError") return;

      console.error("Share failed:", error);
    }
  }

  /* ---------- report / block ---------- */

  function openReport() {
    setMenuOpen(false);
    setReportOpen(true);
  }

  function openBlockConfirm() {
    setMenuOpen(false);
    setBlockConfirmOpen(true);
  }

  async function confirmBlock() {
    if (blocking) return;

    try {
      setBlocking(true);

      await blockUser(post.username);

      // stop any playing music before this post disappears
      audioRef.current?.pause();

      setBlockConfirmOpen(false);
      setHidden(true);
    } catch (error) {
      console.error("Block user error:", error);
      alert(error.message || "Unable to block this user.");
    } finally {
      setBlocking(false);
    }
  }

  /* ---------- comments: load ---------- */

  async function loadComments() {
    setCommentsLoading(true);
    setCommentsError("");

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_BASE_URL}/api/posts/${post.id}/comments`,
        {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load comments.");
      }

      setComments(data.comments || []);

      if (typeof data.commentsCount === "number") {
        setCommentsCount(data.commentsCount);
      }

      setCommentsLoaded(true);
    } catch (error) {
      console.error("Load comments error:", error);
      setCommentsError(error.message || "Unable to load comments.");
    } finally {
      setCommentsLoading(false);
    }
  }

  function toggleComments() {
    const next = !commentsOpen;

    setCommentsOpen(next);

    if (next && !commentsLoaded && !commentsLoading) {
      loadComments();
    }
  }

  /* ---------- comments: add (saved to backend) ---------- */

  async function addComment(text) {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please sign in again.");
      return;
    }

    const tempId = `temp-${Date.now()}`;

    const tempComment = {
      id: tempId,
      username: currentUsername || "you",
      text,
      pending: true,
    };

    setSendingComment(true);
    setComments((items) => [...items, tempComment]);
    setCommentsCount((value) => value + 1);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/posts/${post.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to post comment.");
      }

      setComments((items) =>
        items.map((item) => (item.id === tempId ? data.comment : item))
      );

      if (typeof data.commentsCount === "number") {
        setCommentsCount(data.commentsCount);
      }
    } catch (error) {
      console.error("Add comment error:", error);

      // rollback
      setComments((items) => items.filter((item) => item.id !== tempId));
      setCommentsCount((value) => Math.max(0, value - 1));

      alert(error.message || "Unable to post comment.");
    } finally {
      setSendingComment(false);
    }
  }

  /* ---------- comments: delete ---------- */

  async function deleteComment(commentId) {
    const token = localStorage.getItem("token");

    if (!token) return;

    const previousComments = comments;
    const previousCount = commentsCount;

    setComments((items) => items.filter((item) => item.id !== commentId));
    setCommentsCount((value) => Math.max(0, value - 1));

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/posts/${post.id}/comments/${commentId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete comment.");
      }

      if (typeof data.commentsCount === "number") {
        setCommentsCount(data.commentsCount);
      }
    } catch (error) {
      console.error("Delete comment error:", error);

      setComments(previousComments);
      setCommentsCount(previousCount);

      alert(error.message || "Unable to delete comment.");
    }
  }

  /* ---------- navigation ---------- */

  function goToProfile() {
    window.location.assign(
      `/profile/${encodeURIComponent(post.username)}`
    );
  }

  /* ---------- carousel ---------- */

  function previousMedia() {
    if (mediaItems.length <= 1) return;

    setCurrentMedia(
      (value) => (value - 1 + mediaItems.length) % mediaItems.length
    );
  }

  function nextMedia() {
    if (mediaItems.length <= 1) return;

    setCurrentMedia((value) => (value + 1) % mediaItems.length);
  }

  function handleTouchStart(event) {
    if (mediaItems.length <= 1) return;

    const touch = event.touches?.[0];

    if (!touch) return;

    event.currentTarget.dataset.startX = touch.clientX;
  }

  function handleTouchEnd(event) {
    if (mediaItems.length <= 1) return;

    const startX = Number(event.currentTarget.dataset.startX);
    const touch = event.changedTouches?.[0];

    if (!startX || !touch) return;

    const difference = touch.clientX - startX;

    if (Math.abs(difference) < 45) return;

    if (difference > 0) {
      previousMedia();
    } else {
      nextMedia();
    }

    event.currentTarget.dataset.startX = "";
  }

  // The author was blocked from this post: remove it from the screen.
  // (Kept after every hook so React's hook order never changes.)
  if (hidden) return null;

  const currentItem = mediaItems[currentMedia];
  const currentUrl = currentItem?.url;
  const currentType = currentItem?.type || "image";

  return (
    <article className="post" ref={postRef}>
      <div className="post-header">
        <button
          type="button"
          className="post-user"
          onClick={goToProfile}
          aria-label={`Open ${post.username}'s profile`}
        >
          <img
            src={profileImageUrl}
            alt={`${post.username} profile`}
            className="post-profile-image"
          />

          <span className="post-user-info">
            <strong>{post.username}</strong>
            <span>{post.time}</span>
          </span>
        </button>

        {!isOwnPost && post.id && (
          <div className="post-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="post-menu-button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Post options"
              aria-expanded={menuOpen}
            >
              ⋮
            </button>

            {menuOpen && (
              <div className="post-menu">
                <button type="button" onClick={openReport}>
                  🚩 Report Post
                </button>

                <button type="button" onClick={openBlockConfirm}>
                  🚫 Block User
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {currentUrl && (
        <div
          className={`post-image-wrapper ${
            post.orientation === "portrait" ? "portrait-post" : ""
          }`}
          onDoubleClick={giveImpression}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="button"
          tabIndex={0}
          aria-label="Double tap or double click to give an impression"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              giveImpression();
            }
          }}
        >
          {currentType === "image" && (
            <img
              src={currentUrl}
              alt={`${post.caption || "Impressa post"} ${currentMedia + 1}`}
              className="post-image"
              draggable="false"
            />
          )}

          {currentType === "video" && (
            <video
              src={currentUrl}
              className="post-image"
              controls
              playsInline
              preload="metadata"
              onClick={(event) => event.stopPropagation()}
            />
          )}

          {mediaItems.length > 1 && (
            <>
              <button
                type="button"
                className="carousel-arrow carousel-prev"
                onClick={(event) => {
                  event.stopPropagation();
                  previousMedia();
                }}
                aria-label="Previous media"
              >
                ‹
              </button>

              <button
                type="button"
                className="carousel-arrow carousel-next"
                onClick={(event) => {
                  event.stopPropagation();
                  nextMedia();
                }}
                aria-label="Next media"
              >
                ›
              </button>

              <div className="carousel-dots" aria-label="Carousel position">
                {mediaItems.map((_, index) => (
                  <button
                    type="button"
                    key={index}
                    className={`carousel-dot ${
                      index === currentMedia ? "active" : ""
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCurrentMedia(index);
                    }}
                    aria-label={`Show media ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          <span
            key={impressionAnimation}
            className={`double-impression ${
              impressionAnimation ? "show" : ""
            }`}
            aria-hidden="true"
          >
            i
          </span>
        </div>
      )}

      <Action
        comments={commentsCount}
        impressions={impressions}
        impressed={impressed}
        onComment={toggleComments}
        onImpression={giveImpression}
        onShare={sharePost}
      />

      {hasMusic && (
        <div className="post-music">
          <span className="post-music-icon">♪</span>

          <div className="post-music-text">
            <strong>{music.title}</strong>
            <span>{music.artist}</span>
          </div>

          <audio ref={audioRef} preload="none" />
        </div>
      )}

      {post.caption && (
        <div className="post-caption">
          <strong>{post.username}</strong>
          <span>{post.caption}</span>
        </div>
      )}

      {commentsCount > 0 && !commentsOpen && (
        <button
          type="button"
          className="view-comments"
          onClick={toggleComments}
        >
          View {commentsCount === 1 ? "1 comment" : `all ${commentsCount} comments`}
        </button>
      )}

      {commentsOpen && (
        <CommentBox
          comments={comments}
          loading={commentsLoading}
          error={commentsError}
          sending={sendingComment}
          currentUsername={currentUsername}
          canModerate={Boolean(isOwnPost)}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
        />
      )}

      {/* Rendered on document.body so the post's own styles/animations
          can never trap or clip the full-screen dialogs. */}
      {createPortal(
        <>
          <ConfirmDialog
            open={blockConfirmOpen}
            title={`Block @${post.username}?`}
            message="You won't be able to find or interact with each other on Impressa."
            confirmLabel="Block"
            busy={blocking}
            onCancel={() => setBlockConfirmOpen(false)}
            onConfirm={confirmBlock}
          />

          <ReportModal
            open={reportOpen}
            type="post"
            target={post.id}
            onClose={() => setReportOpen(false)}
          />
        </>,
        document.body
      )}
    </article>
  );
}

export default Post;