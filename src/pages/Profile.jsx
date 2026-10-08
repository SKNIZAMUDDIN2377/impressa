import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import "./Profile.css";
import "./ProfileExtras.css";
import BadgeAnimation from "../components/BadgeAnimation";
import ConfirmDialog from "../components/ConfirmDialog";
import ReportModal from "../components/ReportModal";
import { blockUser } from "../utils/safetyApi";
import { getStoredTheme, setTheme } from "../utils/theme";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

// Set to false if you ever want the grid to load original images
const USE_CLOUDINARY_THUMBS = true;

// How long the big star stays on screen (must match starViewerLife in
// ProfileExtras.css)
const STAR_VIEWER_MS = 4600;

// ==========================================
// DEFAULT PROFILE PICTURE
// Neutral silhouette (never a real person's photo)
// ==========================================

const DEFAULT_PROFILE_PIC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#E9E9E9"/>
      <circle cx="150" cy="115" r="55" fill="#C2C2C2"/>
      <path d="M150 188c-68 0-122 42-122 95v17h244v-17c0-53-54-95-122-95z" fill="#C2C2C2"/>
    </svg>`
  );

const POST_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#F4EEE8"/></svg>`
  );

// ==========================================
// CROP SETTINGS
// ==========================================

const CROP_OUTPUT_SIZE = 512;
const CROP_MAX_ZOOM = 3;

// ==========================================
// STORED USER (parsed once per change, not every render)
// ==========================================

let storedUserRaw = null;
let storedUserParsed = null;

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");

    if (raw !== storedUserRaw) {
      storedUserRaw = raw;
      storedUserParsed = raw ? JSON.parse(raw) : null;
    }

    return storedUserParsed;
  } catch (error) {
    return null;
  }
};

// Keeps localStorage "user" in step with the server's copy of the
// logged-in user, so other pages that read it (name, avatar, badge)
// never show a stale profile picture. Only runs when the usernames
// match, so it can never overwrite a different account.
const syncStoredUser = (user) => {
  if (!user) return;

  try {
    const raw = localStorage.getItem("user");

    if (!raw) return;

    const current = JSON.parse(raw);

    if (!current) return;

    if (
      String(current.username || "").toLowerCase() !==
      String(user.username || "").toLowerCase()
    ) {
      return;
    }

    const next = {
      ...current,
      id: user.id ?? current.id,
      name: user.name ?? current.name,
      username: user.username ?? current.username,
      bio: user.bio ?? current.bio,
      profilePicture: user.profilePicture ?? current.profilePicture,
      badge: user.badge ?? current.badge,
    };

    const nextRaw = JSON.stringify(next);

    if (nextRaw !== raw) {
      localStorage.setItem("user", nextRaw);
    }
  } catch (error) {
    // ignore
  }
};

// ==========================================
// SAFE PROFILE CACHE
// - never throws (storage can be full or blocked)
// - keeps only the 10 most recently viewed profiles
// - posts are cached as thumbnails only
// ==========================================

const CACHE_VERSION_KEY = "impressa_pcache_version";
const CACHE_INDEX_KEY = "impressa_pcache_index";
const CACHE_MAX_PROFILES = 10;
const CACHE_MAX_ITEM_CHARS = 300000;

const profileKey = (name) => `impressa_profile_${name}`;
const postsKey = (name) => `impressa_profile_posts_${name}`;
const postsPageKey = (name) => `impressa_profile_posts_page_${name}`;

// One-time cleanup of the old, oversized cache entries that
// were filling localStorage.
const runLegacyCachePurge = () => {
  try {
    if (localStorage.getItem(CACHE_VERSION_KEY) === "2") return;

    const doomed = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);

      if (key && key.startsWith("impressa_profile_")) {
        doomed.push(key);
      }
    }

    doomed.forEach((key) => localStorage.removeItem(key));

    localStorage.setItem(CACHE_VERSION_KEY, "2");
  } catch (error) {
    // ignore
  }
};

runLegacyCachePurge();

const safeGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
};

const readCacheIndex = () => {
  const value = safeGet(CACHE_INDEX_KEY, []);
  return Array.isArray(value) ? value : [];
};

const removeProfileCache = (name) => {
  if (!name) return;

  const key = String(name).toLowerCase();

  try {
    localStorage.removeItem(profileKey(key));
    localStorage.removeItem(postsKey(key));
    localStorage.removeItem(postsPageKey(key));
  } catch (error) {
    // ignore
  }
};

// The "posts" page keeps its own cached copy of the posts. When the
// profile picture changes that copy must go, or it keeps showing the
// old picture.
const removePostsPageCache = (name) => {
  if (!name) return;

  try {
    localStorage.removeItem(postsPageKey(String(name).toLowerCase()));
  } catch (error) {
    // ignore
  }
};

const touchCacheIndex = (name) => {
  const key = String(name).toLowerCase();

  let index = readCacheIndex().filter((entry) => entry !== key);

  index.unshift(key);

  const evicted = index.slice(CACHE_MAX_PROFILES);

  index = index.slice(0, CACHE_MAX_PROFILES);

  evicted.forEach(removeProfileCache);

  try {
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    // ignore
  }
};

const safeWrite = (key, value) => {
  let text;

  try {
    text = JSON.stringify(value);
  } catch (error) {
    return false;
  }

  if (text.length > CACHE_MAX_ITEM_CHARS) return false;

  try {
    localStorage.setItem(key, text);
    return true;
  } catch (error) {
    // Storage is full: drop the older half of cached profiles and retry once
    try {
      const index = readCacheIndex();
      const keep = index.slice(0, Math.floor(index.length / 2));

      index.slice(keep.length).forEach(removeProfileCache);

      localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(keep));
      localStorage.setItem(key, text);

      return true;
    } catch (retryError) {
      return false;
    }
  }
};

const compactPost = (post) => ({
  _id: post?._id,
  media:
    Array.isArray(post?.media) && post.media.length > 0
      ? [post.media[0]]
      : [],
});

const getCachedProfile = (username) => {
  if (!username) return null;

  return safeGet(profileKey(username.toLowerCase()), null);
};

const getCachedPosts = (username) => {
  if (!username) return [];

  const posts = safeGet(postsKey(username.toLowerCase()), []);

  return Array.isArray(posts) ? posts.map(compactPost) : [];
};

const cacheProfile = (username, user) => {
  if (!username || !user) return;

  const key = username.toLowerCase();

  if (safeWrite(profileKey(key), user)) {
    touchCacheIndex(key);
  } else {
    // Could not store the fresh copy: never leave an older one behind,
    // or it would bring back an old profile picture on the next visit.
    try {
      localStorage.removeItem(profileKey(key));
    } catch (error) {
      // ignore
    }
  }
};

const cachePosts = (username, posts) => {
  if (!username) return;

  const key = username.toLowerCase();

  if (safeWrite(postsKey(key), posts.map(compactPost))) {
    touchCacheIndex(key);
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
        timeoutMs: attempt === 0 ? 15000 : 30000,
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

// ==========================================
// MEDIA HELPERS
// ==========================================

const resolveMediaUrl = (media) => {
  let url =
    typeof media === "string"
      ? media
      : media?.url || media?.path || media?.src;

  if (!url) return "";

  if (url.startsWith("/")) {
    url = `${API_BASE_URL}${url}`;
  }

  if (url.startsWith("http://localhost:5000")) {
    url = url.replace("http://localhost:5000", API_BASE_URL);
  }

  return url;
};

const isVideoMedia = (media, url) =>
  media?.type === "video" ||
  media?.resourceType === "video" ||
  media?.resource_type === "video" ||
  /\/video\/upload\//.test(url) ||
  /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);

// Small square thumbnail for the grid (Cloudinary only).
// Original files are untouched.
const getThumbUrl = (media) => {
  const url = resolveMediaUrl(media);

  if (!url) return POST_PLACEHOLDER;

  if (
    !USE_CLOUDINARY_THUMBS ||
    !url.includes("res.cloudinary.com") ||
    !url.includes("/upload/")
  ) {
    return url;
  }

  if (isVideoMedia(media, url)) {
    return url
      .replace(
        "/upload/",
        "/upload/so_0,w_400,h_400,c_fill,q_auto,f_jpg/"
      )
      .replace(/\.[a-z0-9]{2,5}(\?.*)?$/i, ".jpg");
  }

  return url.replace(
    "/upload/",
    "/upload/w_400,h_400,c_fill,q_auto,f_auto/"
  );
};


// ==========================================
// PROFILE (wrapper)
// A fresh ProfileView is mounted for every different profile,
// so state from User A can never leak into User B.
// ==========================================

function Profile() {
  const { username: routeUsername } = useParams();

  return (
    <ProfileView
      key={(routeUsername || "me").toLowerCase()}
      routeUsername={routeUsername}
    />
  );
}


function ProfileView({ routeUsername }) {

  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };


  /*
  ============================================================
  PROFILE TYPE + BACKEND PROFILE DATA
  */

  const storedUser = getStoredUser();

  const loggedInUsername =
    storedUser?.username || "";

  const isOwnProfile =
    !routeUsername ||
    routeUsername.toLowerCase() ===
      loggedInUsername.toLowerCase();

  const viewedUsername =
    routeUsername || loggedInUsername;

  const cacheName = viewedUsername
    ? viewedUsername.toLowerCase()
    : "";

  // Stable identity of "what is being loaded". It does NOT change when
  // the logged-in user renames themselves, so a rename never causes a
  // needless refetch of profile / posts / i-Notes.
  const profileRequestKey = isOwnProfile
    ? "own"
    : `user:${viewedUsername.toLowerCase()}`;

  const initialRef = useRef(null);

  if (initialRef.current === null) {
    initialRef.current = {
      profile: getCachedProfile(cacheName),
      posts: getCachedPosts(cacheName),
    };
  }

  const initialCache = initialRef.current;

  const [profileData, setProfileData] =
    useState(initialCache.profile);

  const [profilePosts, setProfilePosts] =
    useState(initialCache.posts);

  const [profileLoading, setProfileLoading] =
    useState(!initialCache.profile);

  const [profileError, setProfileError] =
    useState("");

  // "auth" | "retry" | "none"
  const [profileErrorKind, setProfileErrorKind] =
    useState("");

  const [postsLoading, setPostsLoading] =
    useState(initialCache.posts.length === 0);

  const [postsError, setPostsError] =
    useState(false);

  const [reloadTick, setReloadTick] = useState(0);

  const [postsReloadTick, setPostsReloadTick] = useState(0);

  const [notesReloadTick, setNotesReloadTick] = useState(0);

  const [slowLoad, setSlowLoad] = useState(false);

  // Set when the server says this profile does not exist / is blocked,
  // so a late posts response can never re-cache it.
  const profileUnavailableRef = useRef(false);

  const [followed, setFollowed] = useState(
    () =>
      !isOwnProfile &&
      initialCache.profile?.isFollowing === true
  );

  // Whose posts to load. For your own profile the server's username wins
  // once known; otherwise the stored / route username is used straight
  // away so posts load in parallel with the profile.
  const postsName = String(
    (isOwnProfile ? profileData?.username : "") ||
      viewedUsername ||
      profileData?.username ||
      ""
  ).toLowerCase();

  useEffect(() => {
    if (!profileLoading || profileData) {
      setSlowLoad(false);
      return undefined;
    }

    const timer = setTimeout(() => setSlowLoad(true), 6000);

    return () => clearTimeout(timer);
  }, [profileLoading, profileData]);

  // ----------------------------------------------------------
  // LOAD PROFILE (cancellable)
  // ----------------------------------------------------------

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (isOwnProfile && !token) {
      navigate("/signin", { replace: true });
      return undefined;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const headers = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    const cachedBefore = getCachedProfile(cacheName);

    const hadCachedProfile = !!cachedBefore;

    profileUnavailableRef.current = false;

    const checkFollowStatusFallback = async () => {
      if (!token) return;

      try {
        const result = await fetchJson(
          `${API_BASE_URL}/api/follow/status/${encodeURIComponent(
            viewedUsername
          )}`,
          { headers, signal, timeoutMs: 15000 }
        );

        if (signal.aborted) return;

        if (result.ok) {
          setFollowed(result.data.following === true);
        }
      } catch (error) {
        // follow state is non-critical
      }
    };

    const run = async () => {
      setProfileError("");
      setProfileErrorKind("");

      try {
        const profileUrl = isOwnProfile
          ? `${API_BASE_URL}/api/profile/me`
          : `${API_BASE_URL}/api/profile/${encodeURIComponent(
              viewedUsername
            )}`;

        const result = await getWithRetry(
          profileUrl,
          headers,
          signal
        );

        if (signal.aborted) return;

        if (!result.ok) {
          const loadError = new Error(
            result.data.message || "Failed to load profile"
          );

          loadError.status = result.status;

          throw loadError;
        }

        const user = result.data?.user;

        if (!user) {
          throw new Error("Failed to load profile");
        }

        // Picture changed since the last cached copy: the posts page's
        // own cache would still show the old one, so drop it.
        if (
          cachedBefore &&
          (cachedBefore.profilePicture || "") !==
            (user.profilePicture || "")
        ) {
          removePostsPageCache(cacheName);
        }

        setProfileData(user);
        cacheProfile(cacheName, user);

        if (isOwnProfile) {
          syncStoredUser(user);
        } else if (typeof user.isFollowing === "boolean") {
          setFollowed(user.isFollowing);
        } else {
          checkFollowStatusFallback();
        }

        setProfileLoading(false);
      } catch (error) {
        if (error.code === "aborted" || signal.aborted) return;

        console.error("Profile fetch error:", error);

        if (error.status === 404) {
          // Deleted, not found, or blocked: never show a stale cached copy
          profileUnavailableRef.current = true;

          removeProfileCache(cacheName);

          setProfileData(null);
          setProfilePosts([]);
          setPostsLoading(false);
          setProfileError("This profile isn't available.");
          setProfileErrorKind("none");
        } else if (error.status === 401) {
          // The token is no longer valid: clear it so sign-in starts clean
          localStorage.removeItem("token");
          localStorage.removeItem("user");

          setProfileData(null);
          setPostsLoading(false);
          setProfileError(
            "Your session has expired. Please sign in again."
          );
          setProfileErrorKind("auth");
        } else if (!hadCachedProfile) {
          setProfileError(
            error.code === "timeout"
              ? "The server is taking too long to respond. Please try again."
              : error.code === "network"
              ? "Unable to reach Impressa server. Check your connection and try again."
              : error.message || "Unable to load profile."
          );
          setProfileErrorKind("retry");
          setPostsLoading(false);
        }
      } finally {
        if (!signal.aborted) {
          setProfileLoading(false);
        }
      }
    };

    run();

    return () => controller.abort();
  }, [profileRequestKey, reloadTick]);

  // ----------------------------------------------------------
  // LOAD POSTS (parallel with the profile, own retry)
  // ----------------------------------------------------------

  useEffect(() => {
    if (!postsName) return undefined;

    const token = localStorage.getItem("token");

    if (isOwnProfile && !token) return undefined;

    const controller = new AbortController();
    const { signal } = controller;

    const headers = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    const loadPosts = async () => {
      setPostsError(false);

      try {
        const result = await getWithRetry(
          `${API_BASE_URL}/api/profile/${encodeURIComponent(
            postsName
          )}/posts?compact=1`,
          headers,
          signal
        );

        if (signal.aborted || profileUnavailableRef.current) return;

        if (result.ok) {
          const fresh = (result.data.posts || []).map(compactPost);

          setProfilePosts(fresh);
          cachePosts(postsName, fresh);
        } else if (result.status === 404) {
          setProfilePosts([]);
        } else {
          setPostsError(true);
        }
      } catch (error) {
        if (error.code === "aborted" || signal.aborted) return;

        console.error("Profile posts fetch error:", error);
        setPostsError(true);
      } finally {
        if (!signal.aborted) {
          setPostsLoading(false);
        }
      }
    };

    loadPosts();

    return () => controller.abort();
  }, [postsName, postsReloadTick]);

  // ----------------------------------------------------------
  // LOAD i-NOTES
  // Starts as soon as the page opens (in parallel with the profile
  // and posts) instead of waiting for the i-Notes tab to be tapped.
  // One request per profile; no request when the tab is never needed
  // again because the result is kept in state.
  // ----------------------------------------------------------

  // "loading" | "ready" | "error"
  const [notes, setNotes] = useState([]);

  const [notesStatus, setNotesStatus] = useState("loading");

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setNotes([]);
      setNotesStatus("ready");
      return undefined;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const loadNotes = async () => {
      setNotesStatus("loading");

      try {
        const notesUrl = isOwnProfile
          ? `${API_BASE_URL}/api/notes`
          : `${API_BASE_URL}/api/notes/user/${encodeURIComponent(
              viewedUsername
            )}`;

        const result = await getWithRetry(
          notesUrl,
          { Authorization: `Bearer ${token}` },
          signal
        );

        if (signal.aborted) return;

        if (result.ok) {
          setNotes(
            (result.data.notes || []).map((note) => ({
              id: note._id,
              text: note.text,
            }))
          );

          setNotesStatus("ready");
        } else if (result.status === 404) {
          setNotes([]);
          setNotesStatus("ready");
        } else {
          setNotesStatus("error");
        }
      } catch (error) {
        if (error.code === "aborted" || signal.aborted) return;

        console.error("Load i-Notes error:", error);

        setNotesStatus("error");
      }
    };

    loadNotes();

    return () => controller.abort();
  }, [profileRequestKey, notesReloadTick]);

  const retryProfile = () => {
    setProfileLoading(true);
    setProfileError("");
    setProfileErrorKind("");
    setReloadTick((tick) => tick + 1);
  };

  // Retries only the posts (the profile is not requested again)
  const reloadPosts = () => {
    setPostsLoading(true);
    setPostsError(false);
    setPostsReloadTick((tick) => tick + 1);
  };

  // Retries only the i-Notes
  const reloadNotes = () => {
    setNotesStatus("loading");
    setNotesReloadTick((tick) => tick + 1);
  };


  const selectedUser = profileData
    ? {
        name: profileData.name,
        username: profileData.username,
        bio: profileData.bio || "",
        profilePic:
          profileData.profilePicture || DEFAULT_PROFILE_PIC,
        followers: profileData.followersCount ?? 0,
        following: profileData.followingCount ?? 0,
        impressions: profileData.impressionsReceived ?? 0,
        badge: profileData.badge || "Impression Starter",
        isOfficial: profileData.isOfficial === true,
      }
    : {
        name: viewedUsername || "",
        username: viewedUsername || "",
        bio: "",
        profilePic: DEFAULT_PROFILE_PIC,
        followers: 0,
        following: 0,
        impressions: 0,
        badge: "Impression Starter",
        isOfficial: false,
      };

  // Shown values always come straight from the loaded profile
  // (no separate copies that could get out of sync).
  const name = selectedUser.name;

  const username = selectedUser.username;

  const bio = selectedUser.bio;

  const profilePic = selectedUser.profilePic;


  /*
  ============================================================
  PROFILE STATE
  */

  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);

  const menuButtonRef = useRef(null);

  // Close the ☰ menu when tapping anywhere outside it, or pressing Esc.
  // (Tapping the ☰ button itself toggles it, handled by its onClick.)
  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeOnOutside = (event) => {
      const target = event.target;

      if (
        menuRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }

      setMenuOpen(false);
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const [reportOpen, setReportOpen] = useState(false);

  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);

  const [blocking, setBlocking] = useState(false);

  const [darkTheme, setDarkTheme] = useState(
    () => getStoredTheme() === "dark"
  );

  const [activeTab, setActiveTab] = useState("posts");

  const [connectionsOpen, setConnectionsOpen] = useState(false);

  const [connectionType, setConnectionType] = useState("followers");

  const [connections, setConnections] = useState([]);

  const [connectionsLoading, setConnectionsLoading] = useState(false);

  const [connectionsError, setConnectionsError] = useState("");

  const connectionsSeqRef = useRef(0);

  const followBusyRef = useRef(false);


  /*
  ============================================================
  STAR VIEWER
  Tapping the badge star shows a big spinning star for a few
  seconds, then returns to the profile.
  */

  const [starViewerOpen, setStarViewerOpen] = useState(false);

  useEffect(() => {
    if (!starViewerOpen) return undefined;

    const timer = setTimeout(
      () => setStarViewerOpen(false),
      STAR_VIEWER_MS
    );

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setStarViewerOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [starViewerOpen]);


  /*
  ============================================================
  i-NOTES (composer state; the list itself is loaded above)
  */

  const [noteText, setNoteText] = useState("");

  const [notePosting, setNotePosting] = useState(false);

  const notePostingRef = useRef(false);

  const pendingNoteDeletesRef = useRef(new Set());


  /*
  ============================================================
  EDIT PROFILE
  */

  const [editOpen, setEditOpen] = useState(false);

  const [tempName, setTempName] = useState(selectedUser.name);

  const [tempUsername, setTempUsername] = useState(selectedUser.username);

  const [tempBio, setTempBio] = useState(selectedUser.bio);

  // Picture chosen inside the edit sheet. It only replaces the real
  // profile picture after "Save Changes", so closing the sheet never
  // leaves an unsaved picture showing on the profile.
  const [tempProfilePic, setTempProfilePic] = useState(
    selectedUser.profilePic
  );


  /*
  ============================================================
  PROFILE IMAGE VIEWER
  */

  const [imageViewerOpen, setImageViewerOpen] = useState(false);


  /*
  ============================================================
  PROFILE IMAGE CROP
  ============================================================
  The image fills the circle ("cover"), then is zoomed and
  panned with a CSS transform. applyCrop() reproduces exactly
  the same framing on a canvas, so the saved picture matches
  what the user sees inside the circle.
  */

  const [cropOpen, setCropOpen] = useState(false);

  const [cropImage, setCropImage] = useState("");

  const [cropZoom, setCropZoom] = useState(1);

  const [cropX, setCropX] = useState(0);

  const [cropY, setCropY] = useState(0);

  const [cropNatural, setCropNatural] = useState({ w: 0, h: 0 });

  const [cropApplying, setCropApplying] = useState(false);

  const fileInputRef = useRef(null);

  const cropAreaRef = useRef(null);

  const cropCircleRef = useRef(null);

  // Live crop values (so gesture handlers never read stale state)
  const cropStateRef = useRef({ x: 0, y: 0, zoom: 1 });

  const cropPointersRef = useRef(new Map());

  const cropGestureRef = useRef({
    origX: 0,
    origY: 0,
    origZoom: 1,
    p0: { x: 0, y: 0 },
    dist: 0,
  });

  const cropImageRef = useRef("");

  useEffect(() => {
    cropImageRef.current = cropImage;
  }, [cropImage]);

  // Release the blob URL if the page is left mid-crop
  useEffect(() => {
    return () => {
      if (cropImageRef.current) {
        URL.revokeObjectURL(cropImageRef.current);
      }
    };
  }, []);

  const updateCrop = (x, y, zoom) => {
    cropStateRef.current = { x, y, zoom };
    setCropX(x);
    setCropY(y);
    setCropZoom(zoom);
  };

  // Size of the circle and how far the image may be moved
  // before the circle would show empty space.
  const getCropBounds = (zoom) => {
    const circle = cropCircleRef.current;

    if (!circle || !cropNatural.w || !cropNatural.h) {
      return { size: 0, cover: 1, maxX: 0, maxY: 0 };
    }

    const size = circle.clientWidth;

    const cover = Math.max(
      size / cropNatural.w,
      size / cropNatural.h
    );

    return {
      size,
      cover,
      maxX: Math.max(
        0,
        (cropNatural.w * cover * zoom - size) / 2
      ),
      maxY: Math.max(
        0,
        (cropNatural.h * cover * zoom - size) / 2
      ),
    };
  };

  const clampCropOffset = (x, y, zoom) => {
    const { maxX, maxY } = getCropBounds(zoom);

    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const clampCropZoom = (value) =>
    Math.min(CROP_MAX_ZOOM, Math.max(1, value));

  const handleCropImageLoad = (event) => {
    setCropNatural({
      w: event.target.naturalWidth,
      h: event.target.naturalHeight,
    });
  };


 /*
  ============================================================
  BADGE / STAR SYSTEM — V1 LOCKED
  ============================================================
*/

const impressions = Number(selectedUser.impressions || 0);

const badges = Math.floor(impressions / 100);

const starLevels = [
  { min: 1, impressions: 100, name: "i Bronze Star", icon: "★", className: "bronze" },
  { min: 3, impressions: 300, name: "i Silver Star", icon: "★", className: "silver" },
  { min: 5, impressions: 500, name: "i Gold Star", icon: "★", className: "gold" },
  { min: 7, impressions: 700, name: "Legend", icon: "★", className: "legend" },
  { min: 15, impressions: 1500, name: "i Pro", icon: "★", className: "pro" },
];

const currentStar =
  [...starLevels]
    .reverse()
    .find((star) => badges >= star.min) || {
      min: 0,
      impressions: 0,
      name: "No Star",
      icon: "☆",
      className: "none",
    };

const nextStar = starLevels.find((star) => badges < star.min);

const progress = nextStar
  ? Math.min(
      100,
      Math.max(
        0,
        ((impressions - currentStar.impressions) /
          (nextStar.impressions - currentStar.impressions)) * 100
      )
    )
  : 100;

let animationBadgeLevel = 0;

if (badges >= 15) {
  animationBadgeLevel = 5;
} else if (badges >= 7) {
  animationBadgeLevel = 4;
} else if (badges >= 5) {
  animationBadgeLevel = 3;
} else if (badges >= 3) {
  animationBadgeLevel = 2;
} else if (badges >= 1) {
  animationBadgeLevel = 1;
}


  /*
  ============================================================
  POSTS
  */

  const posts = useMemo(
    () =>
      profilePosts.map((post) => ({
        id: post._id,
        image: getThumbUrl(post.media?.[0]),
      })),
    [profilePosts]
  );

  // While posts are loading (or failed) and nothing is known yet,
  // show a dash instead of a misleading 0.
  const postsCountLabel =
    posts.length === 0 && (postsLoading || postsError)
      ? "–"
      : posts.length;


  /*
  ============================================================
  ADD i-NOTE
  MAXIMUM = 10 NOTES
  */
  const addNote = async () => {
    if (notePostingRef.current) return;

    const text = noteText.trim();

    if (!text) return;

    const lines = text.split("\n");

    if (lines.length > 6) {
      alert("i-Notes can contain a maximum of 6 lines.");
      return;
    }

    if (notes.length >= 10) {
      alert("You can have a maximum of 10 i-Notes.");
      return;
    }

    notePostingRef.current = true;
    setNotePosting(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Please sign in again.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Unable to create i-Note.");
        return;
      }

      setNotes((currentNotes) => [
        { id: data.note._id, text: data.note.text },
        ...currentNotes,
      ]);

      setNoteText("");
    } catch (error) {
      console.error("Create i-Note error:", error);
      alert("Unable to connect to Impressa server.");
    } finally {
      notePostingRef.current = false;
      setNotePosting(false);
    }
  };


  /*
  ============================================================
  DELETE i-NOTE
  ============================================================
  */

  const deleteNote = async (noteId) => {
    if (pendingNoteDeletesRef.current.has(noteId)) {
      return;
    }

    pendingNoteDeletesRef.current.add(noteId);

    const previousNotes = notes;

    setNotes((currentNotes) =>
      currentNotes.filter((note) => note.id !== noteId)
    );

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Please sign in again.");
        setNotes(previousNotes);
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notes/${noteId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        let data = {};

        try {
          data = await response.json();
        } catch (parseError) {
          // no JSON body
        }

        console.error("Delete i-Note error:", data);

        alert(data.message || "Unable to delete i-Note.");

        setNotes(previousNotes);
        return;
      }
    } catch (error) {
      console.error("Delete i-Note connection error:", error);

      alert("Unable to connect to Impressa server.");

      setNotes(previousNotes);
    } finally {
      pendingNoteDeletesRef.current.delete(noteId);
    }
  };


  /*
  ============================================================
  DELETE POST
  ============================================================
  Tapping the bin asks for confirmation in the app's own dialog,
  then calls DELETE /api/posts/:postId. The post disappears right
  away and comes back if the server refuses.
  */

  const pendingPostDeletesRef = useRef(new Set());

  const [deleteTarget, setDeleteTarget] = useState(null);

  const deletePost = async (postId) => {
    if (pendingPostDeletesRef.current.has(postId)) {
      return;
    }

    pendingPostDeletesRef.current.add(postId);

    const previousPosts = profilePosts;

    const updatedPosts = previousPosts.filter(
      (post) => post._id !== postId
    );

    setProfilePosts(updatedPosts);

    cachePosts(postsName, updatedPosts);

    // The posts page keeps its own copy: drop it so the deleted post
    // cannot show up there.
    removePostsPageCache(postsName);

    const rollback = () => {
      setProfilePosts(previousPosts);

      cachePosts(postsName, previousPosts);
    };

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Please sign in again.");
        rollback();
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/posts/${postId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        let data = {};

        try {
          data = await response.json();
        } catch (parseError) {
          // no JSON body
        }

        console.error("Delete post error:", data);

        alert(data.message || "Unable to delete post.");

        rollback();
        return;
      }
    } catch (error) {
      console.error("Delete post connection error:", error);

      alert("Unable to connect to Impressa server.");

      rollback();
    } finally {
      pendingPostDeletesRef.current.delete(postId);
    }
  };

  const requestDeletePost = (postId) => {
    setDeleteTarget(postId);
  };

  const confirmDeletePost = () => {
    const postId = deleteTarget;

    setDeleteTarget(null);

    if (postId) {
      deletePost(postId);
    }
  };


  /*
  ============================================================
  EDIT PROFILE
  */

  const openEdit = () => {
    setTempName(name);
    setTempUsername(username);
    setTempBio(bio);
    setTempProfilePic(profilePic);
    setEditOpen(true);
    setMenuOpen(false);
  };


  /*
  ============================================================
  SAVE PROFILE TO BACKEND
  */

  const saveProfile = async () => {

    try {

      const token = localStorage.getItem("token");

      if (!token) {
        alert("Please sign in again.");
        return;
      }

      const updatedName = tempName.trim();

      const updatedUsername = tempUsername.trim().toLowerCase();

      const updatedBio = tempBio.trim();

      if (!updatedName) {
        alert("Profile name cannot be empty.");
        return;
      }

      if (!updatedUsername) {
        alert("Username cannot be empty.");
        return;
      }

      const previousUsername = selectedUser.username;

      const response = await fetch(`${API_BASE_URL}/api/profile/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: updatedName,
          username: updatedUsername,
          bio: updatedBio,
          profilePicture:
            tempProfilePic === DEFAULT_PROFILE_PIC ? "" : tempProfilePic,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Unable to update profile.");
        return;
      }

      try {
        const currentStoredUser = JSON.parse(
          localStorage.getItem("user") || "null"
        );

        if (currentStoredUser) {
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...currentStoredUser,
              id: data.user.id,
              name: data.user.name,
              username: data.user.username,
              bio: data.user.bio,
              profilePicture: data.user.profilePicture,
              badge: data.user.badge,
            })
          );
        }
      } catch (storageError) {
        console.error("Stored user update error:", storageError);
      }

      // Old username: forget everything cached under it
      if (
        previousUsername &&
        previousUsername.toLowerCase() !==
          String(data.user.username || "").toLowerCase()
      ) {
        removeProfileCache(previousUsername);
      }

      // New picture / details: the posts page must not reuse its old copy
      removePostsPageCache(data.user.username);

      cacheProfile(data.user.username, data.user);

      setProfileData(data.user);

      setEditOpen(false);

      // Own profile opened as /profile/<old-username>: follow the rename
      if (
        routeUsername &&
        routeUsername.toLowerCase() !==
          String(data.user.username || "").toLowerCase()
      ) {
        navigate(
          `/profile/${encodeURIComponent(data.user.username)}`,
          { replace: true }
        );
      }

      alert("Profile updated successfully 🎉");

    } catch (error) {
      console.error("Save profile error:", error);
      alert("Unable to connect to Impressa server.");
    }
  };


  /*
  ============================================================
  SELECT PROFILE IMAGE
  ============================================================
  */

  const selectProfileImage = (event) => {

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image.");
      event.target.value = "";
      return;
    }

    if (cropImageRef.current) {
      URL.revokeObjectURL(cropImageRef.current);
    }

    setCropImage(URL.createObjectURL(file));

    setCropNatural({ w: 0, h: 0 });

    updateCrop(0, 0, 1);

    cropPointersRef.current.clear();

    setCropOpen(true);

    event.target.value = "";
  };


  /*
  ============================================================
  CROP GESTURES
  One pointer  = drag to move
  Two pointers = pinch to zoom
  ============================================================
  */

  const startCropGesture = () => {
    const points = Array.from(cropPointersRef.current.values());

    if (points.length === 0) return;

    const { x, y, zoom } = cropStateRef.current;

    cropGestureRef.current = {
      origX: x,
      origY: y,
      origZoom: zoom,
      p0: points[0],
      dist:
        points.length >= 2
          ? Math.hypot(
              points[1].x - points[0].x,
              points[1].y - points[0].y
            )
          : 0,
    };
  };

  const handleCropPointerDown = (event) => {
    event.preventDefault();

    event.currentTarget.setPointerCapture?.(event.pointerId);

    cropPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    startCropGesture();
  };

  const handleCropPointerMove = (event) => {
    if (!cropPointersRef.current.has(event.pointerId)) {
      return;
    }

    cropPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const points = Array.from(cropPointersRef.current.values());

    const gesture = cropGestureRef.current;

    // Pinch
    if (points.length >= 2 && gesture.dist > 0) {
      const distance = Math.hypot(
        points[1].x - points[0].x,
        points[1].y - points[0].y
      );

      const nextZoom = clampCropZoom(
        gesture.origZoom * (distance / gesture.dist)
      );

      const next = clampCropOffset(
        gesture.origX,
        gesture.origY,
        nextZoom
      );

      updateCrop(next.x, next.y, nextZoom);
      return;
    }

    // Drag
    if (points.length === 1) {
      const zoom = cropStateRef.current.zoom;

      const next = clampCropOffset(
        gesture.origX + (points[0].x - gesture.p0.x),
        gesture.origY + (points[0].y - gesture.p0.y),
        zoom
      );

      updateCrop(next.x, next.y, zoom);
    }
  };

  const handleCropPointerUp = (event) => {
    cropPointersRef.current.delete(event.pointerId);

    // Continue smoothly with whichever finger is still down
    startCropGesture();
  };

  const handleCropZoomSlider = (event) => {
    const nextZoom = clampCropZoom(Number(event.target.value));

    const { x, y } = cropStateRef.current;

    const next = clampCropOffset(x, y, nextZoom);

    updateCrop(next.x, next.y, nextZoom);
  };

  const resetCrop = () => {
    updateCrop(0, 0, 1);
  };


  /*
  ============================================================
  APPLY CROP
  Draws exactly the part of the photo that is inside the circle.
  ============================================================
  */

  const applyCrop = () => {

    if (!cropImage || cropApplying) return;

    const { zoom, x, y } = cropStateRef.current;

    const { size, cover } = getCropBounds(zoom);

    if (!size || !cropNatural.w) return;

    setCropApplying(true);

    const image = new Image();

    image.onload = () => {

      const scale = cover * zoom;

      // Size of the visible square, in original-photo pixels
      const sourceSize = size / scale;

      // Centre of the visible area, in original-photo pixels
      const centerX = cropNatural.w / 2 - x / scale;
      const centerY = cropNatural.h / 2 - y / scale;

      const sourceX = Math.min(
        cropNatural.w - sourceSize,
        Math.max(0, centerX - sourceSize / 2)
      );

      const sourceY = Math.min(
        cropNatural.h - sourceSize,
        Math.max(0, centerY - sourceSize / 2)
      );

      const canvas = document.createElement("canvas");

      canvas.width = CROP_OUTPUT_SIZE;
      canvas.height = CROP_OUTPUT_SIZE;

      const context = canvas.getContext("2d");

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        CROP_OUTPUT_SIZE,
        CROP_OUTPUT_SIZE
      );

      setTempProfilePic(canvas.toDataURL("image/jpeg", 0.88));

      URL.revokeObjectURL(cropImage);

      setCropImage("");

      setCropOpen(false);

      setCropApplying(false);

      cropPointersRef.current.clear();

      updateCrop(0, 0, 1);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    image.onerror = () => {
      setCropApplying(false);
      alert("Unable to process this image.");
    };

    image.src = cropImage;
  };


  const cancelCrop = () => {

    setCropOpen(false);

    if (cropImage) {
      URL.revokeObjectURL(cropImage);
    }

    setCropImage("");

    setCropApplying(false);

    cropPointersRef.current.clear();

    updateCrop(0, 0, 1);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };


  /*
  ============================================================
  NAVIGATION
  ============================================================
  */

  const openAccountCenter = () => {
    setMenuOpen(false);
    navigate("/account-center");
  };

  const openAccountSettings = () => {
    setMenuOpen(false);
    navigate("/account-settings");
  };

  const openPrivacy = () => {
    setMenuOpen(false);
    navigate("/privacy");
  };

  const openNotifications = () => {
    setMenuOpen(false);
    navigate("/notifications");
  };

  const openHelp = () => {
    setMenuOpen(false);
    navigate("/help");
  };

  // V2 placeholder page (no paid features in V1)
  const openCustomize = () => {
    setMenuOpen(false);
    navigate("/customize");
  };

  const handleLogout = () => {
    setMenuOpen(false);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/signin", { replace: true });
  };

  const openBlockedAccounts = () => {
    setMenuOpen(false);
    navigate("/blocked-accounts");
  };

  const openGuidelines = () => {
    setMenuOpen(false);
    navigate("/community-guidelines");
  };

  const openReport = () => {
    setMenuOpen(false);
    setReportOpen(true);
  };

  const openBlockConfirm = () => {
    setMenuOpen(false);
    setBlockConfirmOpen(true);
  };

  const openPrivacyPolicy = () => {
    setMenuOpen(false);
    navigate("/privacy-policy");
  };

  const confirmBlock = async () => {
    if (blocking) return;

    try {
      setBlocking(true);

      await blockUser(selectedUser.username);

      // Remove cached copies so the blocked profile can't reappear
      removeProfileCache(selectedUser.username);

      setBlockConfirmOpen(false);

      navigate("/", { replace: true });
    } catch (error) {
      console.error("Block user error:", error);
      alert(error.message || "Unable to block this user.");
    } finally {
      setBlocking(false);
    }
  };

  const toggleDarkTheme = () => {
    const next = setTheme(darkTheme ? "light" : "dark");

    setDarkTheme(next === "dark");
  };


  /*
  ============================================================
  FOLLOW
  ============================================================
  */
  const handleFollow = async () => {
    // Ignore taps while a follow / unfollow request is still running
    if (followBusyRef.current) return;

    followBusyRef.current = true;

    const oldFollowed = followed;

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Please sign in again.");
        return;
      }

      setFollowed(!oldFollowed);

      setProfileData((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          followersCount: Math.max(
            0,
            (previous.followersCount || 0) +
              (oldFollowed ? -1 : 1)
          ),
        };
      });

      const response = await fetch(
        `${API_BASE_URL}/api/follow/${encodeURIComponent(
          viewedUsername
        )}`,
        {
          method: oldFollowed ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setFollowed(oldFollowed);

        setProfileData((previous) => {
          if (!previous) return previous;

          return {
            ...previous,
            followersCount: Math.max(
              0,
              (previous.followersCount || 0) +
                (oldFollowed ? 1 : -1)
            ),
          };
        });

        console.error("Follow error:", data);
        return;
      }

      const updatedProfile = {
        ...(profileData || {}),
        followersCount:
          typeof data.followersCount === "number"
            ? data.followersCount
            : Math.max(
                0,
                (profileData?.followersCount || 0) +
                  (oldFollowed ? -1 : 1)
              ),
        isFollowing: !oldFollowed,
      };

      setProfileData((previous) =>
        previous
          ? {
              ...previous,
              followersCount: updatedProfile.followersCount,
              isFollowing: updatedProfile.isFollowing,
            }
          : previous
      );

      if (profileData) {
        cacheProfile(cacheName, updatedProfile);
      }

    } catch (error) {
      console.error("Follow error:", error);

      setFollowed(oldFollowed);

      setProfileData((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          followersCount: Math.max(
            0,
            (previous.followersCount || 0) +
              (oldFollowed ? 1 : -1)
          ),
        };
      });

      alert("Unable to connect to Impressa server.");
    } finally {
      followBusyRef.current = false;
    }
  };


  /*
  ============================================================
  OPEN FOLLOWERS / FOLLOWING
  ============================================================
  */

  const openConnections = async (type) => {

    const seq = ++connectionsSeqRef.current;

    setConnectionType(type);
    setConnectionsOpen(true);
    setConnections([]);
    setConnectionsError("");
    setConnectionsLoading(true);

    try {

      const token = localStorage.getItem("token");

      const result = await fetchJson(
        `${API_BASE_URL}/api/profile/${encodeURIComponent(
          selectedUser.username
        )}/${type}`,
        {
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : {},
          timeoutMs: 20000,
        }
      );

      if (seq !== connectionsSeqRef.current) return;

      if (!result.ok) {
        throw new Error(
          result.data.message || `Unable to load ${type}.`
        );
      }

      const data = result.data;

      const users =
        data.users ||
        data[type] ||
        data.followers ||
        data.following ||
        [];

      setConnections(Array.isArray(users) ? users : []);

    } catch (error) {

      if (seq !== connectionsSeqRef.current) return;

      console.error(`Load ${type} error:`, error);

      setConnectionsError(
        error.code
          ? "Unable to reach Impressa server. Please try again."
          : error.message || `Unable to load ${type}.`
      );

    } finally {

      if (seq === connectionsSeqRef.current) {
        setConnectionsLoading(false);
      }

    }
  };

  const openFollowers = () => {
    openConnections("followers");
  };

  const openFollowing = () => {
    openConnections("following");
  };

  const closeConnections = () => {
    connectionsSeqRef.current += 1;
    setConnectionsOpen(false);
    setConnections([]);
    setConnectionsError("");
    setConnectionsLoading(false);
  };


  /*
  ============================================================
  OPEN USER POSTS
  ============================================================
  */

  const openUserPosts = () => {
    navigate(
      `/profile/${encodeURIComponent(selectedUser.username)}/posts`
    );
  };


  /*
  ============================================================
  LOADING / ERROR
  ============================================================
  */

  if (profileLoading && !profileData) {

    const shimmer = {
      background:
        "linear-gradient(100deg, var(--skeleton-a, #fff4eb) 8%, var(--skeleton-b, #ffe9d8) 18%, var(--skeleton-a, #fff4eb) 33%)",
      backgroundSize: "200% 100%",
      animation: "profileSkeletonShimmer 1.4s ease-in-out infinite",
    };

    return (
      <div className="profile-page">

        <div style={{ padding: "18px 15px" }}>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                ...shimmer,
              }}
            />

            <div
              style={{
                width: "45%",
                height: "16px",
                borderRadius: "6px",
                ...shimmer,
              }}
            />

            <div
              style={{
                width: "30%",
                height: "12px",
                borderRadius: "6px",
                ...shimmer,
              }}
            />
          </div>

          <div
            style={{
              width: "100%",
              height: "70px",
              borderRadius: "18px",
              marginBottom: "20px",
              ...shimmer,
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
            }}
          >
            {[0, 1, 2].map((key) => (
              <div
                key={key}
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: "14px",
                  ...shimmer,
                }}
              />
            ))}
          </div>

          {slowLoad && (
            <p
              style={{
                marginTop: "16px",
                textAlign: "center",
                color: "#8a8a8a",
                fontSize: "13px",
              }}
            >
              Waking up the server… this can take a few seconds.
            </p>
          )}

          <style>
            {`
              @keyframes profileSkeletonShimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            `}
          </style>

        </div>

      </div>
    );
  }

  if (profileError && !profileData) {

    return (
      <div className="profile-page">
        <div className="profile-topbar">
          <button
            className="back-button"
            onClick={goBack}
            aria-label="Go back"
          >
            ←
          </button>
        </div>

        <div
          className="profile-content"
          style={{ textAlign: "center" }}
        >
          <p>{profileError}</p>

          {profileErrorKind === "retry" && (
            <button
              type="button"
              className="edit-profile-btn"
              onClick={retryProfile}
            >
              Try again
            </button>
          )}

          {profileErrorKind === "auth" && (
            <button
              type="button"
              className="edit-profile-btn"
              onClick={() => navigate("/signin", { replace: true })}
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    );
  }


  /*
  ============================================================
  JSX
  ============================================================
  */

  return (

    <div className="profile-page">


      {/* =====================================================
          TOP BAR
      ===================================================== */}

      <div className="profile-topbar">

        <button
          className="back-button"
          onClick={goBack}
          aria-label="Go back"
        >
          ←
        </button>

        {/* Impressa Customize (V2 placeholder page) */}
        <button
          type="button"
          className="menu-button customize-button"
          onClick={openCustomize}
          aria-label="Impressa Customize"
          title="Impressa Customize"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
          </svg>
        </button>

        <button
          ref={menuButtonRef}
          className="menu-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Profile menu"
          aria-expanded={menuOpen}
        >
          ☰
        </button>

        {menuOpen && (

          <div className="profile-menu" ref={menuRef}>

            {!isOwnProfile && (
              <>
                <div className="profile-menu-label">THIS ACCOUNT</div>

                <button onClick={openReport}>
                  🚩 Report User
                </button>

                <button onClick={openBlockConfirm}>
                  🚫 Block User
                </button>
              </>
            )}

            <div className="profile-menu-label">ACCOUNT</div>

            {isOwnProfile && (
              <button onClick={openEdit}>
                ✏️ Edit Profile
              </button>
            )}

            {isOwnProfile && (
              <button onClick={openAccountCenter}>
                👥 Account Center
              </button>
            )}

            <button onClick={openAccountSettings}>
              ⚙️ Account Settings
            </button>

            <button onClick={openNotifications}>
              🔔 Notifications
            </button>

            <div className="profile-menu-label">SAFETY &amp; PRIVACY</div>

            <button onClick={openBlockedAccounts}>
              🚫 Blocked Accounts
            </button>

            <button onClick={openPrivacy}>
              🔒 Privacy
            </button>

            <button onClick={openPrivacyPolicy}>
              📄 Privacy Policy
            </button>

            <button onClick={openGuidelines}>
              📋 Community Guidelines
            </button>

            <div className="profile-menu-label">APPEARANCE</div>

            <button onClick={toggleDarkTheme}>
              🌙 Dark Theme
              <span
                className={`profile-menu-switch ${
                  darkTheme ? "on" : ""
                }`}
              />
            </button>

            <div className="profile-menu-label">ABOUT</div>

            <button onClick={openHelp}>
              ❓ Help
            </button>

            {isOwnProfile && (
              <button
                className="logout-btn"
                onClick={handleLogout}
              >
                ↪ Logout
              </button>
            )}

          </div>

        )}

      </div>


      {/* =====================================================
          FOLLOWERS / FOLLOWING MODAL
      ===================================================== */}

      {connectionsOpen && (

        <div
          className="connections-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeConnections();
            }
          }}
        >

          <div className="connections-modal">

            <div className="connections-header">

              <div>

                <span className="connections-eyebrow">
                  IMPRESSA
                </span>

                <h2>
                  {connectionType === "followers"
                    ? "Followers"
                    : "Following"}
                </h2>

              </div>

              <button
                type="button"
                className="connections-close"
                onClick={closeConnections}
                aria-label="Close connections"
              >
                ×
              </button>

            </div>

            <div className="connections-list">

              {connectionsLoading && (
                <div className="connections-state">
                  Loading {connectionType}...
                </div>
              )}

              {!connectionsLoading && connectionsError && (
                <div className="connections-state connections-error">
                  {connectionsError}
                </div>
              )}

              {!connectionsLoading && !connectionsError && connections.length === 0 && (
                <div className="connections-state">

                  <div className="connections-empty-icon">
                    {connectionType === "followers" ? "👥" : "➜"}
                  </div>

                  <h3>No {connectionType} yet</h3>

                  <p>
                    {connectionType === "followers"
                      ? "People who follow this profile will appear here."
                      : "Profiles this user follows will appear here."}
                  </p>

                </div>
              )}

              {!connectionsLoading && !connectionsError && connections.map((user) => {

                const userUsername =
                  user.username ||
                  user.user?.username ||
                  "";

                const userName =
                  user.name ||
                  user.user?.name ||
                  userUsername;

                const userProfilePicture =
                  user.profilePicture ||
                  user.profilePic ||
                  user.user?.profilePicture ||
                  DEFAULT_PROFILE_PIC;

                if (!userUsername) return null;

                return (
                  <button
                    type="button"
                    className="connection-user"
                    key={user._id || user.id || userUsername}
                    onClick={() => {
                      closeConnections();
                      navigate(
                        `/profile/${encodeURIComponent(userUsername)}`
                      );
                    }}
                  >

                    <img
                      src={userProfilePicture}
                      alt={`${userName}'s profile`}
                      loading="lazy"
                      decoding="async"
                    />

                    <span className="connection-user-info">
                      <strong>{userName}</strong>
                      <span>@{userUsername}</span>
                    </span>

                    <span className="connection-arrow">→</span>

                  </button>
                );

              })}

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          PROFILE HEADER
      ===================================================== */}

      <section className="profile-header">

        <button
          type="button"
          className="profile-picture-button"
          onClick={() => setImageViewerOpen(true)}
          aria-label={`View ${name}'s profile picture`}
        >

          <img
            src={profilePic}
            alt={`${name}'s profile`}
            className="profile-picture"
            decoding="async"
          />

        </button>

        <div className="profile-info">

          <div className="username-row">

            <div>

              <h1>{name}</h1>

              <div className="profile-username-row">

                <p className="profile-username">
                  @{username}
                </p>

                {profileData?.isOfficial === true && (
                  <span
                    className="profile-official-badge"
                    aria-label="Official Impressa account"
                    title="Official Impressa account"
                  />
                )}

                {animationBadgeLevel > 0 && (
                  <BadgeAnimation
                    badgeLevel={animationBadgeLevel}
                    animate={true}
                  />
                )}

              </div>

            </div>

          </div>

          <p className="profile-bio">{bio}</p>

          {isOwnProfile ? (

            <button
              className="edit-profile-btn"
              onClick={openEdit}
            >
              Edit Profile
            </button>

          ) : (

            <button
              className={`edit-profile-btn ${
                followed ? "following-btn" : ""
              }`}
              onClick={handleFollow}
            >
              {followed ? "Following" : "Follow"}
            </button>

          )}

        </div>

      </section>


      {/* =====================================================
          STATS
      ===================================================== */}

      <div className="profile-stats">

        <div className="stat">
          <strong>{postsCountLabel}</strong>
          <span>Posts</span>
        </div>

        <button
          type="button"
          className="stat stat-button"
          onClick={openFollowers}
          aria-label={`View ${selectedUser.username}'s followers`}
        >
          <strong>{selectedUser.followers}</strong>
          <span>Followers</span>
        </button>

        <button
          type="button"
          className="stat stat-button"
          onClick={openFollowing}
          aria-label={`View ${selectedUser.username}'s following`}
        >
          <strong>{selectedUser.following}</strong>
          <span>Following</span>
        </button>

        <div className="stat impression-stat">
          <strong>{selectedUser.impressions}</strong>
          <span>Impressions</span>
        </div>

      </div>


      {/* =====================================================
          CURRENT BADGE
      ===================================================== */}

      <section className="badge-section">

        <div className={`badge-card ${currentStar.className}`}>

          <div
            className={`badge-star ${currentStar.className}`}
            role="button"
            tabIndex={0}
            aria-label={`View ${currentStar.name}`}
            onClick={() => setStarViewerOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setStarViewerOpen(true);
              }
            }}
          >
            <span>{currentStar.icon}</span>
          </div>

          <div className="badge-details">

            <h2>{currentStar.name}</h2>

            <p>
              {badges} badges · 100 impressions = 1 badge
            </p>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            <span className="progress-text">
              {nextStar
                ? `${nextStar.min - badges} badges to ${nextStar.name}`
                : "Maximum star reached"}
            </span>

          </div>

        </div>

      </section>


      {/* =====================================================
          STAR GRAPH
      ===================================================== */}

      <div className="star-chart">

        {starLevels.map((star) => (

          <div
            className={`star-level ${
              badges >= star.min ? "unlocked" : ""
            } ${star.className}`}
            key={star.name}
          >

            <div className="chart-star">{star.icon}</div>

            <strong>{star.min}</strong>

            <span>{star.name}</span>

          </div>

        ))}

      </div>


      {/* =====================================================
          TABS
      ===================================================== */}

      <div className="profile-tabs">

        <button
          className={activeTab === "posts" ? "active-tab" : ""}
          onClick={() => setActiveTab("posts")}
        >
          ▦ Posts
        </button>

        <button
          className={activeTab === "notes" ? "active-tab" : ""}
          onClick={() => setActiveTab("notes")}
        >
          ✎ i-Notes
        </button>

      </div>


      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div className="profile-content">

        {activeTab === "posts" && (

          <>

            <div className="posts-grid">

              {posts.map((post) => (

                <div
                  className="post-card"
                  key={post.id}
                  role="button"
                  tabIndex={0}
                  onClick={openUserPosts}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openUserPosts();
                    }
                  }}
                  aria-label={`Open ${selectedUser.username}'s posts`}
                >

                  <img
                    src={post.image}
                    alt={`Post ${post.id}`}
                    loading="lazy"
                    decoding="async"
                  />

                  {isOwnProfile && (
                    <button
                      type="button"
                      className="post-delete-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDeletePost(post.id);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      aria-label="Delete post"
                      title="Delete post"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 7h16" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  )}

                </div>

              ))}

              {postsLoading &&
                posts.length === 0 &&
                [0, 1, 2, 3, 4, 5].map((key) => (
                  <div
                    key={`post-skeleton-${key}`}
                    className="post-card"
                    style={{ cursor: "default" }}
                    aria-hidden="true"
                  />
                ))}

            </div>

            {postsError && posts.length === 0 && (

              <div className="empty-content">

                <div>⚠</div>

                <h3>Couldn't load posts</h3>

                <p>Check your connection and try again.</p>

                <button
                  type="button"
                  className="edit-profile-btn"
                  style={{ marginTop: "16px" }}
                  onClick={reloadPosts}
                >
                  Try again
                </button>

              </div>

            )}

          </>

        )}


        {activeTab === "notes" && (

          <div className="notes-area">

            {isOwnProfile && (

              <div className="note-composer">

                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write an i-Note... (maximum 6 lines)"
                  rows={6}
                />

                <div className="note-actions">

                  <span>
                    {noteText.split("\n").filter(Boolean).length}
                    /6 lines · {notes.length}/10 notes
                  </span>

                  <button
                    onClick={addNote}
                    disabled={
                      notesStatus === "loading" ||
                      notePosting ||
                      notes.length >= 10
                    }
                  >
                    {notePosting ? "Posting..." : "Post i-Note"}
                  </button>

                </div>

              </div>

            )}

            {notesStatus === "loading" && notes.length === 0 ? (

              <div
                className="notes-skeleton"
                aria-busy="true"
                aria-label="Loading i-Notes"
              >

                <div className="note-skeleton" />

                <div className="note-skeleton" />

              </div>

            ) : notesStatus === "error" && notes.length === 0 ? (

              <div className="empty-content">

                <div>⚠</div>

                <h3>Couldn't load i-Notes</h3>

                <p>Check your connection and try again.</p>

                <button
                  type="button"
                  className="edit-profile-btn"
                  style={{ marginTop: "16px" }}
                  onClick={reloadNotes}
                >
                  Try again
                </button>

              </div>

            ) : notes.length === 0 ? (

              <div className="empty-content">

                <div>✎</div>

                <h3>
                  {isOwnProfile
                    ? "No i-Notes Yet"
                    : "No Public i-Notes"}
                </h3>

                <p>
                  {isOwnProfile
                    ? "Your public i-Notes will appear here for everyone to see."
                    : `@${selectedUser.username} has not posted an i-Note yet.`}
                </p>

              </div>

            ) : (

              notes.map((note) => (

                <div
                  className="public-note"
                  key={note.id}
                >

                  <div className="note-header">

                    <div>
                      <strong>{name}</strong>
                      <span>@{username}</span>
                    </div>

                    {isOwnProfile && (
                      <button
                        className="delete-note"
                        onClick={() => deleteNote(note.id)}
                        title="Delete i-Note"
                      >
                        🗑
                      </button>
                    )}

                  </div>

                  <p>{note.text}</p>

                </div>

              ))

            )}

          </div>

        )}

      </div>


      {/* =====================================================
          STAR VIEWER
          Big spinning star; closes by itself after a few
          seconds, or when tapped.
      ===================================================== */}

      {starViewerOpen && (

        <div
          className={`star-viewer ${currentStar.className}`}
          onClick={() => setStarViewerOpen(false)}
          role="dialog"
          aria-label={currentStar.name}
        >

          <button
            type="button"
            className="star-viewer-close"
            onClick={(event) => {
              event.stopPropagation();
              setStarViewerOpen(false);
            }}
            aria-label="Close star"
          >
            ×
          </button>

          <div className="star-viewer-medal">

            <span className="star-viewer-orbit" aria-hidden="true" />

            <span className="star-viewer-star" aria-hidden="true">
              {currentStar.icon}
            </span>

          </div>

          <h2 className="star-viewer-name">{currentStar.name}</h2>

          <p className="star-viewer-sub">
            {badges} {badges === 1 ? "badge" : "badges"} · {impressions}{" "}
            impressions
          </p>

          <p className="star-viewer-next">
            {nextStar
              ? `${nextStar.min - badges} more ${
                  nextStar.min - badges === 1 ? "badge" : "badges"
                } to reach ${nextStar.name}`
              : "Maximum star reached"}
          </p>

        </div>

      )}


      {/* =====================================================
          PROFILE IMAGE VIEWER
      ===================================================== */}

      {imageViewerOpen && (

        <div
          className="profile-image-viewer"
          onClick={() => setImageViewerOpen(false)}
        >

          <button
            type="button"
            className="profile-image-viewer-close"
            onClick={() => setImageViewerOpen(false)}
            aria-label="Close profile image"
          >
            ×
          </button>

          <img
            src={profilePic}
            alt={`${name}'s enlarged profile`}
            className="profile-image-large"
            onClick={(event) => event.stopPropagation()}
          />

        </div>

      )}


      {/* =====================================================
          EDIT PROFILE
      ===================================================== */}

      {editOpen && (

        <div
          className="edit-overlay"
          onClick={() => setEditOpen(false)}
        >

          <div
            className="edit-modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="edit-modal-header">

              <h2>Change Profile</h2>

              <button
                onClick={() => setEditOpen(false)}
                aria-label="Close"
              >
                ×
              </button>

            </div>

            <label>Profile Picture</label>

            <div className="edit-profile-photo">

              <img
                src={tempProfilePic}
                alt="Current profile"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Media
              </button>

            </div>

            <input
              ref={fileInputRef}
              className="hidden-file-input"
              type="file"
              accept="image/*"
              onChange={selectProfileImage}
            />

            <label>Profile Name</label>

            <input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
            />

            <label>Username</label>

            <input
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
            />

            <label>Bio</label>

            <textarea
              value={tempBio}
              onChange={(e) => setTempBio(e.target.value)}
              rows={4}
            />

            <button
              className="save-profile-btn"
              onClick={saveProfile}
            >
              Save Changes
            </button>

          </div>

        </div>

      )}


      {/* =====================================================
          CROP EDITOR
      ===================================================== */}

      {cropOpen && (

        <div className="crop-overlay">

          <div className="crop-modal">

            <div className="crop-header">

              <div>
                <span>IMPRESSA</span>
                <h2>Set Profile Picture</h2>
              </div>

              <button
                type="button"
                onClick={cancelCrop}
                aria-label="Close crop editor"
              >
                ×
              </button>

            </div>

            <p className="crop-description">
              Drag to reposition. Pinch with two fingers
              (or use the slider) to zoom.
            </p>

            <div
              ref={cropAreaRef}
              className="crop-area"
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
              style={{ touchAction: "none" }}
            >

              <div
                className="crop-circle"
                ref={cropCircleRef}
              >

                <img
                  src={cropImage}
                  alt="Crop preview"
                  draggable="false"
                  className="crop-image"
                  onLoad={handleCropImageLoad}
                  style={{
                    transform: `translate(${cropX}px, ${cropY}px) scale(${cropZoom})`,
                  }}
                />

              </div>

            </div>

            <div className="crop-controls">

              <label>Zoom</label>

              <input
                type="range"
                min="1"
                max={CROP_MAX_ZOOM}
                step="0.01"
                value={cropZoom}
                onChange={handleCropZoomSlider}
              />

              <button
                type="button"
                onClick={resetCrop}
                style={{
                  padding: "8px 14px",
                  border: "1px solid #e6ddd5",
                  borderRadius: "999px",
                  background: "#ffffff",
                  color: "#777777",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Reset
              </button>

            </div>

            <div className="crop-actions">

              <button
                type="button"
                className="crop-cancel"
                onClick={cancelCrop}
              >
                Cancel
              </button>

              <button
                type="button"
                className="crop-apply"
                onClick={applyCrop}
                disabled={cropApplying || !cropNatural.w}
              >
                {cropApplying ? "Applying..." : "Use Photo"}
              </button>

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          DELETE POST / BLOCK / REPORT DIALOGS
      ===================================================== */}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this post?"
        message="This permanently removes the post and Impressions you earned on this post still count toward your total and badges."
        confirmLabel="Delete"
        busy={false}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeletePost}
      />

      <ConfirmDialog
        open={blockConfirmOpen}
        title={`Block @${selectedUser.username}?`}
        message="You won't be able to find or interact with each other on Impressa."
        confirmLabel="Block"
        busy={blocking}
        onCancel={() => setBlockConfirmOpen(false)}
        onConfirm={confirmBlock}
      />

      <ReportModal
        open={reportOpen}
        type="user"
        target={selectedUser.username}
        onClose={() => setReportOpen(false)}
      />

    </div>

  );

}


export default Profile;