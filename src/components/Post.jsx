import { useEffect, useRef, useState } from "react";

import Action from "./Action";

import "./Post.css";

/* =========================================================
   COMMENT BOX
========================================================= */

function CommentBox({ comments, onAddComment }) {
  const [text, setText] = useState("");

  function submitComment(event) {
    event.preventDefault();

    const value = text.trim();

    if (!value) return;

    onAddComment(value);
    setText("");
  }

  return (
    <div className="comment-box">
      <div className="comment-list">
        {comments.map((comment, index) => (
          <div
            className="comment-item"
            key={`${comment.id ?? index}-${index}`}
          >
            <div className="comment-avatar">
              {(comment.username || "u")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="comment-content">
              <strong>
                @{comment.username}
              </strong>

              <span>
                {comment.text}
              </span>
            </div>
          </div>
        ))}
      </div>

      <form
        className="comment-form"
        onSubmit={submitComment}
      >
        <input
          value={text}
          onChange={(event) =>
            setText(event.target.value)
          }
          placeholder="Add a comment..."
          aria-label="Add a comment"
          maxLength={500}
        />

        <button type="submit">
          Post
        </button>
      </form>
    </div>
  );
}

/* =========================================================
   IMPRESSA POST
========================================================= */

function Post({ post }) {
  /* ========================================================
     MEDIA
  ======================================================== */

  const mediaItems =
    post.media?.length
      ? post.media
      : post.postImages?.length
      ? post.postImages.map((url) => ({
          url,
          type: "image",
        }))
      : post.postImage
      ? [
          {
            url: post.postImage,
            type: "image",
          },
        ]
      : [];

  const [currentMedia, setCurrentMedia] =
    useState(0);

  const [commentsOpen, setCommentsOpen] =
    useState(false);

  const [impressions, setImpressions] =
    useState(
      post.impressions ??
        post.impressionsCount ??
        0
    );

  /* ========================================================
     IMPRESSION STATE
  ======================================================== */

  const [impressed, setImpressed] =
    useState(false);

  /* ========================================================
     CHECK IMPRESSION STATUS
  ======================================================== */

  useEffect(() => {
    const checkUserImpression = async () => {
      try {
        const token =
          localStorage.getItem("token");

        if (!token || !post.id) {
          return;
        }

        const API_URL =
          `http://${window.location.hostname}:5000`;

        const response = await fetch(
          `${API_URL}/api/posts/${post.id}/impression`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          console.error(
            "Check impression failed:",
            data
          );

          return;
        }

        setImpressed(
          data.impressed === true
        );
      } catch (error) {
        console.error(
          "Check impression error:",
          error
        );
      }
    };

    checkUserImpression();
  }, [post.id]);

  /* ========================================================
     COMMENTS
  ======================================================== */

  const [comments, setComments] =
    useState(
      post.comments?.length
        ? post.comments
        : [
            {
              id: `${post.id}-sample`,
              username: "impressa",
              text: "Nice impression ✨",
            },
          ]
    );

  const [impressionAnimation, setImpressionAnimation] =
    useState(0);

  /* ========================================================
     MUSIC
  ======================================================== */

  const audioRef = useRef(null);
  const postRef = useRef(null);

  const music = post.music;

  const hasMusic =
    Boolean(
      music?.audioUrl &&
      music?.title
    );

  /*
    Stop this post's music when another
    Impressa post starts playing.
  */

  useEffect(() => {
    if (!hasMusic) return;

    const postElement =
      postRef.current;

    const audio =
      audioRef.current;

    if (!postElement || !audio) {
      return;
    }

    const stopMusic = () => {
      if (!audio.paused) {
        audio.pause();
      }

      audio.currentTime = 0;
    };

    const playMusic = () => {
      window.dispatchEvent(
        new CustomEvent(
          "impressa:stop-other-music",
          {
            detail: {
              postId: post.id,
            },
          }
        )
      );

      if (
        audio.src !==
        music.audioUrl
      ) {
        audio.src =
          music.audioUrl;
      }

      const playPromise =
        audio.play();

      if (playPromise) {
        playPromise.catch(
          (error) => {
            console.log(
              "Post music autoplay was blocked:",
              error
            );
          }
        );
      }
    };

    const handleOtherMusic = (
      event
    ) => {
      if (
        event.detail?.postId !==
        post.id
      ) {
        stopMusic();
      }
    };

    window.addEventListener(
      "impressa:stop-other-music",
      handleOtherMusic
    );

    const observer =
      new IntersectionObserver(
        (entries) => {
          const entry =
            entries[0];

          if (
            entry.isIntersecting &&
            entry.intersectionRatio >=
              0.6
          ) {
            playMusic();
          } else {
            stopMusic();
          }
        },
        {
          threshold: [0, 0.6],
        }
      );

    observer.observe(
      postElement
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "impressa:stop-other-music",
        handleOtherMusic
      );

      stopMusic();
    };
  }, [
    hasMusic,
    music?.audioUrl,
    post.id,
  ]);

  /* ========================================================
     IMPRESSION TOGGLE
  ======================================================== */

  async function giveImpression() {
    try {
      const token =
        localStorage.getItem("token");

      if (!token) {
        console.error(
          "No login token found."
        );

        return;
      }

      const API_URL =
        `http://${window.location.hostname}:5000`;

      /* ==========================================
         REMOVE IMPRESSION
      ========================================== */

      if (impressed) {
        // ⚡ INSTANT UI UPDATE

        setImpressed(false);

        setImpressions((value) =>
          Math.max(0, value - 1)
        );

        setImpressionAnimation(
          (value) => value + 1
        );

        const response =
          await fetch(
            `${API_URL}/api/posts/${post.id}/impression`,
            {
              method: "DELETE",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          console.error(
            "Remove impression failed:",
            data
          );

          // 🔄 ROLLBACK IF SERVER FAILED

          setImpressed(true);

          setImpressions((value) =>
            value + 1
          );

          return;
        }

        // Sync with actual server count

        setImpressions(
          data.impressions
        );

        return;
      }

      /* ==========================================
         GIVE IMPRESSION
      ========================================== */

      // ⚡ INSTANT UI UPDATE

      setImpressed(true);

      setImpressions((value) =>
        value + 1
      );

      setImpressionAnimation(
        (value) => value + 1
      );

      const response =
        await fetch(
          `${API_URL}/api/posts/${post.id}/impression`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          "Give impression failed:",
          data
        );

        // 🔄 ROLLBACK IF SERVER FAILED

        setImpressed(false);

        setImpressions((value) =>
          Math.max(0, value - 1)
        );

        return;
      }

      // Sync with actual server count

      setImpressions(
        data.impressions
      );
    } catch (error) {
      console.error(
        "Impression error:",
        error
      );
    }
  }

  /* ========================================================
     SHARE
  ======================================================== */

  async function sharePost() {
    const shareData = {
      title:
        `Impressa • @${post.username}`,

      text:
        post.caption ||
        `Check out @${post.username}'s post on Impressa.`,

      url:
        `${window.location.origin}/post/${post.id}`,
    };

    try {
      if (
        navigator.share &&
        navigator.canShare?.(
          shareData
        )
      ) {
        await navigator.share(
          shareData
        );

        return;
      }

      if (navigator.share) {
        await navigator.share(
          shareData
        );

        return;
      }

      const shareText =
        `${shareData.text}\n${shareData.url}`;

      if (
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(
          shareText
        );

        window.alert(
          "Share link copied."
        );

        return;
      }

      window.prompt(
        "Copy this link to share:",
        shareData.url
      );
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }

      console.error(
        "Share failed:",
        error
      );
    }
  }

  /* ========================================================
     COMMENT
  ======================================================== */

  function addComment(text) {
    setComments(
      (items) => [
        ...items,
        {
          id:
            `${post.id}-${Date.now()}`,

          username:
            "you",

          text,
        },
      ]
    );
  }

  /* ========================================================
     PROFILE NAVIGATION
  ======================================================== */

  function goToProfile() {
    window.location.assign(
      `/profile/${encodeURIComponent(
        post.username
      )}`
    );
  }

  /* ========================================================
     CAROUSEL
  ======================================================== */

  function previousMedia() {
    if (
      mediaItems.length <= 1
    ) {
      return;
    }

    setCurrentMedia(
      (value) =>
        (
          value -
          1 +
          mediaItems.length
        ) %
        mediaItems.length
    );
  }

  function nextMedia() {
    if (
      mediaItems.length <= 1
    ) {
      return;
    }

    setCurrentMedia(
      (value) =>
        (
          value +
          1
        ) %
        mediaItems.length
    );
  }

  /* ========================================================
     MOBILE SWIPE
  ======================================================== */

  function handleTouchStart(
    event
  ) {
    if (
      mediaItems.length <= 1
    ) {
      return;
    }

    const touch =
      event.touches?.[0];

    if (!touch) {
      return;
    }

    event.currentTarget.dataset.startX =
      touch.clientX;
  }

  function handleTouchEnd(
    event
  ) {
    if (
      mediaItems.length <= 1
    ) {
      return;
    }

    const startX =
      Number(
        event.currentTarget
          .dataset.startX
      );

    const touch =
      event.changedTouches?.[0];

    if (
      !startX ||
      !touch
    ) {
      return;
    }

    const endX =
      touch.clientX;

    const difference =
      endX - startX;

    if (
      Math.abs(difference) <
      45
    ) {
      return;
    }

    if (difference > 0) {
      previousMedia();
    } else {
      nextMedia();
    }

    event.currentTarget.dataset.startX =
      "";
  }

  /* ========================================================
     CURRENT MEDIA
  ======================================================== */

  const currentItem =
    mediaItems[currentMedia];

  const currentUrl =
    typeof currentItem === "string"
      ? currentItem
      : currentItem?.url;

  const currentType =
    typeof currentItem === "string"
      ? "image"
      : currentItem?.type ||
        "image";

  /* ========================================================
     JSX
  ======================================================== */

  return (
    <article
      className="post"
      ref={postRef}
    >
      {/* =========================
          POST HEADER
      ========================= */}

      <div className="post-header">

        <button
          type="button"
          className="post-user"
          onClick={
            goToProfile
          }
          aria-label={`Open ${post.username}'s profile`}
        >
          <img
            src={post.profileImage}
            alt={`${post.username} profile`}
            className="post-profile-image"
          />

          <span className="post-user-info">

            <strong>
              {post.username}
            </strong>

            <span>
              {post.time}
            </span>

          </span>
        </button>

      </div>

      {/* =========================
          POST MEDIA
      ========================= */}

      {currentUrl && (
        <div
          className={`post-image-wrapper ${
            post.orientation ===
            "portrait"
              ? "portrait-post"
              : ""
          }`}
          onDoubleClick={
            giveImpression
          }
          onTouchStart={
            handleTouchStart
          }
          onTouchEnd={
            handleTouchEnd
          }
          role="button"
          tabIndex={0}
          aria-label="Double tap or double click to give an impression"
          onKeyDown={(event) => {
            if (
              event.key ===
                "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();
              giveImpression();
            }
          }}
        >
          {/* =========================
              IMAGE
          ========================= */}

          {currentType ===
            "image" && (
            <img
              src={currentUrl}
              alt={`${
                post.caption ||
                "Impressa post"
              } ${
                currentMedia + 1
              }`}
              className="post-image"
              draggable="false"
            />
          )}

          {/* =========================
              VIDEO
          ========================= */}

          {currentType ===
            "video" && (
            <video
              src={currentUrl}
              className="post-image"
              controls
              playsInline
              preload="metadata"
              onClick={(event) =>
                event.stopPropagation()
              }
            />
          )}

          {/* =========================
              CAROUSEL
          ========================= */}

          {mediaItems.length >
            1 && (
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

              <div
                className="carousel-dots"
                aria-label="Carousel position"
              >
                {mediaItems.map(
                  (_, index) => (
                    <button
                      type="button"
                      key={index}
                      className={`carousel-dot ${
                        index ===
                        currentMedia
                          ? "active"
                          : ""
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();

                        setCurrentMedia(
                          index
                        );
                      }}
                      aria-label={`Show media ${
                        index + 1
                      }`}
                    />
                  )
                )}
              </div>
            </>
          )}

          {/* =========================
              IMPRESSION ANIMATION
          ========================= */}

          <span
            key={
              impressionAnimation
            }
            className={`double-impression ${
              impressionAnimation
                ? "show"
                : ""
            }`}
            aria-hidden="true"
          >
            i
          </span>
        </div>
      )}

      {/* =========================
          MUSIC
      ========================= */}

      {hasMusic && (
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding:
              "9px 4px 2px",
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection:
                "column",
              gap: "2px",
            }}
          >
            <strong
              style={{
                color: "#333333",
                fontSize: "11px",
                fontWeight: "700",
                whiteSpace:
                  "nowrap",
                overflow:
                  "hidden",
                textOverflow:
                  "ellipsis",
              }}
            >
              🎵 {music.title}
            </strong>

            <span
              style={{
                color: "#999999",
                fontSize: "9px",
                whiteSpace:
                  "nowrap",
                overflow:
                  "hidden",
                textOverflow:
                  "ellipsis",
              }}
            >
              {music.artist}
            </span>
          </div>

          <audio
            ref={audioRef}
            preload="none"
          />
        </div>
      )}

      {/* =========================
          CAPTION
      ========================= */}

      <div className="post-caption">

        <strong>
          {post.username}
        </strong>

        <span>
          {post.caption}
        </span>

      </div>

      {/* =========================
          ACTIONS
      ========================= */}

      <Action
        comments={
          comments.length
        }

        impressions={
          impressions
        }

        impressed={
          impressed
        }

        onComment={() =>
          setCommentsOpen(
            (value) => !value
          )
        }

        onImpression={
          giveImpression
        }

        onShare={
          sharePost
        }
      />

      {/* =========================
          COMMENTS
      ========================= */}

      {commentsOpen && (
        <CommentBox
          comments={comments}
          onAddComment={
            addComment
          }
        />
      )}
    </article>
  );
}

export default Post;