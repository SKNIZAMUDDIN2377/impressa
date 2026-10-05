import React, { useEffect, useMemo, useState } from "react";
import "./Impressions.css";

// ==========================================
// ROUTE — change this if your profile route differs
// (e.g. "/user/" or "/u/")
// ==========================================
const profilePath = (username) => `/profile/${encodeURIComponent(username)}`;

const MILESTONE = 100; // impressions needed for the next milestone

// ==========================================
// CACHE
// ==========================================
const cacheKey = () => {
  const token = localStorage.getItem("token");
  return token ? `impressa_notifications_${token}` : "impressa_notifications";
};

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(cacheKey()) || "null");
  } catch (error) {
    console.error("Notifications cache read error:", error);
    return null;
  }
};

const writeCache = (payload) => {
  try {
    localStorage.setItem(cacheKey(), JSON.stringify(payload));
  } catch (error) {
    console.error("Notifications cache write error:", error);
  }
};

// ==========================================
// HELPERS
// ==========================================
const ICONS = {
  impression: "i",
  comment: "○",
  follow: "+",
  follow_request: "+",
  follow_accepted: "✓",
  follow_accepted_self: "✓",
  post_reach: "↗",
  badge: "◆",
  milestone: "✦",
  pulse: "≈",
  mention: "@",
  note: "—",
  spark: "✧",
  system: "•",
};

const getIcon = (type) => ICONS[type] || "•";

const FOLLOW_TYPES = ["follow", "follow_request", "follow_accepted", "follow_accepted_self"];
const UPDATE_TYPES = ["post_reach", "badge", "milestone", "spark", "system", "pulse"];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "follows", label: "Follows" },
  { id: "impressions", label: "Impressions" },
  { id: "comments", label: "Comments" },
  { id: "updates", label: "Updates" },
];

const EMPTY_TEXT = {
  all: "When someone follows you or reacts to your posts, it shows up here.",
  follows: "New followers and follow requests will show up here.",
  impressions: "Impressions on your posts will show up here.",
  comments: "Comments and mentions will show up here.",
  updates: "Badges, milestones and Pulse updates will show up here.",
};

const getTime = (createdAt) => {
  if (!createdAt) return "";
  const created = new Date(createdAt);
  const seconds = Math.floor((Date.now() - created) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return created.toLocaleDateString();
};

const isSameDay = (a, b) =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

const formatNotification = (n) => {
  const sender = n.sender || null;
  const post = n.post || null;

  return {
    id: n._id,
    type: n.type,
    username: sender?.username || "",
    senderName: sender?.name || "",
    message: n.message || "",
    detail: n.type === "impression" ? post?.caption || "" : "",
    time: getTime(n.createdAt),
    createdAt: n.createdAt,
    image: sender?.profilePicture || "",
    postImage: post?.media?.[0]?.url || "",
    read: n.read === true,
    senderId: sender?._id || null,
    postId: post?._id || null,
  };
};

const matchesFilter = (n, filter) => {
  if (filter === "follows") return FOLLOW_TYPES.includes(n.type);
  if (filter === "impressions") return n.type === "impression";
  if (filter === "comments") return n.type === "comment" || n.type === "mention";
  if (filter === "updates") return UPDATE_TYPES.includes(n.type);
  return true;
};

// ==========================================
// PAGE
// ==========================================
function Impression() {
  const cached = readCache();

  const [notifications, setNotifications] = useState(cached?.notifications || []);
  const [profile, setProfile] = useState(cached?.profile || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // ------------------------------------------
  // LOAD
  // ------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          window.location.href = "/signin";
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        const profileRes = await fetch(`${API_URL}/api/profile/me`, { headers });
        const profileData = await profileRes.json();

        if (!profileRes.ok) {
          throw new Error(profileData.message || "Unable to load profile");
        }

        const nextProfile = profileData.user || profileData.profile || profileData;
        setProfile(nextProfile);

        const notifRes = await fetch(`${API_URL}/api/notifications`, { headers });
        const notifData = await notifRes.json();

        if (!notifRes.ok) {
          throw new Error(notifData.message || "Unable to load notifications");
        }

        const formatted = (notifData.notifications || []).map(formatNotification);
        setNotifications(formatted);
        setError("");
        writeCache({ notifications: formatted, profile: nextProfile });
      } catch (err) {
        console.error("Impressions page loading error ❌", err);
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [API_URL]);

  // ------------------------------------------
  // DERIVED
  // ------------------------------------------
  const unreadCount = notifications.filter((n) => !n.read).length;

  const totalImpressions = Number(profile?.impressionsReceived || 0);

  const todayImpressions = useMemo(() => {
    const today = new Date();
    return notifications.filter(
      (n) =>
        n.type === "impression" &&
        n.createdAt &&
        isSameDay(new Date(n.createdAt), today)
    ).length;
  }, [notifications]);

  const remaining = Math.max(0, MILESTONE - totalImpressions);
  const progress = Math.min(100, Math.round((totalImpressions / MILESTONE) * 100));

  const groups = useMemo(() => {
    const today = new Date();
    const visible = notifications.filter((n) => matchesFilter(n, activeFilter));

    const isToday = (n) => n.createdAt && isSameDay(new Date(n.createdAt), today);

    return [
      { title: "Today", items: visible.filter(isToday) },
      { title: "Earlier", items: visible.filter((n) => !isToday(n)) },
    ].filter((g) => g.items.length > 0);
  }, [notifications, activeFilter]);

  // ------------------------------------------
  // ACTIONS
  // ------------------------------------------
  const refreshNavbar = () =>
    window.dispatchEvent(new Event("impressa-notifications-refresh"));

  const markRead = async (id) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;

    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    writeCache({ notifications: updated, profile });

    try {
      const res = await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to mark notification as read");
      refreshNavbar();
    } catch (err) {
      console.error("Mark read error ❌", err);
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    writeCache({ notifications: updated, profile });

    try {
      const res = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to mark notifications as read");
      refreshNavbar();
    } catch (err) {
      console.error("Mark all read error ❌", err);
    }
  };

  // Open the sender's profile (and mark the notification read first)
  const openNotification = (n) => {
    markRead(n.id);

    if (n.username) {
      window.location.href = profilePath(n.username);
    }
  };

  const onKey = (event, n) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openNotification(n);
    }
  };

  // ------------------------------------------
  // LOADING
  // ------------------------------------------
  if (loading) {
    return (
      <main className="imp-page">
        <header className="imp-header">
          <h1>Activity</h1>
        </header>
        <div className="imp-skeleton imp-skeleton-stats" />
        {[0, 1, 2, 3].map((k) => (
          <div key={k} className="imp-skeleton imp-skeleton-row" />
        ))}
      </main>
    );
  }

  // ------------------------------------------
  // PAGE
  // ------------------------------------------
  return (
    <main className="imp-page">
      <header className="imp-header">
        <div>
          <h1>i-signals</h1>
          <p>See who followed you and who gave your posts an impression.</p>
        </div>

        {unreadCount > 0 && (
          <button type="button" className="imp-read-all" onClick={markAllRead}>
            Mark all as read
          </button>
        )}
      </header>

      {error && notifications.length === 0 && (
        <div className="imp-error" role="alert">
          <strong>Couldn't load your activity.</strong>
          <span>{error}. Check your connection and refresh the page.</span>
        </div>
      )}

      {/* ---------- SUMMARY ---------- */}
      <section className="imp-summary" aria-label="Your impressions">
        <div className="imp-stats">
          <div>
            <strong>{totalImpressions}</strong>
            <span>Total impressions</span>
          </div>
          <div>
            <strong>{todayImpressions}</strong>
            <span>New today</span>
          </div>
        </div>

        <div className="imp-progress">
          <div className="imp-progress-text">
            <span>
              {remaining === 0
                ? "Milestone reached 🎉"
                : `${remaining} more to reach ${MILESTONE} impressions`}
            </span>
            {profile?.badge && <em>{profile.badge}</em>}
          </div>
          <div
            className="imp-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <p className="imp-hint">
          An impression is Impressa's version of a like. The more you get, the
          higher your badge.
        </p>
      </section>

      {/* ---------- FILTERS ---------- */}
      <nav className="imp-filters" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={activeFilter === f.id ? "active" : ""}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {/* ---------- FEED ---------- */}
      {groups.length === 0 ? (
        <section className="imp-empty">
          <div className="imp-empty-mark">🔔</div>
          <h2>No activity yet</h2>
          <p>{EMPTY_TEXT[activeFilter]}</p>

          {activeFilter === "all" && (
            <ol className="imp-steps">
              <li>
                <strong>Create a post</strong>
                <span>Share a photo or video so people can find you.</span>
              </li>
              <li>
                <strong>Follow people</strong>
                <span>Search for friends and follow them. Many follow back.</span>
              </li>
              <li>
                <strong>Try today's Pulse</strong>
                <span>Join the 24-hour challenge to get noticed.</span>
              </li>
            </ol>
          )}
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.title} className="imp-group">
            <h2>{group.title}</h2>

            <ul className="imp-list">
              {group.items.map((n) => (
                <li key={n.id}>
                  <div
                    className={`imp-card ${n.read ? "read" : "unread"} ${
                      n.username ? "clickable" : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNotification(n)}
                    onKeyDown={(e) => onKey(e, n)}
                    aria-label={
                      n.username
                        ? `Open @${n.username}'s profile. ${n.message}`
                        : n.message
                    }
                  >
                    <div className="imp-avatar-wrap">
                      {n.image ? (
                        <img className="imp-avatar" src={n.image} alt="" />
                      ) : (
                        <div className="imp-avatar imp-avatar-fallback">
                          {n.username ? n.username.charAt(0).toUpperCase() : getIcon(n.type)}
                        </div>
                      )}
                      <span className={`imp-badge ${n.type}`}>{getIcon(n.type)}</span>
                    </div>

                    <div className="imp-body">
                      <p>
                        {n.username && <strong>@{n.username} </strong>}
                        {n.message}
                      </p>
                      {n.detail && <span className="imp-detail">{n.detail}</span>}
                      <span className="imp-time">{n.time}</span>
                    </div>

                    {n.postImage && (
                      <img className="imp-thumb" src={n.postImage} alt="" />
                    )}

                    {!n.read && <span className="imp-dot" aria-label="Unread" />}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}

export default Impression;