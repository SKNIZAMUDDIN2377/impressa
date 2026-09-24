import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./EditProfile.css";

function EditProfile() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  const [profilePicture, setProfilePicture] = useState("");
  const [selectedImage, setSelectedImage] = useState("");

  const [isCropping, setIsCropping] = useState(false);
  const [cropPosition, setCropPosition] = useState({
    x: 50,
    y: 50,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

  // =====================================================
  // LOAD CURRENT PROFILE
  // =====================================================

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/SignIn");
          return;
        }

        const response = await fetch(
          `${API_URL}/api/profile/me`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          alert(data.message || "Unable to load profile");
          return;
        }

        const user = data.user;

        setName(user.name || "");
        setUsername(user.username || "");
        setBio(user.bio || "");
        setProfilePicture(user.profilePicture || "");
      } catch (error) {
        console.error(
          "Edit profile loading error:",
          error
        );

        alert(
          "Cannot connect to Impressa server."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate, API_URL]);

  // =====================================================
  // CHOOSE PROFILE PICTURE
  // =====================================================

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setSelectedImage(reader.result);
      setIsCropping(true);

      setCropPosition({
        x: 50,
        y: 50,
      });
    };

    reader.readAsDataURL(file);

    // Allows selecting the same image again
    event.target.value = "";
  };

  // =====================================================
  // CROP POSITION
  // =====================================================

  const handleCropChange = (event) => {
    setCropPosition({
      ...cropPosition,
      x: event.target.value,
    });
  };

  // =====================================================
  // APPLY CROP
  // =====================================================

  const applyCrop = () => {
    if (!selectedImage) return;

    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");

      const size = Math.min(
        image.naturalWidth,
        image.naturalHeight
      );

      canvas.width = 600;
      canvas.height = 600;

      const context = canvas.getContext("2d");

      const maxX =
        image.naturalWidth - size;

      const maxY =
        image.naturalHeight - size;

      const sourceX =
        (maxX * Number(cropPosition.x)) / 100;

      const sourceY =
        (maxY * Number(cropPosition.y)) / 100;

      context.drawImage(
        image,
        sourceX,
        sourceY,
        size,
        size,
        0,
        0,
        600,
        600
      );

      const croppedImage =
        canvas.toDataURL("image/jpeg", 0.9);

      setProfilePicture(croppedImage);
      setSelectedImage("");
      setIsCropping(false);
    };

    image.src = selectedImage;
  };

  // =====================================================
  // CANCEL CROP
  // =====================================================

  const cancelCrop = () => {
    setSelectedImage("");
    setIsCropping(false);
  };

  // =====================================================
  // SAVE PROFILE
  // =====================================================

  const handleSave = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      alert("Name is required.");
      return;
    }

    if (!username.trim()) {
      alert("Username is required.");
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/SignIn");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/profile/update`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            name: name.trim(),
            username: username.trim(),
            bio: bio.trim(),
            profilePicture,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.message ||
            "Failed to update profile."
        );
        return;
      }

      // Update local user information
      if (data.user) {
        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );
      }

      alert("Profile updated successfully 🎉");

      navigate("/profile");
    } catch (error) {
      console.error(
        "Save profile error:",
        error
      );

      alert(
        "Unable to connect to Impressa server."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="edit-profile-page">
        <div className="edit-profile-loading">
          Loading profile...
        </div>
      </main>
    );
  }

  // =====================================================
  // CROP SCREEN
  // =====================================================

  if (isCropping && selectedImage) {
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
              <span>
                IMPRESSA
              </span>

              <h1>
                Crop photo
              </h1>
            </div>
          </div>

          <div className="edit-profile-crop-area">

            <div className="edit-profile-crop-circle">

              <img
                src={selectedImage}
                alt="Crop preview"
                style={{
                  left: `${50 - cropPosition.x / 2}%`,
                  top: `${50 - cropPosition.x / 2}%`,
                }}
              />

            </div>

          </div>

          <div className="edit-profile-crop-controls">

            <label>
              Adjust position
            </label>

            <input
              type="range"
              min="0"
              max="100"
              value={cropPosition.x}
              onChange={handleCropChange}
            />

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
            >
              Apply Crop
            </button>

          </div>

        </div>

      </main>
    );
  }

  // =====================================================
  // EDIT PROFILE
  // =====================================================

  return (
    <main className="edit-profile-page">

      <div className="edit-profile-glow edit-profile-glow-one" />
      <div className="edit-profile-glow edit-profile-glow-two" />

      <div className="edit-profile-container">

        {/* HEADER */}

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
            <span>
              IMPRESSA
            </span>

            <h1>
              Edit Profile
            </h1>

            <p>
              Make your profile yours.
            </p>
          </div>

        </header>

        {/* PROFILE CARD */}

        <section className="edit-profile-card">

          {/* PROFILE PICTURE */}

          <div className="edit-profile-picture-section">

            <button
              type="button"
              className="edit-profile-picture-button"
              onClick={() =>
                document
                  .getElementById(
                    "profile-picture-input"
                  )
                  .click()
              }
            >

              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt="Profile"
                />
              ) : (
                <div className="edit-profile-picture-placeholder">
                  <span>+</span>
                </div>
              )}

              <div className="edit-profile-picture-edit">
                ✎
              </div>

            </button>

            <input
              id="profile-picture-input"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              hidden
            />

            <p>
              Tap to change profile picture
            </p>

          </div>

          {/* FORM */}

          <form
            className="edit-profile-form"
            onSubmit={handleSave}
          >

            {/* NAME */}

            <div className="edit-profile-field">

              <label htmlFor="edit-name">
                Name
              </label>

              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Your name"
                maxLength={50}
              />

            </div>

            {/* USERNAME */}

            <div className="edit-profile-field">

              <label htmlFor="edit-username">
                Username
              </label>

              <div className="edit-profile-username-input">

                <span>@</span>

                <input
                  id="edit-username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                        .replace(/\s/g, "")
                    )
                  }
                  placeholder="username"
                  maxLength={30}
                />

              </div>

            </div>

            {/* BIO */}

            <div className="edit-profile-field">

              <div className="edit-profile-bio-header">

                <label htmlFor="edit-bio">
                  Bio
                </label>

                <span>
                  {bio.length}/150
                </span>

              </div>

              <textarea
                id="edit-bio"
                value={bio}
                onChange={(event) =>
                  setBio(event.target.value)
                }
                placeholder="Tell people something about you..."
                maxLength={150}
                rows={4}
              />

            </div>

            {/* SAVE */}

            <button
              type="submit"
              className="edit-profile-save"
              disabled={
                saving ||
                !name.trim() ||
                !username.trim()
              }
            >

              {saving ? (
                <span className="edit-profile-loader">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <>
                  <span>
                    Save Changes
                  </span>

                  <span>
                    →
                  </span>
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