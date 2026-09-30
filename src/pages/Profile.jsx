import React, { useEffect, useRef, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import "./Profile.css";
import BadgeAnimation from "../components/BadgeAnimation";
import ConfirmDialog from "../components/ConfirmDialog";
import ReportModal from "../components/ReportModal";
import { blockUser } from "../utils/safetyApi";
import { getStoredTheme, setTheme } from "../utils/theme";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

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

// ==========================================
// CROP SETTINGS
// ==========================================

const CROP_OUTPUT_SIZE = 512;
const CROP_MAX_ZOOM = 3;

// ==========================================
// PROFILE CACHE
// ==========================================

const getCachedProfile = (username) => {
  try {
    if (!username) return null;

    return JSON.parse(
      localStorage.getItem(
        `impressa_profile_${username.toLowerCase()}`
      ) || "null"
    );
  } catch (error) {
    console.error("Profile cache read error:", error);
    return null;
  }
};

const getCachedPosts = (username) => {
  try {
    if (!username) return [];

    return JSON.parse(
      localStorage.getItem(
        `impressa_profile_posts_${username.toLowerCase()}`
      ) || "[]"
    );
  } catch (error) {
    console.error("Profile posts cache read error:", error);
    return [];
  }
};


function Profile() {

  const navigate = useNavigate();

  const { username: routeUsername } = useParams();


  /*
  ============================================================
  PROFILE TYPE + BACKEND PROFILE DATA
  */

  const storedUser = JSON.parse(
    localStorage.getItem("user") || "null"
  );

  const loggedInUsername =
    storedUser?.username || "";

  const isOwnProfile =
    !routeUsername ||
    routeUsername.toLowerCase() ===
      loggedInUsername.toLowerCase();

  const viewedUsername =
    routeUsername || loggedInUsername;

  const [profileData, setProfileData] =
    useState(() => getCachedProfile(viewedUsername));

  const [profilePosts, setProfilePosts] =
    useState(() => getCachedPosts(viewedUsername));

  const [profileLoading, setProfileLoading] =
    useState(() => !getCachedProfile(viewedUsername));

  const [profileError, setProfileError] =
    useState("");

  const profileRequestIdRef = useRef(0);

  useEffect(() => {
    const cachedProfile = getCachedProfile(viewedUsername);
    const cachedPosts = getCachedPosts(viewedUsername);

    setProfileData(cachedProfile);
    setProfilePosts(cachedPosts);
    setProfileLoading(!cachedProfile);
    setProfileError("");
  }, [viewedUsername]);

  useEffect(() => {
    const fetchProfile = async () => {
      const requestId = ++profileRequestIdRef.current;

      try {
        setProfileError("");

        const API_URL =
          import.meta.env.VITE_API_URL || "http://localhost:5000";

        const token = localStorage.getItem("token");

        const profileUrl = isOwnProfile
          ? `${API_URL}/api/profile/me`
          : `${API_URL}/api/profile/${encodeURIComponent(
              viewedUsername
            )}`;

        const profileResponse = await fetch(profileUrl, {
          method: "GET",
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : {},
        });

        const profileResult = await profileResponse.json();

        if (!profileResponse.ok) {
          const loadError = new Error(
            profileResult.message || "Failed to load profile"
          );

          loadError.status = profileResponse.status;

          throw loadError;
        }

        if (requestId !== profileRequestIdRef.current) {
          return;
        }

        setProfileData(profileResult.user);

        localStorage.setItem(
          `impressa_profile_${viewedUsername.toLowerCase()}`,
          JSON.stringify(profileResult.user)
        );

        const postsResponse = await fetch(
          `${API_URL}/api/profile/${encodeURIComponent(
            profileResult.user.username
          )}/posts`,
          {
            method: "GET",
            headers: token
              ? { Authorization: `Bearer ${token}` }
              : {},
          }
        );

        const postsResult = await postsResponse.json();

        if (requestId !== profileRequestIdRef.current) {
          return;
        }

        if (postsResponse.ok) {
          const freshPosts = postsResult.posts || [];

          setProfilePosts(freshPosts);

          localStorage.setItem(
            `impressa_profile_posts_${viewedUsername.toLowerCase()}`,
            JSON.stringify(freshPosts)
          );
        } else {
          setProfilePosts([]);
        }

      } catch (error) {

        if (requestId !== profileRequestIdRef.current) {
          return;
        }

        console.error("Profile fetch error:", error);

        if (error.status === 404) {
          // Deleted, not found, or blocked: never show a stale cached copy
          const cacheKey = viewedUsername.toLowerCase();

          localStorage.removeItem(`impressa_profile_${cacheKey}`);
          localStorage.removeItem(`impressa_profile_posts_${cacheKey}`);

          setProfileData(null);
          setProfilePosts([]);
          setProfileError("This profile isn't available.");
        } else if (!getCachedProfile(viewedUsername)) {
          setProfileError(
            error.message || "Unable to load profile."
          );

          setProfilePosts([]);
        }

      } finally {

        if (requestId === profileRequestIdRef.current) {
          setProfileLoading(false);
        }

      }
    };

    if (viewedUsername || isOwnProfile) {
      fetchProfile();
    }

  }, [viewedUsername, isOwnProfile]);


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


  /*
  ============================================================
  PROFILE STATE
  */

  const [menuOpen, setMenuOpen] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);

  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);

  const [blocking, setBlocking] = useState(false);

  const [darkTheme, setDarkTheme] = useState(
    () => getStoredTheme() === "dark"
  );

  const [activeTab, setActiveTab] = useState("posts");

  const [followed, setFollowed] = useState(false);

  const [connectionsOpen, setConnectionsOpen] = useState(false);

  const [connectionType, setConnectionType] = useState("followers");

  const [connections, setConnections] = useState([]);

  const [connectionsLoading, setConnectionsLoading] = useState(false);

  const [connectionsError, setConnectionsError] = useState("");


  useEffect(() => {
    const checkFollowStatus = async () => {

      if (isOwnProfile) {
        setFollowed(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");

        if (!token) return;

        const API_URL =
          import.meta.env.VITE_API_URL || "http://localhost:5000";

        const response = await fetch(
          `${API_URL}/api/follow/status/${encodeURIComponent(
            viewedUsername
          )}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.error("Follow status error:", data);
          return;
        }

        setFollowed(data.following === true);

      } catch (error) {
        console.error("Check follow status error:", error);
      }
    };

    checkFollowStatus();

  }, [viewedUsername, isOwnProfile]);


  /*
  ============================================================
  i-NOTES
  */

  const [notes, setNotes] = useState([]);

  const [noteText, setNoteText] = useState("");

  const [notesLoading, setNotesLoading] = useState(false);

  const pendingNoteDeletesRef = useRef(new Set());

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        setNotesLoading(true);

        const token = localStorage.getItem("token");

        if (!token) return;

        const API_URL =
          import.meta.env.VITE_API_URL || "http://localhost:5000";

        const notesUrl = isOwnProfile
          ? `${API_URL}/api/notes`
          : `${API_URL}/api/notes/user/${encodeURIComponent(
              viewedUsername
            )}`;

        const response = await fetch(notesUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load i-Notes."
          );
        }

        setNotes(
          (data.notes || []).map((note) => ({
            id: note._id,
            text: note.text,
          }))
        );
      } catch (error) {
        console.error("Load i-Notes error:", error);
        setNotes([]);
      } finally {
        setNotesLoading(false);
      }
    };

    if (viewedUsername || isOwnProfile) {
      fetchNotes();
    }
  }, [viewedUsername, isOwnProfile]);


  /*
  ============================================================
  EDIT PROFILE
  */

  const [editOpen, setEditOpen] = useState(false);

  const [name, setName] = useState(selectedUser.name);

  const [username, setUsername] = useState(selectedUser.username);

  const [bio, setBio] = useState(selectedUser.bio);

  const [profilePic, setProfilePic] = useState(selectedUser.profilePic);

  const [tempName, setTempName] = useState(selectedUser.name);

  const [tempUsername, setTempUsername] = useState(selectedUser.username);

  const [tempBio, setTempBio] = useState(selectedUser.bio);


  /*
  ============================================================
  SYNC PROFILE DATA
  */

  useEffect(() => {
    if (!profileData) return;

    setName(profileData.name || "");
    setUsername(profileData.username || "");
    setBio(profileData.bio || "");
    setProfilePic(
      profileData.profilePicture || DEFAULT_PROFILE_PIC
    );
  }, [profileData]);


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

  const posts = profilePosts.map((post) => {

    const firstMedia = post.media?.[0];

    let image =
      typeof firstMedia === "string"
        ? firstMedia
        : firstMedia?.url ||
          firstMedia?.path ||
          firstMedia?.src;

    if (image?.startsWith("/")) {
      image = `${API_BASE_URL}${image}`;
    }

    if (image?.startsWith("http://localhost:5000")) {
      image = image.replace(
        "http://localhost:5000",
        API_BASE_URL
      );
    }

    return {
      id: post._id,
      image: image || "https://picsum.photos/500/500",
    };
  });


  /*
  ============================================================
  ADD i-NOTE
  MAXIMUM = 10 NOTES
  */
  const addNote = async () => {
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

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Please sign in again.");
        return;
      }

      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:5000";

      const response = await fetch(`${API_URL}/api/notes`, {
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

      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:5000";

      const response = await fetch(
        `${API_URL}/api/notes/${noteId}`,
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
  Calls DELETE /api/posts/:postId
  */

  const pendingPostDeletesRef = useRef(new Set());

  const deletePost = async (postId) => {
    if (pendingPostDeletesRef.current.has(postId)) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this post? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    pendingPostDeletesRef.current.add(postId);

    const previousPosts = profilePosts;

    const updatedPosts = previousPosts.filter(
      (post) => post._id !== postId
    );

    setProfilePosts(updatedPosts);

    localStorage.setItem(
      `impressa_profile_posts_${viewedUsername.toLowerCase()}`,
      JSON.stringify(updatedPosts)
    );

    const rollback = () => {
      setProfilePosts(previousPosts);

      localStorage.setItem(
        `impressa_profile_posts_${viewedUsername.toLowerCase()}`,
        JSON.stringify(previousPosts)
      );
    };

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Please sign in again.");
        rollback();
        return;
      }

      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:5000";

      const response = await fetch(
        `${API_URL}/api/posts/${postId}`,
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


  /*
  ============================================================
  EDIT PROFILE
  */

  const openEdit = () => {
    setTempName(name);
    setTempUsername(username);
    setTempBio(bio);
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

      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:5000";

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

      const response = await fetch(`${API_URL}/api/profile/me`, {
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
            profilePic === DEFAULT_PROFILE_PIC ? "" : profilePic,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Unable to update profile.");
        return;
      }

      setProfileData(data.user);

      setName(data.user.name);

      setUsername(data.user.username);

      setBio(data.user.bio || "");

      setProfilePic(
        data.user.profilePicture || DEFAULT_PROFILE_PIC
      );

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

      localStorage.setItem(
        `impressa_profile_${data.user.username.toLowerCase()}`,
        JSON.stringify(data.user)
      );

      setEditOpen(false);

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

      setProfilePic(canvas.toDataURL("image/jpeg", 0.88));

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
      const cacheKey = selectedUser.username.toLowerCase();

      localStorage.removeItem(`impressa_profile_${cacheKey}`);
      localStorage.removeItem(`impressa_profile_posts_${cacheKey}`);
      localStorage.removeItem(
        `impressa_profile_posts_page_${cacheKey}`
      );

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
    const oldFollowed = followed;

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Please sign in again.");
        return;
      }

      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:5000";

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
        `${API_URL}/api/follow/${encodeURIComponent(
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

      setProfileData((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          followersCount: data.followersCount,
        };
      });

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
    }
  };


  /*
  ============================================================
  OPEN FOLLOWERS / FOLLOWING
  ============================================================
  */

  const openConnections = async (type) => {

    setConnectionType(type);
    setConnectionsOpen(true);
    setConnections([]);
    setConnectionsError("");
    setConnectionsLoading(true);

    try {

      const token = localStorage.getItem("token");

      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:5000";

      const response = await fetch(
        `${API_URL}/api/profile/${encodeURIComponent(
          selectedUser.username
        )}/${type}`,
        {
          method: "GET",
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : {},
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `Unable to load ${type}.`
        );
      }

      const users =
        data.users ||
        data[type] ||
        data.followers ||
        data.following ||
        [];

      setConnections(Array.isArray(users) ? users : []);

    } catch (error) {

      console.error(`Load ${type} error:`, error);

      setConnectionsError(
        error.message || `Unable to load ${type}.`
      );

    } finally {

      setConnectionsLoading(false);

    }
  };

  const openFollowers = () => {
    openConnections("followers");
  };

  const openFollowing = () => {
    openConnections("following");
  };

  const closeConnections = () => {
    setConnectionsOpen(false);
    setConnections([]);
    setConnectionsError("");
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

  if (profileError) {

    return (
      <div className="profile-page">
        <div className="profile-topbar">
          <button
            className="back-button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>
        </div>

        <div className="profile-content">
          <p>{profileError}</p>
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
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ←
        </button>

        <button
          className="menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Profile menu"
        >
          ☰
        </button>

        {menuOpen && (

          <div className="profile-menu">

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
          <strong>{posts.length}</strong>
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

          <div className={`badge-star ${currentStar.className}`}>
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
                />

                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deletePost(post.id);
                    }}
                    aria-label="Delete post"
                    title="Delete post"
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      width: "30px",
                      height: "30px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.55)",
                      color: "#ffffff",
                      fontSize: "13px",
                      cursor: "pointer",
                      zIndex: 2,
                    }}
                  >
                    🗑
                  </button>
                )}

              </div>

            ))}

          </div>

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
                    disabled={notes.length >= 10}
                  >
                    Post i-Note
                  </button>

                </div>

              </div>

            )}

            {notes.length === 0 ? (

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
                src={profilePic}
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
          BLOCK / REPORT DIALOGS
      ===================================================== */}

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