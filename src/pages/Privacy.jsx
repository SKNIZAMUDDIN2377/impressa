import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Privacy.css";

function Privacy() {
  const navigate = useNavigate();

  // ==========================================
  // PRIVACY SETTINGS
  // ==========================================

  const [comments, setComments] = useState(true);
  const [followers, setFollowers] = useState(true);
  const [activity, setActivity] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showComingSoon, setShowComingSoon] =
    useState(false);

  // ==========================================
  // API
  // ==========================================

  const API_URL = `http://${window.location.hostname}:5000`;

  // ==========================================
  // LOAD SAVED PRIVACY SETTINGS
  // ==========================================

  useEffect(() => {
    const loadPrivacySettings = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/signin");
          return;
        }

        const response = await fetch(
          `${API_URL}/api/auth/settings`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load privacy settings"
          );
        }

        if (data.user?.privacy) {
          setComments(
            data.user.privacy.commentsAllowed ?? true
          );

          setFollowers(
            data.user.privacy.followersVisible ?? true
          );

          setActivity(
            data.user.privacy.activityVisible ?? true
          );
        }
      } catch (error) {
        console.error(
          "Privacy settings loading error ❌",
          error
        );

        if (
          error.message.includes("Authentication") ||
          error.message.includes("expired")
        ) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");

          navigate("/signin");
        }
      } finally {
        setLoading(false);
      }
    };

    loadPrivacySettings();
  }, [navigate]);

  // ==========================================
  // SAVE PRIVACY SETTINGS
  // ==========================================

  const savePrivacySettings = async (
    updatedSettings
  ) => {
    try {
      setSaving(true);

      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/signin");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/auth/settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            privacy: updatedSettings,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to save privacy settings"
        );
      }

      // Keep local state synchronized with backend
      if (data.privacy) {
        setComments(
          data.privacy.commentsAllowed ?? true
        );

        setFollowers(
          data.privacy.followersVisible ?? true
        );

        setActivity(
          data.privacy.activityVisible ?? true
        );
      }
    } catch (error) {
      console.error(
        "Privacy settings save error ❌",
        error
      );

      alert(
        error.message ||
          "Unable to save privacy settings."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // COMMENTS TOGGLE
  // ==========================================

  const handleCommentsChange = () => {
    const newValue = !comments;

    setComments(newValue);

    savePrivacySettings({
      commentsAllowed: newValue,
      followersVisible: followers,
      activityVisible: activity,
    });
  };

  // ==========================================
  // FOLLOWERS TOGGLE
  // ==========================================

  const handleFollowersChange = () => {
    const newValue = !followers;

    setFollowers(newValue);

    savePrivacySettings({
      commentsAllowed: comments,
      followersVisible: newValue,
      activityVisible: activity,
    });
  };

  // ==========================================
  // ACTIVITY TOGGLE
  // ==========================================

  const handleActivityChange = () => {
    const newValue = !activity;

    setActivity(newValue);

    savePrivacySettings({
      commentsAllowed: comments,
      followersVisible: followers,
      activityVisible: newValue,
    });
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <main className="privacy-page">

      <div className="privacy-container">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="privacy-header">

          <button
            className="privacy-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>

          <div className="privacy-heading">

            <span>IMPRESSA</span>

            <h1>Privacy</h1>

          </div>

          <div className="privacy-header-space" />

        </header>


        {/* =================================================
            INTRO
        ================================================= */}

        <section className="privacy-intro">

          <div className="privacy-shield">
            🔐
          </div>

          <div>

            <h2>
              Your space. Your control.
            </h2>

            <p>
              Manage how people interact with
              your Impressa account.
            </p>

          </div>

        </section>


        {/* =================================================
            ACCOUNT VISIBILITY
        ================================================= */}

        <section className="privacy-card">

          <div className="privacy-card-title">

            <div className="privacy-title-icon">
              👁
            </div>

            <div>

              <h2>
                Account visibility
              </h2>

              <p>
                Control how your profile appears
                on Impressa.
              </p>

            </div>

          </div>


          {/* PUBLIC ACCOUNT */}

          <div className="privacy-setting">

            <div className="privacy-setting-text">

              <div className="privacy-setting-heading">

                <strong>
                  Public account
                </strong>

                <span className="v1-badge">
                  V1
                </span>

              </div>

              <span>
                All Impressa accounts are public
                in V1.
              </span>

            </div>


            <button
              type="button"
              className="privacy-toggle active"
              onClick={() =>
                setShowComingSoon(true)
              }
              aria-label="Public account"
            >
              <span />
            </button>

          </div>

        </section>


        {/* =================================================
            INTERACTIONS
        ================================================= */}

        <section className="privacy-card">

          <div className="privacy-card-title">

            <div className="privacy-title-icon">
              💬
            </div>

            <div>

              <h2>
                Interactions
              </h2>

              <p>
                Manage how people interact with
                your content.
              </p>

            </div>

          </div>


          {/* COMMENTS */}

          <SettingToggle
            title="Allow comments"
            description="People can comment on your posts."
            value={comments}
            onChange={handleCommentsChange}
            disabled={loading || saving}
          />


          {/* FOLLOWERS */}

          <SettingToggle
            title="Follower visibility"
            description="Allow people to see your follower list."
            value={followers}
            onChange={handleFollowersChange}
            disabled={loading || saving}
          />

        </section>


        {/* =================================================
            ACTIVITY
        ================================================= */}

        <section className="privacy-card">

          <div className="privacy-card-title">

            <div className="privacy-title-icon">
              ⚡
            </div>

            <div>

              <h2>
                Activity
              </h2>

              <p>
                Control how your activity appears.
              </p>

            </div>

          </div>


          <SettingToggle
            title="Show activity"
            description="Allow your activity to appear in Impressa discovery."
            value={activity}
            onChange={handleActivityChange}
            disabled={loading || saving}
          />

        </section>


        {/* =================================================
            V1 INFORMATION
        ================================================= */}

        <section className="privacy-v1-card">

          <div className="privacy-v1-icon">
            ✦
          </div>

          <div>

            <strong>
              Impressa V1
            </strong>

            <p>
              Every Impressa account is public
              in Version 1. Private accounts are
              planned for a future version.
            </p>

          </div>

        </section>


        {/* =================================================
            COMING SOON POPUP
        ================================================= */}

        {showComingSoon && (

          <div
            className="privacy-popup-overlay"
            onClick={() =>
              setShowComingSoon(false)
            }
          >

            <div
              className="privacy-coming-soon"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <div className="coming-soon-star">
                ✦
              </div>


              <div className="coming-soon-content">

                <span className="coming-soon-label">
                  IMPRESSA V2
                </span>

                <h2>
                  Private accounts are coming.
                </h2>

                <p>
                  Impressa V1 keeps every account
                  public. Private account controls
                  are planned for a future version.
                </p>


                <button
                  onClick={() =>
                    setShowComingSoon(false)
                  }
                >
                  Got it
                </button>

              </div>

            </div>

          </div>

        )}


        {/* =================================================
            FOOTER
        ================================================= */}

        <p className="privacy-footer">
          Impressa · Rise through impressions
        </p>

      </div>

    </main>
  );
}


/* =========================================================
   REUSABLE TOGGLE
========================================================= */

function SettingToggle({
  title,
  description,
  value,
  onChange,
  disabled,
}) {
  return (
    <div className="privacy-setting">

      <div className="privacy-setting-text">

        <strong>
          {title}
        </strong>

        <span>
          {description}
        </span>

      </div>


      <button
        type="button"
        className={`privacy-toggle ${
          value ? "active" : ""
        }`}
        onClick={onChange}
        disabled={disabled}
        aria-label={title}
      >

        <span />

      </button>

    </div>
  );
}


export default Privacy;