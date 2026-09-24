import React, { useEffect, useRef, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import "./Profile.css";
import BadgeAnimation from "../components/BadgeAnimation";


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
    useState(null);

  const [profilePosts, setProfilePosts] =
    useState([]);

  const [profileLoading, setProfileLoading] =
    useState(true);

  const [profileError, setProfileError] =
    useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        setProfileError("");

        const API_URL =
          `http://${window.location.hostname}:5000`;

        const token =
          localStorage.getItem("token");

        const profileUrl = isOwnProfile
          ? `${API_URL}/api/profile/me`
          : `${API_URL}/api/profile/${encodeURIComponent(
              viewedUsername
            )}`;

        const profileResponse =
          await fetch(profileUrl, {
            method: "GET",
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {},
          });

        const profileResult =
          await profileResponse.json();

        if (!profileResponse.ok) {
          throw new Error(
            profileResult.message ||
              "Failed to load profile"
          );
        }

        setProfileData(profileResult.user);

        const postsResponse =
          await fetch(
            `${API_URL}/api/profile/${encodeURIComponent(
              profileResult.user.username
            )}/posts`
          );

        const postsResult =
          await postsResponse.json();

        if (postsResponse.ok) {
          setProfilePosts(
            postsResult.posts || []
          );
        } else {
          setProfilePosts([]);
        }

      } catch (error) {

        console.error(
          "Profile fetch error:",
          error
        );

        setProfileError(
          error.message ||
            "Unable to load profile."
        );

        setProfilePosts([]);

      } finally {

        setProfileLoading(false);

      }
    };

    if (viewedUsername || isOwnProfile) {
      fetchProfile();
    }

  }, [viewedUsername, isOwnProfile]);


  const selectedUser = profileData
    ? {
        name: profileData.name,

        username:
          profileData.username,

        bio:
          profileData.bio || "",

        profilePic:
          profileData.profilePicture ||
          "https://i.pravatar.cc/300?img=32",

        followers:
          profileData.followersCount ?? 0,

        following:
          profileData.followingCount ?? 0,

        impressions:
          profileData.impressionsReceived ?? 0,

        badge:
          profileData.badge ||
          "Impression Starter",

        // ==========================================
        // OFFICIAL ACCOUNT
        // ==========================================

        isOfficial:
          profileData.isOfficial === true,
      }

    : {
        name:
          viewedUsername || "",

        username:
          viewedUsername || "",

        bio: "",

        profilePic:
          "https://i.pravatar.cc/300?img=32",

        followers: 0,

        following: 0,

        impressions: 0,

        badge:
          "Impression Starter",

        isOfficial: false,
      };


  /*
  ============================================================
  PROFILE STATE
  */

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState("posts");

  const [followed, setFollowed] =
    useState(false);

  const [connectionsOpen, setConnectionsOpen] =
    useState(false);

  const [connectionType, setConnectionType] =
    useState("followers");

  const [connections, setConnections] =
    useState([]);

  const [connectionsLoading, setConnectionsLoading] =
    useState(false);

  const [connectionsError, setConnectionsError] =
    useState("");


  useEffect(() => {
    const checkFollowStatus = async () => {

      // Own profile doesn't need follow status
      if (isOwnProfile) {
        setFollowed(false);
        return;
      }

      try {

        const token =
          localStorage.getItem("token");

        if (!token) return;

        const API_URL =
          `http://${window.location.hostname}:5000`;

        const response = await fetch(
          `${API_URL}/api/follow/status/${encodeURIComponent(
            viewedUsername
          )}`,
          {
            method: "GET",
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
            "Follow status error:",
            data
          );
          return;
        }

        setFollowed(
          data.following === true
        );

      } catch (error) {

        console.error(
          "Check follow status error:",
          error
        );

      }
    };

    checkFollowStatus();

  }, [
    viewedUsername,
    isOwnProfile,
  ]);


  /*
  ============================================================
  i-NOTES
  */

  const [notes, setNotes] = useState([]);

const [noteText, setNoteText] = useState("");

const [notesLoading, setNotesLoading] = useState(false);

// ==========================================
// LOAD i-NOTES FROM BACKEND
// ==========================================

useEffect(() => {
  const fetchNotes = async () => {
    try {
      setNotesLoading(true);

      const token = localStorage.getItem("token");

      if (!token) return;

      const API_URL =
        `http://${window.location.hostname}:5000`;

      const notesUrl = isOwnProfile
        ? `${API_URL}/api/notes`
        : `${API_URL}/api/notes/user/${encodeURIComponent(
            viewedUsername
          )}`;

      const response = await fetch(notesUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

  const [editOpen, setEditOpen] =
    useState(false);

  const [name, setName] =
    useState(selectedUser.name);

  const [username, setUsername] =
    useState(selectedUser.username);

  const [bio, setBio] =
    useState(selectedUser.bio);

  const [profilePic, setProfilePic] =
    useState(selectedUser.profilePic);


  const [tempName, setTempName] =
    useState(selectedUser.name);

  const [tempUsername, setTempUsername] =
    useState(selectedUser.username);

  const [tempBio, setTempBio] =
    useState(selectedUser.bio);


  /*
  ============================================================
  SYNC PROFILE DATA
  */

  useEffect(() => {

    if (!profileData) return;

    setName(
      profileData.name || ""
    );

    setUsername(
      profileData.username || ""
    );

    setBio(
      profileData.bio || ""
    );

    setProfilePic(
      profileData.profilePicture ||
        "https://i.pravatar.cc/300?img=32"
    );

  }, [profileData]);


  /*
  ============================================================
  PROFILE IMAGE VIEWER
  */

  const [imageViewerOpen, setImageViewerOpen] =
    useState(false);


  /*
  ============================================================
  PROFILE IMAGE CROP
  */

  const [cropOpen, setCropOpen] =
    useState(false);

  const [cropImage, setCropImage] =
    useState("");

  const [cropZoom, setCropZoom] =
    useState(1);

  const [cropX, setCropX] =
    useState(0);

  const [cropY, setCropY] =
    useState(0);


  const fileInputRef =
    useRef(null);

  const cropAreaRef =
    useRef(null);

  const dragRef =
    useRef({
      active: false,
      startX: 0,
      startY: 0,
      originalX: 0,
      originalY: 0,
    });


 /*
  ============================================================
  BADGE / STAR SYSTEM — V1 LOCKED
  ============================================================
*/

const impressions = Number(
  selectedUser.impressions || 0
);

const badges = Math.floor(impressions / 100);

const starLevels = [
  {
    min: 1,
    impressions: 100,
    name: "i Bronze Star",
    icon: "★",
    className: "bronze",
  },
  {
    min: 3,
    impressions: 300,
    name: "i Silver Star",
    icon: "★",
    className: "silver",
  },
  {
    min: 5,
    impressions: 500,
    name: "i Gold Star",
    icon: "★",
    className: "gold",
  },
  {
    min: 7,
    impressions: 700,
    name: "Legend",
    icon: "★",
    className: "legend",
  },
  {
    min: 15,
    impressions: 1500,
    name: "i Pro",
    icon: "★",
    className: "pro",
  },
];

const currentStar =
  [...starLevels]
    .reverse()
    .find(
      (star) => badges >= star.min
    ) || {
      min: 0,
      impressions: 0,
      name: "No Star",
      icon: "☆",
      className: "none",
    };

const nextStar = starLevels.find(
  (star) => badges < star.min
);

const progress = nextStar
  ? Math.min(
      100,
      Math.max(
        0,
        (
          (impressions -
            currentStar.impressions) /
          (nextStar.impressions -
            currentStar.impressions)
        ) * 100
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

  const posts = profilePosts.map(
    (post) => {

      const firstMedia =
        post.media?.[0];

      let image =
        typeof firstMedia === "string"
          ? firstMedia
          : firstMedia?.url ||
            firstMedia?.path ||
            firstMedia?.src;


      if (image?.startsWith("/")) {

        image =
          `http://${window.location.hostname}:5000${image}`;

      }


      if (
        image?.startsWith(
          "http://localhost:5000"
        )
      ) {

        image =
          image.replace(
            "http://localhost:5000",
            `http://${window.location.hostname}:5000`
          );

      }


      return {
        id: post._id,

        image:
          image ||
          "https://picsum.photos/500/500",
      };

    }
  );


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
    alert(
      "i-Notes can contain a maximum of 6 lines."
    );
    return;
  }

  if (notes.length >= 10) {
    alert(
      "You can have a maximum of 10 i-Notes."
    );
    return;
  }

  try {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please sign in again.");
      return;
    }

    const API_URL =
      `http://${window.location.hostname}:5000`;

    const response = await fetch(
      `${API_URL}/api/notes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(
        data.message ||
          "Unable to create i-Note."
      );
      return;
    }

    setNotes((currentNotes) => [
      {
        id: data.note._id,
        text: data.note.text,
      },
      ...currentNotes,
    ]);

    setNoteText("");
  } catch (error) {
    console.error(
      "Create i-Note error:",
      error
    );

    alert(
      "Unable to connect to Impressa server."
    );
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

      const token =
        localStorage.getItem("token");

      if (!token) {

        alert(
          "Please sign in again."
        );

        return;
      }


      const API_URL =
        `http://${window.location.hostname}:5000`;


      const updatedName =
        tempName.trim();

      const updatedUsername =
        tempUsername.trim().toLowerCase();

      const updatedBio =
        tempBio.trim();


      if (!updatedName) {

        alert(
          "Profile name cannot be empty."
        );

        return;
      }


      if (!updatedUsername) {

        alert(
          "Username cannot be empty."
        );

        return;
      }


      const response =
        await fetch(
          `${API_URL}/api/profile/me`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              name:
                updatedName,

              username:
                updatedUsername,

              bio:
                updatedBio,

              profilePicture:
                profilePic,
            }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        alert(
          data.message ||
            "Unable to update profile."
        );

        return;
      }


      /*
      ----------------------------------------------------------
      UPDATE CURRENT PROFILE
      ----------------------------------------------------------
      */

      setProfileData(
        data.user
      );

      setName(
        data.user.name
      );

      setUsername(
        data.user.username
      );

      setBio(
        data.user.bio || ""
      );

      setProfilePic(
        data.user.profilePicture ||
          "https://i.pravatar.cc/300?img=32"
      );


      /*
      ----------------------------------------------------------
      UPDATE LOCAL STORAGE USER
      ----------------------------------------------------------
      */

      const storedUser =
        JSON.parse(
          localStorage.getItem("user") ||
            "null"
        );


      if (storedUser) {

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...storedUser,

            id:
              data.user.id,

            name:
              data.user.name,

            username:
              data.user.username,

            bio:
              data.user.bio,

            profilePicture:
              data.user.profilePicture,

            badge:
              data.user.badge,
          })
        );

      }


      /*
      ----------------------------------------------------------
      CLOSE EDIT MODAL
      ----------------------------------------------------------
      */

      setEditOpen(false);


      alert(
        "Profile updated successfully 🎉"
      );

    } catch (error) {

      console.error(
        "Save profile error:",
        error
      );


      alert(
        "Unable to connect to Impressa server."
      );

    }

  };


  /*
  ============================================================
  SELECT PROFILE IMAGE
  ============================================================
  */

  const selectProfileImage = (
    event
  ) => {

    const file =
      event.target.files?.[0];

    if (!file) return;


    if (!file.type.startsWith("image/")) {

      alert(
        "Please select an image."
      );

      return;

    }


    const imageUrl =
      URL.createObjectURL(file);


    setCropImage(
      imageUrl
    );

    setCropZoom(1);

    setCropX(0);

    setCropY(0);

    setCropOpen(true);

  };


  /*
  ============================================================
  CROP DRAG
  ============================================================
  */

  const startCropDrag = (
    event
  ) => {

    event.preventDefault();


    dragRef.current = {

      active: true,

      startX:
        event.clientX,

      startY:
        event.clientY,

      originalX:
        cropX,

      originalY:
        cropY,

    };


    window.addEventListener(
      "pointermove",
      moveCropDrag
    );

    window.addEventListener(
      "pointerup",
      stopCropDrag
    );

  };


  const moveCropDrag = (
    event
  ) => {

    if (
      !dragRef.current.active
    ) {

      return;

    }


    const deltaX =
      event.clientX -
      dragRef.current.startX;


    const deltaY =
      event.clientY -
      dragRef.current.startY;


    setCropX(
      dragRef.current.originalX +
      deltaX
    );


    setCropY(
      dragRef.current.originalY +
      deltaY
    );

  };


  const stopCropDrag = () => {

    dragRef.current.active =
      false;


    window.removeEventListener(
      "pointermove",
      moveCropDrag
    );


    window.removeEventListener(
      "pointerup",
      stopCropDrag
    );

  };


  /*
  ============================================================
  APPLY CROP
  ============================================================
  */

  const applyCrop = async () => {

    if (!cropImage) return;


    try {

      /*
      Convert temporary browser image URL
      into a permanent data URL so the backend
      can actually save the image.
      */

      const response =
        await fetch(
          cropImage
        );

      const blob =
        await response.blob();


      const reader =
        new FileReader();


      reader.onloadend = () => {

        setProfilePic(
          reader.result
        );


        setCropOpen(false);


        URL.revokeObjectURL(
          cropImage
        );


        setCropImage("");


        if (fileInputRef.current) {

          fileInputRef.current.value =
            "";

        }

      };


      reader.readAsDataURL(
        blob
      );

    } catch (error) {

      console.error(
        "Profile image processing error:",
        error
      );


      alert(
        "Unable to process this image."
      );

    }

  };


  const cancelCrop = () => {

    setCropOpen(false);


    if (cropImage) {

      URL.revokeObjectURL(
        cropImage
      );

    }


    setCropImage("");

    setCropZoom(1);

    setCropX(0);

    setCropY(0);


    if (fileInputRef.current) {

      fileInputRef.current.value =
        "";

    }

  };


  /*
  ============================================================
  NAVIGATION
  ============================================================
  */

  const openAccountCenter = () => {

    setMenuOpen(false);

    navigate(
      "/account-center"
    );

  };


  const openAccountSettings = () => {

    setMenuOpen(false);

    navigate(
      "/account-settings"
    );

  };


  const openPrivacy = () => {

    setMenuOpen(false);

    navigate(
      "/privacy"
    );

  };


  const openNotifications = () => {

    setMenuOpen(false);

    navigate(
      "/notifications"
    );

  };


  /*
    HELP NOW CONNECTS TO THE EXISTING Help.jsx
  */

  const openHelp = () => {

    setMenuOpen(false);

    navigate("/help");

  };


  /*
    LOGOUT GOES TO THE EXISTING SIGN-IN PAGE
  */

  const handleLogout = () => {

    setMenuOpen(false);

    navigate("/signin");

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

    const API_URL = `http://${window.location.hostname}:5000`;

    // ⚡ Change button immediately
    setFollowed(!oldFollowed);

    // ⚡ Change follower count immediately
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Roll back only if backend fails
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

    // ✅ Keep the button state we already set.
    // Only sync the final follower count.
    setProfileData((previous) => {
      if (!previous) return previous;

      return {
        ...previous,
        followersCount: data.followersCount,
      };
    });

  } catch (error) {
    console.error("Follow error:", error);

    // Roll back only if connection fails
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
  OPEN FOLLOWERS
  ============================================================
  */

  const openConnections = async (type) => {

    setConnectionType(type);
    setConnectionsOpen(true);
    setConnections([]);
    setConnectionsError("");
    setConnectionsLoading(true);

    try {

      const token =
        localStorage.getItem("token");

      const API_URL =
        `http://${window.location.hostname}:5000`;

      const response = await fetch(
        `${API_URL}/api/profile/${encodeURIComponent(
          selectedUser.username
        )}/${type}`,
        {
          method: "GET",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Unable to load ${type}.`
        );
      }

      const users =
        data.users ||
        data[type] ||
        data.followers ||
        data.following ||
        [];

      setConnections(
        Array.isArray(users) ? users : []
      );

    } catch (error) {

      console.error(
        `Load ${type} error:`,
        error
      );

      setConnectionsError(
        error.message ||
          `Unable to load ${type}.`
      );

    } finally {

      setConnectionsLoading(false);

    }

  };


  const openFollowers = () => {
    openConnections("followers");
  };


  /*
  ============================================================
  OPEN FOLLOWING
  ============================================================
  */

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
      `/profile/${encodeURIComponent(
        selectedUser.username
      )}/posts`
    );

  };


  /*
  ============================================================
  CLEANUP CROP IMAGE
  ============================================================
  */

  useEffect(() => {

    return () => {

      if (
        cropImage &&
        cropImage.startsWith("blob:")
      ) {

        URL.revokeObjectURL(
          cropImage
        );

      }

    };

  }, [cropImage]);


  /*
  ============================================================
  LOADING / ERROR
  ============================================================
  */

  if (profileLoading) {

    return (

      <div className="profile-page">

        <div className="profile-content">

          <p>
            Loading profile...
          </p>

        </div>

      </div>

    );

  }


  if (profileError) {

    return (

      <div className="profile-page">

        <div className="profile-content">

          <p>
            {profileError}
          </p>

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
          onClick={() =>
            navigate(-1)
          }
          aria-label="Go back"
        >
          ←
        </button>


        <button
          className="menu-button"
          onClick={() =>
            setMenuOpen(!menuOpen)
          }
          aria-label="Profile menu"
        >
          ☰
        </button>


        {menuOpen && (

          <div className="profile-menu">


            {isOwnProfile && (

              <button
                onClick={openEdit}
              >
                ✏️ Edit Profile
              </button>

            )}


            {/* =================================================
                NEW ACCOUNT CENTER
            ================================================= */}

            {isOwnProfile && (

              <button
                onClick={openAccountCenter}
              >
                👥 Account Center
              </button>

            )}


            <button
              onClick={
                openAccountSettings
              }
            >
              ⚙️ Account Settings
            </button>


            <button
              onClick={openPrivacy}
            >
              🔒 Privacy
            </button>


            <button
              onClick={
                openNotifications
              }
            >
              🔔 Notifications
            </button>


            {/* =================================================
                HELP → Help.jsx
            ================================================= */}

            <button
              onClick={openHelp}
            >
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

                  <h3>
                    No {connectionType} yet
                  </h3>

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
                  "https://i.pravatar.cc/150?img=32";

                if (!userUsername) return null;

                return (
                  <button
                    type="button"
                    className="connection-user"
                    key={user._id || user.id || userUsername}
                    onClick={() => {
                      closeConnections();
                      navigate(
                        `/profile/${encodeURIComponent(
                          userUsername
                        )}`
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

                    <span className="connection-arrow">
                      →
                    </span>

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


        {/* CLICKABLE PROFILE IMAGE */}

        <button
          type="button"
          className="profile-picture-button"
          onClick={() =>
            setImageViewerOpen(true)
          }
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

              <h1>
                {name}
              </h1>


              <div className="profile-username-row">

                <p className="profile-username">
                  @{username}
                </p>

                {/* ==========================================
                    OFFICIAL IMPRESSA ACCOUNT
                    ========================================== */}

                {profileData?.isOfficial === true && (
                  <span
                    className="profile-official-badge"
                    aria-label="Official Impressa account"
                    title="Official Impressa account"
                  />
                )}


                {animationBadgeLevel > 0 && (

                  <BadgeAnimation
                    badgeLevel={
                      animationBadgeLevel
                    }
                    animate={true}
                  />

                )}

              </div>

            </div>

          </div>


          <p className="profile-bio">
            {bio}
          </p>


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
                followed
                  ? "following-btn"
                  : ""
              }`}
              onClick={handleFollow}
            >
              {followed
                ? "Following"
                : "Follow"}
            </button>

          )}

        </div>

      </section>


      {/* =====================================================
          STATS
      ===================================================== */}

      <div className="profile-stats">


        <div className="stat">

          <strong>
            {posts.length}
          </strong>

          <span>
            Posts
          </span>

        </div>


        <button
          type="button"
          className="stat stat-button"
          onClick={openFollowers}
          aria-label={`View ${selectedUser.username}'s followers`}
        >

          <strong>
            {selectedUser.followers}
          </strong>

          <span>
            Followers
          </span>

        </button>


        <button
          type="button"
          className="stat stat-button"
          onClick={openFollowing}
          aria-label={`View ${selectedUser.username}'s following`}
        >

          <strong>
            {selectedUser.following}
          </strong>

          <span>
            Following
          </span>

        </button>


        <div className="stat impression-stat">

          <strong>
            {selectedUser.impressions}
          </strong>

          <span>
            Impressions
          </span>

        </div>


      </div>


      {/* =====================================================
          CURRENT BADGE
      ===================================================== */}

      <section className="badge-section">

        <div
          className={`badge-card ${
            currentStar.className
          }`}
        >

          <div
            className={`badge-star ${
              currentStar.className
            }`}
          >

            <span>
              {currentStar.icon}
            </span>

          </div>


          <div className="badge-details">

            <h2>
              {currentStar.name}
            </h2>


            <p>
              {badges} badges · 100 impressions = 1 badge
            </p>


            <div className="progress-bar">

              <div
                className="progress-fill"
                style={{
                  width:
                    `${progress}%`,
                }}
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

        {starLevels.map(
          (star) => (

            <div
              className={`star-level ${
                badges >= star.min
                  ? "unlocked"
                  : ""
              } ${
                star.className
              }`}
              key={star.name}
            >

              <div className="chart-star">
                {star.icon}
              </div>


              <strong>
                {star.min}
              </strong>


              <span>
                {star.name}
              </span>

            </div>

          )
        )}

      </div>


      {/* =====================================================
          TABS
      ===================================================== */}

      <div className="profile-tabs">


        <button
          className={
            activeTab === "posts"
              ? "active-tab"
              : ""
          }
          onClick={() =>
            setActiveTab("posts")
          }
        >
          ▦ Posts
        </button>


        <button
          className={
            activeTab === "notes"
              ? "active-tab"
              : ""
          }
          onClick={() =>
            setActiveTab("notes")
          }
        >
          ✎ i-Notes
        </button>


      </div>


      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div className="profile-content">


        {/* POSTS */}

        {activeTab === "posts" && (

          <div className="posts-grid">

            {posts.map(
              (post) => (

                <button
                  className="post-card"
                  key={post.id}
                  type="button"
                  onClick={
                    openUserPosts
                  }
                  aria-label={`Open ${selectedUser.username}'s posts`}
                >

                  <img
                    src={post.image}
                    alt={`Post ${post.id}`}
                  />

                </button>

              )
            )}

          </div>

        )}


        {/* =================================================
            i-NOTES
        ================================================= */}

        {activeTab === "notes" && (

          <div className="notes-area">


            {isOwnProfile && (

              <div className="note-composer">

                <textarea
                  value={noteText}
                  onChange={(e) =>
                    setNoteText(
                      e.target.value
                    )
                  }
                  placeholder="Write an i-Note... (maximum 6 lines)"
                  rows={6}
                />


                <div className="note-actions">

                  <span>

                    {
                      noteText
                        .split("\n")
                        .filter(Boolean)
                        .length
                    }

                    /6 lines · {notes.length}/10 notes

                  </span>


                  <button
                    onClick={addNote}
                    disabled={
                      notes.length >= 10
                    }
                  >
                    Post i-Note
                  </button>

                </div>

              </div>

            )}


            {notes.length === 0 ? (

              <div className="empty-content">

                <div>
                  ✎
                </div>


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

              notes.map(
                (note) => (

                  <div
                    className="public-note"
                    key={note.id}
                  >

                    <div className="note-header">

                      <div>

                        <strong>
                          {name}
                        </strong>

                        <span>
                          @{username}
                        </span>

                      </div>


                      {isOwnProfile && (

                        <button
                          className="delete-note"
                          onClick={() =>
                            deleteNote(
                              note.id
                            )
                          }
                          title="Delete i-Note"
                        >
                          🗑
                        </button>

                      )}

                    </div>


                    <p>
                      {note.text}
                    </p>

                  </div>

                )
              )

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
          onClick={() =>
            setImageViewerOpen(false)
          }
        >

          <button
            type="button"
            className="profile-image-viewer-close"
            onClick={() =>
              setImageViewerOpen(false)
            }
            aria-label="Close profile image"
          >
            ×
          </button>


          <img
            src={profilePic}
            alt={`${name}'s enlarged profile`}
            className="profile-image-large"
            onClick={(event) =>
              event.stopPropagation()
            }
          />

        </div>

      )}


      {/* =====================================================
          EDIT PROFILE
      ===================================================== */}

      {editOpen && (

        <div
          className="edit-overlay"
          onClick={() =>
            setEditOpen(false)
          }
        >

          <div
            className="edit-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="edit-modal-header">

              <h2>
                Change Profile
              </h2>


              <button
                onClick={() =>
                  setEditOpen(false)
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>


            <label>
              Profile Picture
            </label>


            <div className="edit-profile-photo">

              <img
                src={profilePic}
                alt="Current profile"
              />


              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                Choose Media
              </button>

            </div>


            <input
              ref={fileInputRef}
              className="hidden-file-input"
              type="file"
              accept="image/*"
              onChange={
                selectProfileImage
              }
            />


            <label>
              Profile Name
            </label>


            <input
              value={tempName}
              onChange={(e) =>
                setTempName(
                  e.target.value
                )
              }
            />


            <label>
              Username
            </label>


            <input
              value={tempUsername}
              onChange={(e) =>
                setTempUsername(
                  e.target.value
                )
              }
            />


            <label>
              Bio
            </label>


            <textarea
              value={tempBio}
              onChange={(e) =>
                setTempBio(
                  e.target.value
                )
              }
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

                <span>
                  IMPRESSA
                </span>

                <h2>
                  Set Profile Picture
                </h2>

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
              Drag the image to position it and
              use the slider to zoom.
            </p>


            <div
              ref={cropAreaRef}
              className="crop-area"
              onPointerDown={
                startCropDrag
              }
            >

              <div className="crop-circle">

                <img
                  src={cropImage}
                  alt="Crop preview"
                  draggable="false"
                  className="crop-image"
                  style={{
                    transform:
                      `translate(${cropX}px, ${cropY}px) scale(${cropZoom})`,
                  }}
                />

              </div>

            </div>


            <div className="crop-controls">

              <label>
                Zoom
              </label>


              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={cropZoom}
                onChange={(e) =>
                  setCropZoom(
                    Number(
                      e.target.value
                    )
                  )
                }
              />

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
              >
                Use Photo
              </button>

            </div>


          </div>

        </div>

      )}

    </div>

  );

}


export default Profile;