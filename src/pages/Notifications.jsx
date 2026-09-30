import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Notifications.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const DEFAULT_SETTINGS = {
  impressions: true,
  comments: true,
  followers: true,
  notes: true,
  spark: true,
};

const getFeedCacheKey = () =>
  `impressa_notifications_feed_${localStorage.getItem("token") || "guest"}`;

const readFeedCache = () => {
  try {
    return JSON.parse(localStorage.getItem(getFeedCacheKey()) || "null");
  } catch (error) {
    return null;
  }
};

const writeFeedCache = (notifications, unreadCount) => {
  try {
    localStorage.setItem(
      getFeedCacheKey(),
      JSON.stringify({ notifications, unreadCount })
    );
  } catch (error) {
    console.error("Notifications cache write error:", error);
  }
};

function Notifications() {
  const navigate = useNavigate();

  const [cachedFeed] = useState(readFeedCache);

  // ==========================================
  // NOTIFICATION SETTINGS
  // ==========================================

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ==========================================
  // REAL NOTIFICATIONS
  // ==========================================

  const [notifications, setNotifications] = useState(
    cachedFeed?.notifications || []
  );
  const [unreadCount, setUnreadCount] = useState(
    cachedFeed?.unreadCount || 0
  );
  const [notificationsLoading, setNotificationsLoading] = useState(
    !cachedFeed
  );

  const pendingReadRef = useRef(new Set());

  // ==========================================
  // LOAD FEED + SETTINGS (in parallel, one auth check)
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/signin");
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      const expireSession = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/signin");
      };

      const loadFeed = async () => {
        try {
          const response = await fetch(`${API_URL}/api/notifications`, {
            method: "GET",
            headers,
          });

          const data = await response.json();

          if (cancelled) return;

          if (response.status === 401) {
            expireSession();
            return;
          }

          if (!response.ok) {
            throw new Error(data.message || "Unable to load notifications");
          }

          const list = data.notifications || [];
          const unread = data.unreadCount || 0;

          setNotifications(list);
          setUnreadCount(unread);
          writeFeedCache(list, unread);
        } catch (error) {
          console.error("Notifications loading error ❌", error);
        } finally {
          if (!cancelled) setNotificationsLoading(false);
        }
      };

      const loadSettings = async () => {
        try {
          const response = await fetch(`${API_URL}/api/auth/settings`, {
            method: "GET",
            headers,
          });

          const data = await response.json();

          if (cancelled) return;

          if (response.status === 401) {
            expireSession();
            return;
          }

          if (!response.ok) {
            throw new Error(
              data.message || "Unable to load notification settings"
            );
          }

          if (data.user?.notifications) {
            const saved = data.user.notifications;

            setSettings({
              impressions: saved.impressions ?? true,
              comments: saved.comments ?? true,
              followers: saved.followers ?? true,
              notes: saved.notes ?? true,
              spark: saved.spark ?? true,
            });
          }
        } catch (error) {
          console.error("Notification settings loading error ❌", error);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      await Promise.all([loadFeed(), loadSettings()]);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // ==========================================
  // MARK ONE NOTIFICATION AS READ
  // ==========================================

  const markNotificationRead = async (notificationId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/signin");
      return;
    }

    const notification = notifications.find(
      (item) => item._id === notificationId
    );

    if (
      !notification ||
      notification.read ||
      pendingReadRef.current.has(notificationId)
    ) {
      return;
    }

    pendingReadRef.current.add(notificationId);

    const previousNotifications = notifications;
    const previousUnread = unreadCount;

    const updated = notifications.map((item) =>
      item._id === notificationId ? { ...item, read: true } : item
    );
    const updatedUnread = Math.max(0, unreadCount - 1);

    setNotifications(updated);
    setUnreadCount(updatedUnread);
    writeFeedCache(updated, updatedUnread);

    try {
      const response = await fetch(
        `${API_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to mark notification as read");
      }

      window.dispatchEvent(new Event("impressa-notifications-refresh"));
    } catch (error) {
      console.error("Mark notification read error ❌", error);

      setNotifications(previousNotifications);
      setUnreadCount(previousUnread);
      writeFeedCache(previousNotifications, previousUnread);
    } finally {
      pendingReadRef.current.delete(notificationId);
    }
  };

  // ==========================================
  // MARK ALL AS READ
  // ==========================================

  const markAllNotificationsRead = async () => {
    if (unreadCount === 0) return;

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/signin");
      return;
    }

    const previousNotifications = notifications;
    const previousUnread = unreadCount;

    const updated = notifications.map((item) => ({
      ...item,
      read: true,
    }));

    setNotifications(updated);
    setUnreadCount(0);
    writeFeedCache(updated, 0);

    try {
      const response = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to mark notifications as read");
      }

      window.dispatchEvent(new Event("impressa-notifications-refresh"));
    } catch (error) {
      console.error("Mark all notifications error ❌", error);

      setNotifications(previousNotifications);
      setUnreadCount(previousUnread);
      writeFeedCache(previousNotifications, previousUnread);
    }
  };

  // ==========================================
  // NOTIFICATION ICON
  // ==========================================

  const getNotificationIcon = (type) => {
    switch (type) {
      case "impression":
        return "✨";
      case "comment":
        return "💬";
      case "follow":
        return "👤";
      case "follow_accepted":
        return "🤝";
      case "pulse":
        return "⚡";
      case "system":
        return "🔔";
      default:
        return "🔔";
    }
  };

  // ==========================================
  // NOTIFICATION TIME
  // ==========================================

  const getNotificationTime = (createdAt) => {
    if (!createdAt) return "";

    const created = new Date(createdAt);
    const now = new Date();

    const difference = Math.floor((now - created) / 1000);

    if (difference < 60) return "Just now";

    const minutes = Math.floor(difference / 60);

    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);

    if (days < 7) return `${days}d ago`;

    return created.toLocaleDateString();
  };

  // ==========================================
  // OPEN NOTIFICATION
  // ==========================================

  const openNotification = (notification) => {
    // Fire and forget — navigation should not wait on the network.
    markNotificationRead(notification._id);

    if (
      notification.type === "follow" ||
      notification.type === "follow_accepted"
    ) {
      if (notification.sender?.username) {
        navigate(
          `/profile/${encodeURIComponent(notification.sender.username)}`
        );
      }

      return;
    }

    // Post notifications (impressions / comments) are about MY post,
    // so open that post on my own profile.
    const postId =
      typeof notification.post === "object"
        ? notification.post?._id
        : notification.post;

    if (postId) {
      let myUsername = "";

      try {
        myUsername =
          JSON.parse(localStorage.getItem("user") || "null")?.username || "";
      } catch (error) {
        myUsername = "";
      }

      if (myUsername) {
        navigate(
          `/profile/${encodeURIComponent(myUsername)}/posts?post=${postId}`
        );
        return;
      }
    }

    if (notification.sender?.username) {
      navigate(
        `/profile/${encodeURIComponent(notification.sender.username)}`
      );
    }
  };

  // ==========================================
  // SAVE SETTINGS (single toggle, rollback on failure)
  // ==========================================

  const toggleSetting = async (key) => {
    if (saving || loading) return;

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/signin");
      return;
    }

    const previous = settings;
    const updated = { ...settings, [key]: !settings[key] };

    setSettings(updated);
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notifications: updated,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to save notification settings"
        );
      }

      if (data.notifications) {
        setSettings((current) => ({
          ...current,
          impressions: data.notifications.impressions ?? current.impressions,
          comments: data.notifications.comments ?? current.comments,
          followers: data.notifications.followers ?? current.followers,
          notes: data.notifications.notes ?? current.notes,
          spark: data.notifications.spark ?? current.spark,
        }));
      }
    } catch (error) {
      console.error("Notification settings save error ❌", error);

      setSettings(previous);

      alert(error.message || "Unable to save notification settings.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <main className="notifications-page">
      <div className="notifications-container">
        <header className="notifications-header">
          <button
            className="notifications-back"
            onClick={() => navigate(-1)}
          >
            ←
          </button>

          <div className="notifications-heading">
            <span>IMPRESSA</span>
            <h1>Notifications</h1>
          </div>

          <div />
        </header>

        <section className="notifications-card">
          <div className="notifications-card-header">
            <div className="notifications-card-icon">🔔</div>

            <div>
              <h2>Activity</h2>

              <p>See what's happening around your Impressa account.</p>
            </div>
          </div>

          {unreadCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "10px 0 14px",
              }}
            >
              <strong>{unreadCount} unread</strong>

              <button
                type="button"
                onClick={markAllNotificationsRead}
                style={{
                  border: "none",
                  background: "none",
                  color: "#ff6a00",
                  fontWeight: "600",
                  cursor: "pointer",
                  padding: "6px 0",
                }}
              >
                Mark all as read
              </button>
            </div>
          )}

          {notificationsLoading && (
            <div
              style={{
                padding: "24px 0",
                textAlign: "center",
              }}
            >
              Loading notifications...
            </div>
          )}

          {!notificationsLoading && notifications.length === 0 && (
            <div
              style={{
                padding: "30px 10px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "34px",
                  marginBottom: "10px",
                }}
              >
                🔔
              </div>

              <strong>No notifications yet</strong>

              <p>
                When people interact with your Impressa account, you'll see it
                here.
              </p>
            </div>
          )}

          {notifications.length > 0 && (
            <div>
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification._id}
                  onClick={() => openNotification(notification)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "left",
                    border: "none",
                    borderTop: "1px solid rgba(0,0,0,0.08)",
                    background: notification.read
                      ? "transparent"
                      : "rgba(255,106,0,0.07)",
                    padding: "14px 4px",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      minWidth: "42px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(255,106,0,0.10)",
                      fontSize: "20px",
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong>
                        {notification.sender?.name ||
                          notification.sender?.username ||
                          "Someone"}
                      </strong>

                      {notification.sender?.isOfficial === true && (
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#ff6a00",
                            display: "inline-block",
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        marginTop: "3px",
                      }}
                    >
                      {notification.message}
                    </div>

                    <span
                      style={{
                        display: "block",
                        fontSize: "12px",
                        marginTop: "5px",
                        opacity: 0.55,
                      }}
                    >
                      {getNotificationTime(notification.createdAt)}
                    </span>
                  </div>

                  {!notification.read && (
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        minWidth: "8px",
                        borderRadius: "50%",
                        background: "#ff6a00",
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="notifications-hero">
          <div className="notifications-hero-icon">🔔</div>

          <div>
            <h2>Stay in the moment.</h2>

            <p>Choose what Impressa should notify you about.</p>
          </div>
        </section>

        <section className="notifications-card">
          <div className="notifications-card-header">
            <div className="notifications-card-icon">✨</div>

            <div>
              <h2>Social activity</h2>

              <p>Know when people interact with your content.</p>
            </div>
          </div>

          <NotificationRow
            title="Impressions"
            description="When someone gives your post an impression."
            enabled={settings.impressions}
            setEnabled={() => toggleSetting("impressions")}
            disabled={loading || saving}
          />

          <NotificationRow
            title="Comments"
            description="When someone comments on your post."
            enabled={settings.comments}
            setEnabled={() => toggleSetting("comments")}
            disabled={loading || saving}
          />

          <NotificationRow
            title="New followers"
            description="When someone follows your account."
            enabled={settings.followers}
            setEnabled={() => toggleSetting("followers")}
            disabled={loading || saving}
          />
        </section>

        <section className="notifications-card">
          <div className="notifications-card-header">
            <div className="notifications-card-icon">⚡</div>

            <div>
              <h2>Impressa</h2>

              <p>Important updates from Impressa.</p>
            </div>
          </div>

          <NotificationRow
            title="i-Notes"
            description="Updates related to your public i-Notes."
            enabled={settings.notes}
            setEnabled={() => toggleSetting("notes")}
            disabled={loading || saving}
          />

          <NotificationRow
            title="Spark challenges"
            description="Daily challenge and Spark updates."
            enabled={settings.spark}
            setEnabled={() => toggleSetting("spark")}
            disabled={loading || saving}
          />
        </section>

        <section className="notifications-info">
          <div className="notifications-info-icon">🔔</div>

          <div>
            <strong>Notification preferences</strong>

            <p>
              Your notification choices are saved to your Impressa account.
            </p>
          </div>
        </section>

        <p className="notifications-footer">
          Impressa · Rise through impressions
        </p>
      </div>
    </main>
  );
}

// =====================================================
// NOTIFICATION ROW
// =====================================================

function NotificationRow({
  title,
  description,
  enabled,
  setEnabled,
  disabled,
}) {
  return (
    <div className="notification-row">
      <div className="notification-row-content">
        <strong>{title}</strong>

        <span>{description}</span>
      </div>

      <button
        type="button"
        className={`notification-switch ${enabled ? "is-on" : ""}`}
        onClick={setEnabled}
        disabled={disabled}
        aria-label={`Toggle ${title} notifications`}
      >
        <span />
      </button>
    </div>
  );
}

export default Notifications;