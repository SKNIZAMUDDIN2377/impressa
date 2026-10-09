import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import Action from "./Action";
import ConfirmDialog from "./ConfirmDialog";
import ReportModal from "./ReportModal";
import { blockUser } from "../utils/safetyApi";
import { getCache, setCache } from "../utils/impressaCache";

import "./Post.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

// Set to false to load the original Cloudinary files again
const USE_CLOUDINARY_OPTIMIZATION = true;

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#E9E9E9"/>
      <circle cx="150" cy="115" r="55" fill="#C2C2C2"/>
      <path d="M150 188c-68 0-122 42-122 95v17h244v-17c0-53-54-95-122-95z" fill="#C2C2C2"/>
    </svg>`
  );

const CAPTION_MAX_LENGTH = 500;

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

/* ---------- Cloudinary delivery helpers ---------- */

function isCloudinaryUpload(url) {
  return (
    typeof url === "string" &&
    url.includes("res.cloudinary.com") &&
    url.includes("/upload/")
  );
}

// true when the URL already carries a transformation segment
function hasTransformation(url) {
  return /\/upload\/(?!v\d+\/)/.test(url);
}

function optimizeImageUrl(url) {
  if (
    !USE_CLOUDINARY_OPTIMIZATION ||
    !isCloudinaryUpload(url) ||
    hasTransformation(url)
  ) {
    return url;
  }

  return url.replace(
    "/upload/",
    "/upload/f_auto,q_auto,w_1280,c_limit/"
  );
}

function getVideoPoster(url) {
  if (
    !USE_CLOUDINARY_OPTIMIZATION ||
    !isCloudinaryUpload(url) ||
    hasTransformation(url)
  ) {
    return undefined;
  }

  return url
    .replace("/upload/", "/upload/so_0,q_auto,w_900,c_limit/")
    .replace(/\.[a-zA-Z0-9]{2,5}(\?.*)?$/, ".jpg");
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

/* ---------- caption cache helpers ----------
   After a caption is edited, the copies saved for instant loading
   (Home feed + the profile posts page) are updated too, so an old
   caption never flashes back when the page is opened again. */

function getHomeFeedCacheKey() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");

    const who = String(user?.username || user?.id || "me").toLowerCase();

    return `home_feed_v2_${who}`;
  } catch (error) {
    return "home_feed_v2_me";
  }
}

function patchCachedCaption(postId, caption) {
  if (!postId) return;

  // Home feed cache
  try {
    const feedKey = getHomeFeedCacheKey();

    const feed = getCache(feedKey);

    if (Array.isArray(feed) && feed.some((item) => item && item.id === postId)) {
      setCache(
        feedKey,
        feed.map((item) =>
          item && item.id === postId ? { ...item, caption } : item
        )
      );
    }
  } catch (error) {
    // cache is optional
  }

  // Profile posts page cache
  try {
    const name = getStoredUsername().toLowerCase();

    if (!name) return;

    const key = `impressa_profile_posts_page_${name}`;

    const raw = localStorage.getItem(key);

    if (!raw) return;

    const list = JSON.parse(raw);

    if (Array.isArray(list)) {
      localStorage.setItem(
        key,
        JSON.stringify(
          list.map((item) =>
            item && item.id === postId ? { ...item, caption } : item
          )
        )
      );
    }
  } catch (error) {
    // cache is optional
  }
}

/* ---------- copy text (used when the native share sheet is missing) ---------- */

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // fall through to the older method
  }

  try {
    const helper = document.createElement("textarea");

    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.top = "0";
    helper.style.left = "-9999px";
    helper.style.opacity = "0";

    document.body.appendChild(helper);

    helper.select();
    helper.setSelectionRange(0, text.length);

    const copied = document.execCommand("copy");

    document.body.removeChild(helper);

    return copied;
  } catch (error) {
    return false;
  }
}

/* =========================================================
   CAROUSEL: stable box shape
   The post box takes the shape of the FIRST media item
   (clamped between 4:5 portrait and 1.91:1 wide), so swiping
   between photos and videos never changes the post height.
========================================================= */

const DEFAULT_RATIO = 4 / 5;
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 1.91;

const clampRatio = (ratio) =>
  Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));

// Remembers measured media shapes so a revisit has no layout shift
const RATIO_STORAGE_KEY = "impressa_media_ratios_v1";
const RATIO_MAX_ENTRIES = 300;

const ratioMemory = new Map();

let ratiosLoaded = false;
let ratioSaveTimer = null;

function loadRatios() {
  if (ratiosLoaded) return;

  ratiosLoaded = true;

  try {
    const raw = JSON.parse(
      localStorage.getItem(RATIO_STORAGE_KEY) || "{}"
    );

    Object.entries(raw).forEach(([key, value]) => {
      if (typeof value === "number" && value > 0) {
        ratioMemory.set(key, value);
      }
    });
  } catch (error) {
    // ignore
  }
}

function ratioKey(url) {
  return String(url || "").split("?")[0].slice(-90);
}

function getStoredRatio(url) {
  loadRatios();

  return ratioMemory.get(ratioKey(url)) || null;
}

function storeRatio(url, ratio) {
  loadRatios();

  const key = ratioKey(url);

  ratioMemory.delete(key);
  ratioMemory.set(key, Math.round(ratio * 1000) / 1000);

  while (ratioMemory.size > RATIO_MAX_ENTRIES) {
    ratioMemory.delete(ratioMemory.keys().next().value);
  }

  clearTimeout(ratioSaveTimer);

  ratioSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        RATIO_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(ratioMemory))
      );
    } catch (error) {
      // ignore
    }
  }, 1000);
}

function getInitialRatio(firstItem) {
  if (!firstItem) return DEFAULT_RATIO;

  const width = Number(firstItem.width);
  const height = Number(firstItem.height);

  if (width > 0 && height > 0) {
    return clampRatio(width / height);
  }

  const stored = getStoredRatio(firstItem.url);

  return stored ? clampRatio(stored) : DEFAULT_RATIO;
}

/* =========================================================
   MEDIA CAROUSEL
   - touch drag follows the finger (no React state per move)
   - horizontal axis lock: vertical scrolling is never blocked
   - only the current slide and its neighbours are mounted
   - memoized: changing slides never re-renders the Post
   - the current video autoplays while the media is on screen
========================================================= */

const AXIS_LOCK_PX = 8;
const SWIPE_MIN_DISTANCE = 40;
const SWIPE_FRACTION = 0.2;
const SWIPE_VELOCITY = 0.45; // px per ms
const EDGE_RESISTANCE = 0.3;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE = 40;
const IMPRESSION_COOLDOWN_MS = 700;
const VIDEO_CONTROLS_ZONE = 56;
const SLIDE_TRANSITION = "transform 280ms cubic-bezier(0.22, 0.8, 0.3, 1)";

// Autoplay: a video starts when this much of the media box is on screen
// and stops again when it drops below the lower value.
const AUTOPLAY_ON_RATIO = 0.6;
const AUTOPLAY_OFF_RATIO = 0.35;

const MediaCarousel = memo(function MediaCarousel({
  items,
  caption,
  impressionAnimation,
  priority,
  onDoubleImpress,
  postId,
  mutedWithMusic,
}) {
  const count = items.length;

  const [index, setIndex] = useState(0);

  const [ratio, setRatio] = useState(() => getInitialRatio(items[0]));

  const wrapperRef = useRef(null);
  const trackRef = useRef(null);
  const indexRef = useRef(0);
  const mountedRef = useRef(false);
  const gestureRef = useRef(null);
  const lastTapRef = useRef({ t: 0, x: 0, y: 0 });
  const lastImpressionRef = useRef(0);
  const onDoubleImpressRef = useRef(onDoubleImpress);

  indexRef.current = index;
  onDoubleImpressRef.current = onDoubleImpress;

  const firstUrl = items[0]?.url;

  /* ---------- position the track (imperative, no re-render) ---------- */

  const applyTransform = useCallback((slideIndex, dragPx, animate) => {
    const track = trackRef.current;

    if (!track) return;

    track.style.transition = animate ? SLIDE_TRANSITION : "none";

    track.style.transform = dragPx
      ? `translate3d(calc(${-slideIndex * 100}% + ${dragPx}px), 0, 0)`
      : `translate3d(${-slideIndex * 100}%, 0, 0)`;
  }, []);

  useLayoutEffect(() => {
    applyTransform(index, 0, mountedRef.current);

    mountedRef.current = true;
  }, [index, applyTransform]);

  /* ---------- keep index valid if the media list changes ---------- */

  useEffect(() => {
    if (index > count - 1) {
      setIndex(Math.max(0, count - 1));
    }
  }, [count, index]);

  useEffect(() => {
    setRatio(getInitialRatio(items[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstUrl]);

  /* ---------- pause videos that are no longer on screen ---------- */

  useEffect(() => {
    const track = trackRef.current;

    if (!track) return;

    track.querySelectorAll("video").forEach((video) => {
      const slide = video.closest("[data-slide]");

      if (
        slide &&
        Number(slide.dataset.slide) !== index &&
        !video.paused
      ) {
        video.pause();
      }
    });
  }, [index]);

  /* ---------- autoplay: play the current video while the media is on screen ---------- */

  const hasItems = count > 0;

  const postIdRef = useRef(postId);
  const mutedWithMusicRef = useRef(mutedWithMusic);

  postIdRef.current = postId;
  mutedWithMusicRef.current = mutedWithMusic;

  const [inView, setInView] = useState(false);

  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || !document.hidden
  );

  const autoplayActive = inView && pageVisible;

  // Is the media box on screen?
  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];

        if (!entry) return;

        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= AUTOPLAY_ON_RATIO
        ) {
          setInView(true);
        } else if (
          !entry.isIntersecting ||
          entry.intersectionRatio < AUTOPLAY_OFF_RATIO
        ) {
          setInView(false);
        }
      },
      { threshold: [0, AUTOPLAY_OFF_RATIO, AUTOPLAY_ON_RATIO] }
    );

    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [hasItems]);

  // Browser tab hidden: stop. Tab visible again: autoplay can resume.
  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);

    document.addEventListener("visibilitychange", onVisibility);

    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Another post's video started: this post's videos stop.
  useEffect(() => {
    const pauseOnOtherVideo = (event) => {
      if (event.detail?.postId === postIdRef.current) return;

      trackRef.current?.querySelectorAll("video").forEach((video) => {
        if (!video.paused) video.pause();
      });
    };

    window.addEventListener("impressa:video-playing", pauseOnOtherVideo);

    return () =>
      window.removeEventListener("impressa:video-playing", pauseOnOtherVideo);
  }, []);

  // Play the current slide's video while on screen, pause everything otherwise.
  useEffect(() => {
    const track = trackRef.current;

    if (!track) return undefined;

    if (!autoplayActive) {
      track.querySelectorAll("video").forEach((video) => {
        if (!video.paused) video.pause();
      });

      return undefined;
    }

    const video = track.querySelector(`[data-slide="${index}"] video`);

    if (!video) return undefined;

    let cancelled = false;

    const announce = () => {
      if (cancelled) return;

      window.dispatchEvent(
        new CustomEvent("impressa:video-playing", {
          detail: { postId: postIdRef.current },
        })
      );

      if (!video.muted) {
        window.dispatchEvent(
          new CustomEvent("impressa:stop-other-music", {
            detail: { postId: postIdRef.current },
          })
        );
      }
    };

    // First start of this video: if the post has music, the music is the sound.
    if (!video.dataset.autoplayStarted) {
      video.dataset.autoplayStarted = "1";

      if (mutedWithMusicRef.current) video.muted = true;
    }

    const attempt = video.play();

    if (attempt && typeof attempt.then === "function") {
      attempt.then(announce).catch((error) => {
        // The browser blocks sound until the user has tapped the page:
        // fall back to a muted start (the video's own controls unmute it).
        if (cancelled || error?.name !== "NotAllowedError") return;

        video.muted = true;

        const retry = video.play();

        if (retry && typeof retry.then === "function") {
          retry.then(announce).catch(() => {});
        }
      });
    } else {
      announce();
    }

    return () => {
      cancelled = true;
    };
  }, [autoplayActive, index]);

  /* ---------- navigation ---------- */

  const goTo = useCallback(
    (next) => {
      const clamped = Math.min(count - 1, Math.max(0, next));

      if (clamped === indexRef.current) {
        // snap back to the current slide
        applyTransform(clamped, 0, true);
        return;
      }

      setIndex(clamped);
    },
    [count, applyTransform]
  );

  const fireImpression = useCallback(() => {
    const now = Date.now();

    // guards against touch double-tap + native dblclick both firing
    if (now - lastImpressionRef.current < IMPRESSION_COOLDOWN_MS) {
      return;
    }

    lastImpressionRef.current = now;

    onDoubleImpressRef.current?.();
  }, []);

  /* ---------- touch / pen gestures ---------- */

  const handlePointerDown = (event) => {
    // mouse users have arrows, dots and double-click
    if (event.pointerType === "mouse") return;

    if (gestureRef.current) return;

    const target = event.target;

    if (target.closest && target.closest("button")) return;

    // leave the video's control bar alone
    if (target.tagName === "VIDEO") {
      const rect = target.getBoundingClientRect();

      if (event.clientY > rect.bottom - VIDEO_CONTROLS_ZONE) return;
    }

    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    gestureRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startT: performance.now(),
      lastX: event.clientX,
      lastT: performance.now(),
      velocity: 0,
      axis: null,
      width: wrapper.clientWidth || 1,
      dx: 0,
    };
  };

  const handlePointerMove = (event) => {
    const gesture = gestureRef.current;

    if (!gesture || event.pointerId !== gesture.id) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (gesture.axis === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) {
        return;
      }

      gesture.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";

      if (gesture.axis === "x" && count > 1) {
        try {
          wrapperRef.current?.setPointerCapture(event.pointerId);
        } catch (error) {
          // ignore
        }

        wrapperRef.current?.classList.add("is-dragging");
      }
    }

    if (gesture.axis !== "x" || count <= 1) return;

    const now = performance.now();

    const dt = now - gesture.lastT;

    if (dt > 0) {
      const instant = (event.clientX - gesture.lastX) / dt;

      gesture.velocity = gesture.velocity * 0.4 + instant * 0.6;
    }

    gesture.lastX = event.clientX;
    gesture.lastT = now;
    gesture.dx = dx;

    const current = indexRef.current;

    let offset = dx;

    if ((current === 0 && dx > 0) || (current === count - 1 && dx < 0)) {
      offset = dx * EDGE_RESISTANCE;
    }

    applyTransform(current, offset, false);
  };

  const finishGesture = (event, cancelled) => {
    const gesture = gestureRef.current;

    if (!gesture || event.pointerId !== gesture.id) return;

    gestureRef.current = null;

    const wrapper = wrapperRef.current;

    wrapper?.classList.remove("is-dragging");

    try {
      wrapper?.releasePointerCapture?.(event.pointerId);
    } catch (error) {
      // ignore
    }

    // ----- horizontal swipe -----
    if (gesture.axis === "x" && count > 1) {
      const current = indexRef.current;

      let next = current;

      if (!cancelled) {
        const dx = gesture.dx;

        const velocity =
          performance.now() - gesture.lastT < 100 ? gesture.velocity : 0;

        const threshold = Math.max(
          SWIPE_MIN_DISTANCE,
          gesture.width * SWIPE_FRACTION
        );

        if (dx <= -threshold || (velocity <= -SWIPE_VELOCITY && dx < -10)) {
          next = current + 1;
        } else if (dx >= threshold || (velocity >= SWIPE_VELOCITY && dx > 10)) {
          next = current - 1;
        }
      }

      goTo(next);

      return;
    }

    // ----- vertical scroll: the browser handles it -----
    if (gesture.axis === "y" || cancelled) return;

    // ----- tap: detect double tap -----
    const now = Date.now();

    const last = lastTapRef.current;

    if (
      now - last.t < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - last.x, event.clientY - last.y) <
        DOUBLE_TAP_DISTANCE
    ) {
      lastTapRef.current = { t: 0, x: 0, y: 0 };

      fireImpression();
    } else {
      lastTapRef.current = {
        t: now,
        x: event.clientX,
        y: event.clientY,
      };
    }
  };

  const handleKeyDown = (event) => {
    // keys pressed on the arrow / dot buttons must keep their own behavior
    if (event.target !== event.currentTarget) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fireImpression();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(indexRef.current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(indexRef.current + 1);
    }
  };

  /* ---------- measure the first item to set the box shape ---------- */

  const handleFirstMeasured = (width, height) => {
    if (!width || !height || !items[0]) return;

    const natural = width / height;

    storeRatio(items[0].url, natural);

    const next = clampRatio(natural);

    setRatio((current) =>
      Math.abs(current - next) < 0.005 ? current : next
    );
  };

  if (count === 0) return null;

  return (
    <div
      ref={wrapperRef}
      className="post-image-wrapper"
      style={{ "--post-ratio": ratio }}
      onDoubleClick={fireImpression}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishGesture(event, false)}
      onPointerCancel={(event) => finishGesture(event, true)}
      role="button"
      tabIndex={0}
      aria-label="Double tap or double click to give an impression. Swipe or use arrow keys for more media."
      onKeyDown={handleKeyDown}
    >
      <div className="carousel-track" ref={trackRef}>
        {items.map((item, slideIndex) => {
          const isNear = Math.abs(slideIndex - index) <= 1;

          return (
            <div
              className="carousel-slide"
              key={`${slideIndex}-${item.url}`}
              data-slide={slideIndex}
              aria-hidden={slideIndex !== index}
            >
              {isNear && item.type === "video" && (
                <video
                  src={item.url}
                  poster={item.poster}
                  className="post-video"
                  controls
                  playsInline
                  preload={slideIndex === index ? "metadata" : "none"}
                  onClick={(event) => event.stopPropagation()}
                  onLoadedMetadata={
                    slideIndex === 0
                      ? (event) =>
                          handleFirstMeasured(
                            event.currentTarget.videoWidth,
                            event.currentTarget.videoHeight
                          )
                      : undefined
                  }
                />
              )}

              {isNear && item.type !== "video" && (
                <img
                  src={item.url}
                  alt={`${caption || "Impressa post"} ${slideIndex + 1}`}
                  className="post-image"
                  draggable="false"
                  loading={priority && slideIndex === 0 ? "eager" : "lazy"}
                  fetchPriority={
                    priority && slideIndex === 0 ? "high" : undefined
                  }
                  decoding="async"
                  onLoad={
                    slideIndex === 0
                      ? (event) =>
                          handleFirstMeasured(
                            event.currentTarget.naturalWidth,
                            event.currentTarget.naturalHeight
                          )
                      : undefined
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {count > 1 && index > 0 && (
        <button
          type="button"
          className="carousel-arrow carousel-prev"
          onClick={(event) => {
            event.stopPropagation();
            goTo(index - 1);
          }}
          aria-label="Previous media"
        >
          ‹
        </button>
      )}

      {count > 1 && index < count - 1 && (
        <button
          type="button"
          className="carousel-arrow carousel-next"
          onClick={(event) => {
            event.stopPropagation();
            goTo(index + 1);
          }}
          aria-label="Next media"
        >
          ›
        </button>
      )}

      {count > 1 && (
        <div className="carousel-dots" aria-label="Carousel position">
          {items.map((_, dotIndex) => (
            <button
              type="button"
              key={dotIndex}
              className={`carousel-dot ${
                dotIndex === index ? "active" : ""
              }`}
              onClick={(event) => {
                event.stopPropagation();
                goTo(dotIndex);
              }}
              aria-label={`Show media ${dotIndex + 1}`}
            />
          ))}
        </div>
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
  );
});

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

function Post({ post, priority = false }) {
  const navigate = useNavigate();

  const mediaItems = useMemo(() => {
    const rawMediaItems = post.media?.length
      ? post.media
      : post.postImages?.length
      ? post.postImages.map((url) => ({ url, type: "image" }))
      : post.postImage
      ? [{ url: post.postImage, type: "image" }]
      : [];

    return rawMediaItems
      .map((item) => {
        if (typeof item === "string") {
          return {
            url: optimizeImageUrl(normalizeUrl(item)),
            type: "image",
          };
        }

        const type = item?.type || "image";

        const url = normalizeUrl(item?.url);

        return {
          ...item,
          type,
          url: type === "image" ? optimizeImageUrl(url) : url,
          poster: type === "video" ? getVideoPoster(url) : undefined,
        };
      })
      .filter((item) => Boolean(item.url));
  }, [post.media, post.postImages, post.postImage]);

  const profileImageUrl =
    normalizeUrl(post.profileImage) || DEFAULT_AVATAR;

  const currentUsername = useMemo(() => getStoredUsername(), []);

  const [impressions, setImpressions] = useState(
    post.impressions ?? post.impressionsCount ?? 0
  );

  const [impressed, setImpressed] = useState(post.impressed === true);

  const [impressionAnimation, setImpressionAnimation] = useState(0);

  const impressionPendingRef = useRef(false);

  // ---------------- CAPTION (editable by the post owner) ----------------

  const [caption, setCaption] = useState(post.caption || "");
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);
  const [captionError, setCaptionError] = useState("");

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

  /* ---------- keep counts in sync when fresh feed data arrives ---------- */

  useEffect(() => {
    if (typeof post.impressed === "boolean") {
      setImpressed(post.impressed);
    }
  }, [post.impressed]);

  useEffect(() => {
    setImpressions(post.impressions ?? post.impressionsCount ?? 0);
  }, [post.impressions, post.impressionsCount]);

  useEffect(() => {
    setCommentsCount(post.commentsCount ?? 0);
  }, [post.commentsCount]);

  useEffect(() => {
    setCaption(post.caption || "");
  }, [post.caption]);

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

  /* ---------- check if I already gave an impression ----------
     Skipped when the feed already told us (post.impressed). */

  useEffect(() => {
    if (typeof post.impressed === "boolean") return;

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
  }, [post.id, post.impressed]);

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

  // Stable function for the memoized carousel: always calls the latest
  // giveImpression, so double-taps never use stale state.
  const giveImpressionRef = useRef(giveImpression);

  giveImpressionRef.current = giveImpression;

  const handleDoubleImpress = useCallback(() => {
    giveImpressionRef.current();
  }, []);

  /* ---------- share ----------
     1) native share sheet (phones)
     2) otherwise copy the post link
     A failure of the native sheet no longer ends silently: the link
     is copied instead. Closing the sheet yourself does nothing. */

  async function sharePost() {
    if (!post.id) return;

   const publicOrigin =
  import.meta.env.VITE_PUBLIC_URL || window.location.origin;

const shareUrl = `${publicOrigin.replace(/\/$/, "")}/post/${post.id}`;

    const shareData = {
      title: `Impressa • @${post.username}`,
      text:
        caption || `Check out @${post.username}'s post on Impressa.`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        // the person closed the share sheet: nothing more to do
        if (error?.name === "AbortError") return;

        console.error("Native share failed, copying the link:", error);
      }
    }

    const copied = await copyToClipboard(shareUrl);

    if (copied) {
      window.alert("Post link copied.");
      return;
    }

    window.prompt("Copy this link to share:", shareUrl);
  }

  /* ---------- caption: edit ---------- */

  function openEditCaption() {
    setMenuOpen(false);
    setCaptionDraft(caption);
    setCaptionError("");
    setEditingCaption(true);
  }

  function cancelEditCaption() {
    if (savingCaption) return;

    setEditingCaption(false);
    setCaptionError("");
  }

  async function saveCaption() {
    if (savingCaption) return;

    const nextCaption = captionDraft.trim();

    if (nextCaption === caption.trim()) {
      setEditingCaption(false);
      setCaptionError("");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setCaptionError("Please sign in again.");
      return;
    }

    setSavingCaption(true);
    setCaptionError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/posts/${post.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ caption: nextCaption }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch (parseError) {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.message || "Unable to update caption.");
      }

      const savedCaption =
        typeof data.caption === "string" ? data.caption : nextCaption;

      setCaption(savedCaption);

      patchCachedCaption(post.id, savedCaption);

      setEditingCaption(false);
    } catch (error) {
      console.error("Update caption error:", error);

      setCaptionError(error.message || "Unable to update caption.");
    } finally {
      setSavingCaption(false);
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

  /* ---------- navigation (no full page reload) ---------- */

  function goToProfile() {
    navigate(`/profile/${encodeURIComponent(post.username)}`);
  }

  // The author was blocked from this post: remove it from the screen.
  // (Kept after every hook so React's hook order never changes.)
  if (hidden) return null;

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
            loading={priority ? "eager" : "lazy"}
            decoding="async"
          />

          <span className="post-user-info">
            <strong className="post-user-name">
              <span className="post-user-name-text">{post.username}</span>

              {/* Same verified tick the Search page uses (.official-badge).
                  Only accounts the server marks as official get it. */}
              {post.isOfficial === true && (
                <i
                  className="official-badge"
                  title="Official Impressa account"
                  role="img"
                  aria-label="Official Impressa account"
                />
              )}
            </strong>

            <span>{post.time}</span>
          </span>
        </button>

        {post.id && (
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
                {isOwnPost ? (
                  <button type="button" onClick={openEditCaption}>
                    ✏️ Edit Caption
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={openReport}>
                      🚩 Report Post
                    </button>

                    <button type="button" onClick={openBlockConfirm}>
                      🚫 Block User
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {mediaItems.length > 0 && (
        <MediaCarousel
          items={mediaItems}
          caption={caption}
          impressionAnimation={impressionAnimation}
          priority={priority}
          onDoubleImpress={handleDoubleImpress}
          postId={post.id}
          mutedWithMusic={hasMusic}
        />
      )}

      <Action
        comments={commentsCount}
        impressions={impressions}
        impressed={impressed}
        onComment={toggleComments}
         pulseKey={impressionAnimation}
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

      {editingCaption ? (
        <div className="post-caption-edit">
          <textarea
            value={captionDraft}
            onChange={(event) => setCaptionDraft(event.target.value)}
            maxLength={CAPTION_MAX_LENGTH}
            rows={3}
            autoFocus
            disabled={savingCaption}
            placeholder="Write a caption..."
            aria-label="Edit caption"
          />

          {captionError && (
            <p className="post-caption-error" role="alert">
              {captionError}
            </p>
          )}

          <div className="post-caption-actions">
            <span className="post-caption-count">
              {captionDraft.length}/{CAPTION_MAX_LENGTH}
            </span>

            <button
              type="button"
              className="post-caption-cancel"
              onClick={cancelEditCaption}
              disabled={savingCaption}
            >
              Cancel
            </button>

            <button
              type="button"
              className="post-caption-save"
              onClick={saveCaption}
              disabled={
                savingCaption ||
                captionDraft.trim() === caption.trim()
              }
            >
              {savingCaption ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        caption && (
          <div className="post-caption">
            <strong>{post.username}</strong>
            <span>{caption}</span>
          </div>
        )
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

export default memo(Post);