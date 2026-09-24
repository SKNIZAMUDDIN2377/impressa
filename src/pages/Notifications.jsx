import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Notifications.css";

function Notifications() {
  const navigate = useNavigate();

  // ==========================================
  // NOTIFICATION SETTINGS
  // ==========================================

  const [impressions, setImpressions] = useState(true);
  const [comments, setComments] = useState(true);
  const [followers, setFollowers] = useState(true);
  const [notes, setNotes] = useState(true);
  const [spark, setSpark] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ==========================================
  // REAL NOTIFICATIONS
  // ==========================================

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] =
    useState(true);

  // ==========================================
  // API
  // ==========================================

  const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

  // ==========================================
  // LOAD NOTIFICATIONS
  // ==========================================

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/signin");
          return;
        }

        const response = await fetch(
          `${API_URL}/api/notifications`,
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
            data.message ||
              "Unable to load notifications"
          );
        }

        setNotifications(
          data.notifications || []
        );

        setUnreadCount(
          data.unreadCount || 0
        );

      } catch (error) {
        console.error(
          "Notifications loading error ❌",
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
        setNotificationsLoading(false);
      }
    };

    loadNotifications();
  }, [navigate]);

  // ==========================================
  // MARK ONE NOTIFICATION AS READ
  // ==========================================

  const markNotificationRead = async (
    notificationId
  ) => {
    try {
      const token =
        localStorage.getItem("token");

      if (!token) {
        navigate("/signin");
        return;
      }

      const notification =
        notifications.find(
          (item) =>
            item._id === notificationId
        );

      if (!notification || notification.read) {
        return;
      }

      // Update UI immediately
      setNotifications((previous) =>
        previous.map((item) =>
          item._id === notificationId
            ? { ...item, read: true }
            : item
        )
      );

      setUnreadCount((previous) =>
        Math.max(0, previous - 1)
      );

      const response = await fetch(
        `${API_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to mark notification as read"
        );
      }
    } catch (error) {
      console.error(
        "Mark notification read error ❌",
        error
      );
    }
  };

  // ==========================================
  // MARK ALL AS READ
  // ==========================================

  const markAllNotificationsRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    try {
      const token =
        localStorage.getItem("token");

      if (!token) {
        navigate("/signin");
        return;
      }

      // Update UI immediately
      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          read: true,
        }))
      );

      setUnreadCount(0);

      const response = await fetch(
        `${API_URL}/api/notifications/read-all`,
        {
          method: "PUT",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to mark notifications as read"
        );
      }
    } catch (error) {
      console.error(
        "Mark all notifications error ❌",
        error
      );
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
    if (!createdAt) {
      return "";
    }

    const created =
      new Date(createdAt);

    const now = new Date();

    const difference =
      Math.floor(
        (now - created) / 1000
      );

    if (difference < 60) {
      return "Just now";
    }

    const minutes =
      Math.floor(
        difference / 60
      );

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days =
      Math.floor(
        hours / 24
      );

    if (days < 7) {
      return `${days}d ago`;
    }

    return created.toLocaleDateString();
  };

  // ==========================================
  // OPEN NOTIFICATION
  // ==========================================

  const openNotification = async (
    notification
  ) => {
    await markNotificationRead(
      notification._id
    );

    // Follow notification → sender profile
    if (
      notification.type === "follow" ||
      notification.type ===
        "follow_accepted"
    ) {
      if (
        notification.sender?.username
      ) {
        navigate(
          `/profile/${encodeURIComponent(
            notification.sender.username
          )}`
        );
      }

      return;
    }

    // Post-related notification → post/profile
    if (
      notification.post &&
      notification.sender?.username
    ) {
      navigate(
        `/profile/${encodeURIComponent(
          notification.sender.username
        )}`
      );
    }
  };

  // ==========================================
  // LOAD SAVED SETTINGS
  // ==========================================

  useEffect(() => {
    const loadNotificationSettings =
      async () => {
        try {
          const token =
            localStorage.getItem("token");

          if (!token) {
            navigate("/signin");
            return;
          }

          const response =
            await fetch(
              `${API_URL}/api/auth/settings`,
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
            throw new Error(
              data.message ||
                "Unable to load notification settings"
            );
          }

          if (
            data.user?.notifications
          ) {
            setImpressions(
              data.user.notifications
                .impressions ?? true
            );

            setComments(
              data.user.notifications
                .comments ?? true
            );

            setFollowers(
              data.user.notifications
                .followers ?? true
            );

            setNotes(
              data.user.notifications
                .notes ?? true
            );

            setSpark(
              data.user.notifications
                .spark ?? true
            );
          }
        } catch (error) {
          console.error(
            "Notification settings loading error ❌",
            error
          );

          if (
            error.message.includes(
              "Authentication"
            ) ||
            error.message.includes(
              "expired"
            )
          ) {
            localStorage.removeItem(
              "token"
            );

            localStorage.removeItem(
              "user"
            );

            navigate("/signin");
          }
        } finally {
          setLoading(false);
        }
      };

    loadNotificationSettings();
  }, [navigate]);

  // ==========================================
  // SAVE SETTINGS
  // ==========================================

  const saveNotificationSettings = async (
    updatedSettings
  ) => {
    try {
      setSaving(true);

      const token =
        localStorage.getItem("token");

      if (!token) {
        navigate("/signin");
        return;
      }

      const response =
        await fetch(
          `${API_URL}/api/auth/settings`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              notifications:
                updatedSettings,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to save notification settings"
        );
      }

      if (data.notifications) {
        setImpressions(
          data.notifications
            .impressions ?? true
        );

        setComments(
          data.notifications
            .comments ?? true
        );

        setFollowers(
          data.notifications
            .followers ?? true
        );

        setNotes(
          data.notifications
            .notes ?? true
        );

        setSpark(
          data.notifications
            .spark ?? true
        );
      }
    } catch (error) {
      console.error(
        "Notification settings save error ❌",
        error
      );

      alert(
        error.message ||
          "Unable to save notification settings."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // TOGGLE HANDLERS
  // ==========================================

  const handleImpressionsChange = () => {
    const newValue =
      !impressions;

    setImpressions(newValue);

    saveNotificationSettings({
      impressions: newValue,
      comments,
      followers,
      notes,
      spark,
    });
  };

  const handleCommentsChange = () => {
    const newValue =
      !comments;

    setComments(newValue);

    saveNotificationSettings({
      impressions,
      comments: newValue,
      followers,
      notes,
      spark,
    });
  };

  const handleFollowersChange = () => {
    const newValue =
      !followers;

    setFollowers(newValue);

    saveNotificationSettings({
      impressions,
      comments,
      followers: newValue,
      notes,
      spark,
    });
  };

  const handleNotesChange = () => {
    const newValue =
      !notes;

    setNotes(newValue);

    saveNotificationSettings({
      impressions,
      comments,
      followers,
      notes: newValue,
      spark,
    });
  };

  const handleSparkChange = () => {
    const newValue =
      !spark;

    setSpark(newValue);

    saveNotificationSettings({
      impressions,
      comments,
      followers,
      notes,
      spark: newValue,
    });
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <main className="notifications-page">

      <div className="notifications-container">

        {/* =====================================
            HEADER
        ===================================== */}

        <header className="notifications-header">

          <button
            className="notifications-back"
            onClick={() => navigate(-1)}
          >
            ←
          </button>

          <div className="notifications-heading">

            <span>
              IMPRESSA
            </span>

            <h1>
              Notifications
            </h1>

          </div>

          <div />

        </header>


        {/* =====================================
            NOTIFICATION FEED
        ===================================== */}

        <section className="notifications-card">

          <div className="notifications-card-header">

            <div className="notifications-card-icon">
              🔔
            </div>

            <div>
              <h2>
                Activity
              </h2>

              <p>
                See what's happening around
                your Impressa account.
              </p>
            </div>

          </div>


          {/* UNREAD COUNT + MARK ALL */}

          {unreadCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                gap: "12px",
                padding:
                  "10px 0 14px",
              }}
            >
              <strong>
                {unreadCount} unread
              </strong>

              <button
                type="button"
                onClick={
                  markAllNotificationsRead
                }
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


          {/* LOADING */}

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


          {/* EMPTY */}

          {!notificationsLoading &&
            notifications.length === 0 && (
              <div
                style={{
                  padding:
                    "30px 10px",
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

                <strong>
                  No notifications yet
                </strong>

                <p>
                  When people interact with
                  your Impressa account,
                  you'll see it here.
                </p>
              </div>
            )}


          {/* NOTIFICATION LIST */}

          {!notificationsLoading &&
            notifications.length > 0 && (
              <div>
                {notifications.map(
                  (notification) => (
                    <button
                      type="button"
                      key={notification._id}
                      onClick={() =>
                        openNotification(
                          notification
                        )
                      }
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems:
                          "center",
                        gap: "12px",
                        textAlign: "left",
                        border: "none",
                        borderTop:
                          "1px solid rgba(0,0,0,0.08)",
                        background:
                          notification.read
                            ? "transparent"
                            : "rgba(255,106,0,0.07)",
                        padding:
                          "14px 4px",
                        cursor: "pointer",
                      }}
                    >

                      {/* ICON */}

                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          minWidth: "42px",
                          borderRadius:
                            "50%",
                          display: "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          background:
                            "rgba(255,106,0,0.10)",
                          fontSize: "20px",
                        }}
                      >
                        {getNotificationIcon(
                          notification.type
                        )}
                      </div>


                      {/* SENDER */}

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >

                        <div
                          style={{
                            display: "flex",
                            alignItems:
                              "center",
                            gap: "6px",
                            flexWrap:
                              "wrap",
                          }}
                        >

                          <strong>
                            {notification
                              .sender?.name ||
                              notification
                                .sender
                                ?.username ||
                              "Someone"}
                          </strong>

                          {notification
                            .sender
                            ?.isOfficial ===
                            true && (
                            <span
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius:
                                  "50%",
                                background:
                                  "#ff6a00",
                                display:
                                  "inline-block",
                              }}
                            />
                          )}

                        </div>


                        <div
                          style={{
                            fontSize:
                              "14px",
                            marginTop:
                              "3px",
                          }}
                        >
                          {notification.message}
                        </div>


                        <span
                          style={{
                            display:
                              "block",
                            fontSize:
                              "12px",
                            marginTop:
                              "5px",
                            opacity:
                              0.55,
                          }}
                        >
                          {getNotificationTime(
                            notification.createdAt
                          )}
                        </span>

                      </div>


                      {/* UNREAD DOT */}

                      {!notification.read && (
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            minWidth: "8px",
                            borderRadius:
                              "50%",
                            background:
                              "#ff6a00",
                          }}
                        />
                      )}

                    </button>
                  )
                )}
              </div>
            )}

        </section>


        {/* =====================================
            HERO
        ===================================== */}

        <section className="notifications-hero">

          <div className="notifications-hero-icon">
            🔔
          </div>

          <div>

            <h2>
              Stay in the moment.
            </h2>

            <p>
              Choose what Impressa should
              notify you about.
            </p>

          </div>

        </section>


        {/* =====================================
            SOCIAL ACTIVITY
        ===================================== */}

        <section className="notifications-card">

          <div className="notifications-card-header">

            <div className="notifications-card-icon">
              ✨
            </div>

            <div>

              <h2>
                Social activity
              </h2>

              <p>
                Know when people interact
                with your content.
              </p>

            </div>

          </div>


          <NotificationRow
            title="Impressions"
            description="When someone gives your post an impression."
            enabled={impressions}
            setEnabled={
              handleImpressionsChange
            }
            disabled={
              loading || saving
            }
          />


          <NotificationRow
            title="Comments"
            description="When someone comments on your post."
            enabled={comments}
            setEnabled={
              handleCommentsChange
            }
            disabled={
              loading || saving
            }
          />


          <NotificationRow
            title="New followers"
            description="When someone follows your account."
            enabled={followers}
            setEnabled={
              handleFollowersChange
            }
            disabled={
              loading || saving
            }
          />

        </section>


        {/* =====================================
            IMPRESSA
        ===================================== */}

        <section className="notifications-card">

          <div className="notifications-card-header">

            <div className="notifications-card-icon">
              ⚡
            </div>

            <div>

              <h2>
                Impressa
              </h2>

              <p>
                Important updates from Impressa.
              </p>

            </div>

          </div>


          <NotificationRow
            title="i-Notes"
            description="Updates related to your public i-Notes."
            enabled={notes}
            setEnabled={
              handleNotesChange
            }
            disabled={
              loading || saving
            }
          />


          <NotificationRow
            title="Spark challenges"
            description="Daily challenge and Spark updates."
            enabled={spark}
            setEnabled={
              handleSparkChange
            }
            disabled={
              loading || saving
            }
          />

        </section>


        {/* =====================================
            BACKEND INFORMATION
        ===================================== */}

        <section className="notifications-info">

          <div className="notifications-info-icon">
            🔔
          </div>

          <div>

            <strong>
              Notification preferences
            </strong>

            <p>
              Your notification choices are
              saved to your Impressa account.
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

        <strong>
          {title}
        </strong>

        <span>
          {description}
        </span>

      </div>


      <button
        type="button"
        className={`notification-switch ${
          enabled ? "is-on" : ""
        }`}
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