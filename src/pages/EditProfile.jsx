import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./EditProfile.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const OUTPUT_SIZE = 512;
const MAX_ZOOM = 3;

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch (error) {
    return null;
  }
};

const getCachedProfile = () => {
  try {
    const username = getStoredUser()?.username;

    if (!username) return null;

    return JSON.parse(
      localStorage.getItem(`impressa_profile_${username.toLowerCase()}`) ||
        "null"
    );
  } catch (error) {
    return null;
  }
};

function EditProfile() {
  const navigate = useNavigate();

  const [cached] = useState(getCachedProfile);

  const [name, setName] = useState(cached?.name || "");
  const [username, setUsername] = useState(cached?.username || "");
  const [bio, setBio] = useState(cached?.bio || "");
  const [profilePicture, setProfilePicture] = useState(
    cached?.profilePicture || ""
  );

  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);

  // If the user starts typing before the background refresh lands,
  // the refresh must not overwrite what they typed.
  const dirtyRef = useRef(false);

  // ==========================================
  // CROP STATE
  // ==========================================

  const [selectedImage, setSelectedImage] = useState("");
  const [isCropping, setIsCropping] = useState(false);
  const [applyingCrop, setApplyingCrop] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  const cropCircleRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({
    origX: 0,
    origY: 0,
    origZoom: 1,
    p0: { x: 0, y: 0 },
    dist: 0,
  });
  const selectedImageRef = useRef("");

  useEffect(() => {
    selectedImageRef.current = selectedImage;
  }, [selectedImage]);

  useEffect(() => {
    return () => {
      if (selectedImageRef.current) {
        URL.revokeObjectURL(selectedImageRef.current);
      }
    };
  }, []);

  // ==========================================
  // LOAD CURRENT PROFILE
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/signin");
          return;
        }

        const response = await fetch(`${API_URL}/api/profile/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          if (!cached) {
            alert(data.message || "Unable to load profile");
          }
          return;
        }

        const user = data.user;

        if (!dirtyRef.current) {
          setName(user.name || "");
          setUsername(user.username || "");
          setBio(user.bio || "");
          setProfilePicture(user.profilePicture || "");
        }

        localStorage.setItem(
          `impressa_profile_${(user.username || "").toLowerCase()}`,
          JSON.stringify(user)
        );
      } catch (error) {
        if (cancelled) return;

        console.error("Edit profile loading error:", error);

        if (!cached) {
          alert("Cannot connect to Impressa server.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ==========================================
  // CHOOSE PROFILE PICTURE
  // ==========================================

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image.");
      event.target.value = "";
      return;
    }

    if (selectedImageRef.current) {
      URL.revokeObjectURL(selectedImageRef.current);
    }

    setSelectedImage(URL.createObjectURL(file));
    setNatural({ w: 0, h: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    pointersRef.current.clear();
    setIsCropping(true);

    event.target.value = "";
  };

  // ==========================================
  // CROP GEOMETRY
  // The image is sized to "cover" the circle, then zoomed and
  // panned. Pan is clamped so the circle is always fully covered.
  // ==========================================

  const getBounds = (nextZoom) => {
    const circle = cropCircleRef.current;

    if (!circle || !natural.w || !natural.h) {
      return { maxX: 0, maxY: 0, size: 0, cover: 1 };
    }

    const size = circle.getBoundingClientRect().width;
    const cover = Math.max(size / natural.w, size / natural.h);

    return {
      size,
      cover,
      maxX: Math.max(0, (natural.w * cover * nextZoom - size) / 2),
      maxY: Math.max(0, (natural.h * cover * nextZoom - size) / 2),
    };
  };

  const clampOffset = (x, y, nextZoom) => {
    const { maxX, maxY } = getBounds(nextZoom);

    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(1, value));

  const handleCropImageLoad = (event) => {
    setNatural({
      w: event.target.naturalWidth,
      h: event.target.naturalHeight,
    });
  };

  // ==========================================
  // CROP GESTURES — drag to pan, pinch to zoom
  // ==========================================

  const startGesture = () => {
    const points = Array.from(pointersRef.current.values());

    if (points.length === 0) return;

    gestureRef.current = {
      origX: offset.x,
      origY: offset.y,
      origZoom: zoom,
      p0: points[0],
      dist:
        points.length >= 2
          ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
          : 0,
    };
  };

  const handlePointerDown = (event) => {
    event.preventDefault();

    event.currentTarget.setPointerCapture?.(event.pointerId);

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    startGesture();
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const points = Array.from(pointersRef.current.values());
    const gesture = gestureRef.current;

    if (points.length >= 2 && gesture.dist > 0) {
      const distance = Math.hypot(
        points[1].x - points[0].x,
        points[1].y - points[0].y
      );

      const nextZoom = clampZoom(gesture.origZoom * (distance / gesture.dist));

      setZoom(nextZoom);
      setOffset(clampOffset(gesture.origX, gesture.origY, nextZoom));
      return;
    }

    if (points.length === 1) {
      setOffset(
        clampOffset(
          gesture.origX + (points[0].x - gesture.p0.x),
          gesture.origY + (points[0].y - gesture.p0.y),
          zoom
        )
      );
    }
  };

  const handlePointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);
    startGesture();
  };

  const handleZoomSlider = (event) => {
    const nextZoom = clampZoom(Number(event.target.value));

    setZoom(nextZoom);
    setOffset((previous) => clampOffset(previous.x, previous.y, nextZoom));
  };

  const resetCrop = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // ==========================================
  // APPLY CROP — exactly what the circle shows
  // ==========================================

  const applyCrop = () => {
    if (!selectedImage || applyingCrop) return;

    const { size, cover } = getBounds(zoom);

    if (!size || !natural.w) return;

    setApplyingCrop(true);

    const image = new Image();

    image.onload = () => {
      const scale = cover * zoom;
      const sourceSize = size / scale;

      const centerX = natural.w / 2 - offset.x / scale;
      const centerY = natural.h / 2 - offset.y / scale;

      const sourceX = Math.min(
        natural.w - sourceSize,
        Math.max(0, centerX - sourceSize / 2)
      );

      const sourceY = Math.min(
        natural.h - sourceSize,
        Math.max(0, centerY - sourceSize / 2)
      );

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      const context = canvas.getContext("2d");

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      );

      dirtyRef.current = true;
      setProfilePicture(canvas.toDataURL("image/jpeg", 0.85));

      URL.revokeObjectURL(selectedImage);
      setSelectedImage("");
      setIsCropping(false);
      setApplyingCrop(false);
    };

    image.onerror = () => {
      setApplyingCrop(false);
      alert("Unable to process this image.");
    };

    image.src = selectedImage;
  };

  const cancelCrop = () => {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
    }

    setSelectedImage("");
    setIsCropping(false);
    pointersRef.current.clear();
  };

  // ==========================================
  // SAVE PROFILE
  // ==========================================

  const handleSave = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (!name.trim()) {
      alert("Name is required.");
      return;
    }

    if (!username.trim()) {
      alert("Username is required.");
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/signin");
        return;
      }

      const response = await fetch(`${API_URL}/api/profile/me`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim(),
          profilePicture,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to update profile.");
        return;
      }

      if (data.user) {
        // Merge — never replace — the stored user, so fields the
        // rest of the app depends on are not lost.
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...(getStoredUser() || {}),
            id: data.user.id,
            name: data.user.name,
            username: data.user.username,
            bio: data.user.bio,
            profilePicture: data.user.profilePicture,
            badge: data.user.badge,
          })
        );

        localStorage.setItem(
          `impressa_profile_${data.user.username.toLowerCase()}`,
          JSON.stringify(data.user)
        );
      }

      alert("Profile updated successfully 🎉");

      navigate("/profile");
    } catch (error) {
      console.error("Save profile error:", error);

      alert("Unable to connect to Impressa server.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // LOADING (only when nothing cached)
  // ==========================================

  if (loading) {
    return (
      <main className="edit-profile-page">
        <div className="edit-profile-loading">Loading profile...</div>
      </main>
    );
  }

  // ==========================================
  // CROP SCREEN
  // ==========================================

  if (isCropping && selectedImage) {
    const isPortrait = natural.h > natural.w;

    return (
      <main className="edit-profile-page">
        <div className="edit-profile-crop-card">
          <div className="edit-profile-crop-header">
            <button
              type="button"
              onClick={cancelCrop}
              className="edit-profile-back"
            >
              ←
            </button>

            <div>
              <span>IMPRESSA</span>
              <h1>Crop photo</h1>
            </div>
          </div>

          <div
            className="edit-profile-crop-area"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: "none" }}
          >
            <div
              className="edit-profile-crop-circle"
              ref={cropCircleRef}
              style={{
                position: "relative",
                overflow: "hidden",
                touchAction: "none",
              }}
            >
              <img
                src={selectedImage}
                alt="Crop preview"
                draggable="false"
                onLoad={handleCropImageLoad}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: isPortrait ? "100%" : "auto",
                  height: isPortrait ? "auto" : "100%",
                  maxWidth: "none",
                  maxHeight: "none",
                  transformOrigin: "center",
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>

          <div className="edit-profile-crop-controls">
            <label>Drag to move · pinch or slide to zoom</label>

            <input
              type="range"
              min="1"
              max={MAX_ZOOM}
              step="0.01"
              value={zoom}
              onChange={handleZoomSlider}
            />

            <button
              type="button"
              onClick={resetCrop}
              style={{
                marginTop: "8px",
                padding: "6px 12px",
                border: "1px solid #eeeeee",
                borderRadius: "999px",
                background: "#ffffff",
                color: "#777777",
                fontSize: "10px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>

          <div className="edit-profile-crop-actions">
            <button
              type="button"
              className="edit-profile-cancel"
              onClick={cancelCrop}
            >
              Cancel
            </button>

            <button
              type="button"
              className="edit-profile-apply"
              onClick={applyCrop}
              disabled={applyingCrop || !natural.w}
            >
              {applyingCrop ? "Applying..." : "Apply Crop"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // EDIT PROFILE
  // ==========================================

  return (
    <main className="edit-profile-page">
      <div className="edit-profile-glow edit-profile-glow-one" />
      <div className="edit-profile-glow edit-profile-glow-two" />

      <div className="edit-profile-container">
        <header className="edit-profile-header">
          <button
            type="button"
            className="edit-profile-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>

          <div>
            <span>IMPRESSA</span>
            <h1>Edit Profile</h1>
            <p>Make your profile yours.</p>
          </div>
        </header>

        <section className="edit-profile-card">
          <div className="edit-profile-picture-section">
            <button
              type="button"
              className="edit-profile-picture-button"
              onClick={() =>
                document.getElementById("profile-picture-input")?.click()
              }
            >
              {profilePicture ? (
                <img src={profilePicture} alt="Profile" />
              ) : (
                <div className="edit-profile-picture-placeholder">
                  <span>+</span>
                </div>
              )}

              <div className="edit-profile-picture-edit">✎</div>
            </button>

            <input
              id="profile-picture-input"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              hidden
            />

            <p>Tap to change profile picture</p>
          </div>

          <form className="edit-profile-form" onSubmit={handleSave}>
            <div className="edit-profile-field">
              <label htmlFor="edit-name">Name</label>

              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(event) => {
                  dirtyRef.current = true;
                  setName(event.target.value);
                }}
                placeholder="Your name"
                maxLength={50}
              />
            </div>

            <div className="edit-profile-field">
              <label htmlFor="edit-username">Username</label>

              <div className="edit-profile-username-input">
                <span>@</span>

                <input
                  id="edit-username"
                  type="text"
                  value={username}
                  onChange={(event) => {
                    dirtyRef.current = true;
                    setUsername(event.target.value.replace(/\s/g, ""));
                  }}
                  placeholder="username"
                  maxLength={30}
                />
              </div>
            </div>

            <div className="edit-profile-field">
              <div className="edit-profile-bio-header">
                <label htmlFor="edit-bio">Bio</label>

                <span>{bio.length}/150</span>
              </div>

              <textarea
                id="edit-bio"
                value={bio}
                onChange={(event) => {
                  dirtyRef.current = true;
                  setBio(event.target.value);
                }}
                placeholder="Tell people something about you..."
                maxLength={150}
                rows={4}
              />
            </div>

            <button
              type="submit"
              className="edit-profile-save"
              disabled={saving || !name.trim() || !username.trim()}
            >
              {saving ? (
                <span className="edit-profile-loader">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <>
                  <span>Save Changes</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>
        </section>

        <p className="edit-profile-footer">
          © {new Date().getFullYear()} Impressa
        </p>
      </div>
    </main>
  );
}

export default EditProfile;