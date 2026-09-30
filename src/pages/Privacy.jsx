import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Privacy.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const DEFAULT_PRIVACY = {
  commentsAllowed: true,
  followersVisible: true,
  activityVisible: true,
};

const getCacheKey = () =>
  `impressa_privacy_${localStorage.getItem("token") || "guest"}`;

const readCachedPrivacy = () => {
  try {
    return JSON.parse(localStorage.getItem(getCacheKey()) || "null");
  } catch (error) {
    return null;
  }
};

const normalizePrivacy = (value) => ({
  commentsAllowed: value?.commentsAllowed ?? true,
  followersVisible: value?.followersVisible ?? true,
  activityVisible: value?.activityVisible ?? true,
});

function Privacy() {
  const navigate = useNavigate();

  const [cachedPrivacy] = useState(readCachedPrivacy);

  const [privacy, setPrivacy] = useState(
    cachedPrivacy ? normalizePrivacy(cachedPrivacy) : DEFAULT_PRIVACY
  );

  const [loading, setLoading] = useState(!cachedPrivacy);
  const [saving, setSaving] = useState(false);

  const [showComingSoon, setShowComingSoon] = useState(false);

  // ==========================================
  // LOAD SAVED PRIVACY SETTINGS
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    const loadPrivacySettings = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/signin");
          return;
        }

        const response = await fetch(`${API_URL}/api/auth/settings`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (cancelled) return;

        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/signin");
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || "Unable to load privacy settings");
        }

        if (data.user?.privacy) {
          const next = normalizePrivacy(data.user.privacy);

          setPrivacy(next);
          localStorage.setItem(getCacheKey(), JSON.stringify(next));
        }
      } catch (error) {
        if (cancelled) return;

        console.error("Privacy settings loading error ❌", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPrivacySettings();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // ==========================================
  // TOGGLE + SAVE (rollback if the save fails)
  // ==========================================

  const toggleSetting = async (key) => {
    if (saving || loading) return;

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/signin");
      return;
    }

    const previous = privacy;
    const updated = { ...privacy, [key]: !privacy[key] };

    setPrivacy(updated);
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          privacy: updated,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save privacy settings");
      }

      const confirmed = data.privacy ? normalizePrivacy(data.privacy) : updated;

      setPrivacy(confirmed);
      localStorage.setItem(getCacheKey(), JSON.stringify(confirmed));
    } catch (error) {
      console.error("Privacy settings save error ❌", error);

      setPrivacy(previous);

      alert(error.message || "Unable to save privacy settings.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <main className="privacy-page">
      <div className="privacy-container">
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

        <section className="privacy-intro">
          <div className="privacy-shield">🔐</div>

          <div>
            <h2>Your space. Your control.</h2>

            <p>Manage how people interact with your Impressa account.</p>
          </div>
        </section>

        <section className="privacy-card">
          <div className="privacy-card-title">
            <div className="privacy-title-icon">👁</div>

            <div>
              <h2>Account visibility</h2>

              <p>Control how your profile appears on Impressa.</p>
            </div>
          </div>

          <div className="privacy-setting">
            <div className="privacy-setting-text">
              <div className="privacy-setting-heading">
                <strong>Public account</strong>

                <span className="v1-badge">V1</span>
              </div>

              <span>All Impressa accounts are public in V1.</span>
            </div>

            <button
              type="button"
              className="privacy-toggle active"
              onClick={() => setShowComingSoon(true)}
              aria-label="Public account"
            >
              <span />
            </button>
          </div>
        </section>

        <section className="privacy-card">
          <div className="privacy-card-title">
            <div className="privacy-title-icon">💬</div>

            <div>
              <h2>Interactions</h2>

              <p>Manage how people interact with your content.</p>
            </div>
          </div>

          <SettingToggle
            title="Allow comments"
            description="People can comment on your posts."
            value={privacy.commentsAllowed}
            onChange={() => toggleSetting("commentsAllowed")}
            disabled={loading || saving}
          />

          <SettingToggle
            title="Follower visibility"
            description="Allow people to see your follower list."
            value={privacy.followersVisible}
            onChange={() => toggleSetting("followersVisible")}
            disabled={loading || saving}
          />
        </section>

        <section className="privacy-card">
          <div className="privacy-card-title">
            <div className="privacy-title-icon">⚡</div>

            <div>
              <h2>Activity</h2>

              <p>Control how your activity appears.</p>
            </div>
          </div>

          <SettingToggle
            title="Show activity"
            description="Allow your activity to appear in Impressa discovery."
            value={privacy.activityVisible}
            onChange={() => toggleSetting("activityVisible")}
            disabled={loading || saving}
          />
        </section>

        <section className="privacy-v1-card">
          <div className="privacy-v1-icon">✦</div>

          <div>
            <strong>Impressa V1</strong>

            <p>
              Every Impressa account is public in Version 1. Private accounts
              are planned for a future version.
            </p>
          </div>
        </section>

        {showComingSoon && (
          <div
            className="privacy-popup-overlay"
            onClick={() => setShowComingSoon(false)}
          >
            <div
              className="privacy-coming-soon"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="coming-soon-star">✦</div>

              <div className="coming-soon-content">
                <span className="coming-soon-label">IMPRESSA V2</span>

                <h2>Private accounts are coming.</h2>

                <p>
                  Impressa V1 keeps every account public. Private account
                  controls are planned for a future version.
                </p>

                <button onClick={() => setShowComingSoon(false)}>
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}

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
        <strong>{title}</strong>

        <span>{description}</span>
      </div>

      <button
        type="button"
        className={`privacy-toggle ${value ? "active" : ""}`}
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