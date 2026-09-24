import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./Impressions.css";


// ==========================================
// ICONS
// ==========================================

function getIcon(type) {
  const icons = {
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

  return icons[type] || "•";
}


// ==========================================
// TIME FORMAT
// ==========================================

function getTime(createdAt) {
  if (!createdAt) return "";

  const created = new Date(createdAt);
  const now = new Date();

  const seconds = Math.floor(
    (now - created) / 1000
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days} day${
      days === 1 ? "" : "s"
    } ago`;
  }

  return created.toLocaleDateString();
}


// ==========================================
// CONVERT BACKEND NOTIFICATION
// ==========================================

function formatNotification(notification) {
  const sender =
    notification.sender || null;

  const post =
    notification.post || null;

  let detail = "";

  if (
    notification.type === "impression"
  ) {
    detail = post?.caption || "";
  }

  return {
    id: notification._id,

    type:
      notification.type,

    username:
      sender?.username || "",

    senderName:
      sender?.name || "",

    message:
      notification.message || "",

    detail,

    time: getTime(
      notification.createdAt
    ),

    createdAt:
      notification.createdAt,

    image:
      sender?.profilePicture || "",

    postImage:
      post?.media?.[0]?.url || "",

    read:
      notification.read === true,

    senderId:
      sender?._id || null,

    postId:
      post?._id || null,
  };
}


// ==========================================
// IMPRESSIONS PAGE
// ==========================================

function Impression() {
  const [notifications, setNotifications] =
    useState([]);

  const [activeFilter, setActiveFilter] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [profile, setProfile] =
    useState(null);

  const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";


  // ==========================================
  // LOAD PAGE DATA
  // ==========================================

  useEffect(() => {
    const loadImpressionPage =
      async () => {
        try {
          const token =
            localStorage.getItem(
              "token"
            );

          if (!token) {
            window.location.href =
              "/signin";

            return;
          }

          const headers = {
            Authorization:
              `Bearer ${token}`,
          };


          // ----------------------------------
          // PROFILE
          // ----------------------------------

          const profileResponse =
            await fetch(
              `${API_URL}/api/profile/me`,
              {
                method: "GET",
                headers,
              }
            );

          const profileData =
            await profileResponse.json();

          if (
            !profileResponse.ok
          ) {
            throw new Error(
              profileData.message ||
                "Unable to load profile"
            );
          }

          setProfile(
            profileData.user ||
              profileData.profile ||
              profileData
          );


          // ----------------------------------
          // NOTIFICATIONS
          // ----------------------------------

          const notificationResponse =
            await fetch(
              `${API_URL}/api/notifications`,
              {
                method: "GET",
                headers,
              }
            );

          const notificationData =
            await notificationResponse.json();

          if (
            !notificationResponse.ok
          ) {
            throw new Error(
              notificationData.message ||
                "Unable to load notifications"
            );
          }

          const formatted =
            (
              notificationData.notifications ||
              []
            ).map(
              formatNotification
            );

          setNotifications(
            formatted
          );

        } catch (error) {
          console.error(
            "Impressions page loading error ❌",
            error
          );

        } finally {
          setLoading(false);
        }
      };

    loadImpressionPage();
  }, [API_URL]);


  // ==========================================
  // UNREAD COUNT
  // ==========================================

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.read
    ).length;


  // ==========================================
  // FILTERS
  // ==========================================

  const filteredNotifications =
    useMemo(() => {

      if (
        activeFilter === "all"
      ) {
        return notifications;
      }

      if (
        activeFilter === "people"
      ) {
        return notifications.filter(
          (notification) =>
            Boolean(
              notification.username
            )
        );
      }

      if (
        activeFilter === "you"
      ) {
        return notifications.filter(
          (notification) =>
            [
              "post_reach",
              "badge",
              "milestone",
              "spark",
              "system",
            ].includes(
              notification.type
            )
        );
      }

      return notifications;

    }, [
      activeFilter,
      notifications,
    ]);


  // ==========================================
  // MARK ONE READ
  // ==========================================

  const markRead = async (id) => {
    const token =
      localStorage.getItem(
        "token"
      );

    if (!token) return;

    const notification =
      notifications.find(
        (item) =>
          item.id === id
      );

    if (
      !notification ||
      notification.read
    ) {
      return;
    }


    // Immediate UI update

    setNotifications(
      (previous) =>
        previous.map(
          (item) =>
            item.id === id
              ? {
                  ...item,
                  read: true,
                }
              : item
        )
    );


    try {
      const response =
        await fetch(
          `${API_URL}/api/notifications/${id}/read`,
          {
            method: "PUT",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


      if (!response.ok) {
        throw new Error(
          "Failed to mark notification as read"
        );
      }


      // Tell Navbar to refresh
      // unread notification state

      window.dispatchEvent(
        new Event(
          "impressa-notifications-refresh"
        )
      );

    } catch (error) {
      console.error(
        "Mark read error ❌",
        error
      );
    }
  };


  // ==========================================
  // MARK ALL READ
  // ==========================================

  const markAllRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    const token =
      localStorage.getItem(
        "token"
      );

    if (!token) return;


    // Immediate UI update

    setNotifications(
      (previous) =>
        previous.map(
          (notification) => ({
            ...notification,
            read: true,
          })
        )
    );


    try {
      const response =
        await fetch(
          `${API_URL}/api/notifications/read-all`,
          {
            method: "PUT",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


      if (!response.ok) {
        throw new Error(
          "Failed to mark notifications as read"
        );
      }


      // Tell Navbar to refresh
      // unread notification state

      window.dispatchEvent(
        new Event(
          "impressa-notifications-refresh"
        )
      );

    } catch (error) {
      console.error(
        "Mark all read error ❌",
        error
      );
    }
  };


  // ==========================================
  // ACTIVITY DATA
  // ==========================================

  const totalImpressions =
    Number(
      profile?.impressionsReceived ||
        0
    );


  // Today's impression activity

  const todayImpressions =
    notifications.filter(
      (notification) => {

        if (
          notification.type !==
          "impression"
        ) {
          return false;
        }

        if (
          !notification.createdAt
        ) {
          return false;
        }

        const date =
          new Date(
            notification.createdAt
          );

        const today =
          new Date();

        return (
          date.getDate() ===
            today.getDate() &&
          date.getMonth() ===
            today.getMonth() &&
          date.getFullYear() ===
            today.getFullYear()
        );
      }
    ).length;


  // ==========================================
  // BADGE PROGRESS
  // ==========================================

  let nextStar =
    "i Gold Star";

  let badgesNeeded = 1;

  if (
    totalImpressions >= 100
  ) {
    nextStar = "Next Badge";
    badgesNeeded = 0;
  }


  // ==========================================
  // POSTS TODAY
  // ==========================================

  const postsToday =
    profile?.postsToday ??
    profile?.todayPosts ??
    0;


  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <main className="impression-page">

        <header className="impression-header">

          <div className="impression-brand-line">

            <span className="impression-mark">
              i
            </span>

            <span>
              IMPRESSA
            </span>

          </div>


          <div className="impression-title-row">

            <div>

              <span className="impression-small-title">
                YOUR SIGNAL
              </span>

              <h1>
                Impressions
              </h1>

              <p>
                See who noticed you, what
                moved, and what is waiting
                for you.
              </p>

            </div>

          </div>

        </header>


        <div className="empty-notifications">

          <div className="empty-mark">
            i
          </div>

          <h3>
            Loading your impressions...
          </h3>

          <p>
            Bringing your latest activity
            from Impressa.
          </p>

        </div>

      </main>
    );
  }


  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="impression-page">

      {/* =====================================
          HEADER
      ===================================== */}

      <header className="impression-header">

        <div className="impression-brand-line">

          <span className="impression-mark">
            i
          </span>

          <span>
            IMPRESSA
          </span>

        </div>


        <div className="impression-title-row">

          <div>

            <span className="impression-small-title">
              YOUR SIGNAL
            </span>

            <h1>
              Impressions
            </h1>

            <p>
              See who noticed you, what moved,
              and what is waiting for you.
            </p>

          </div>


          {unreadCount > 0 && (
            <button
              type="button"
              className="read-all-button"
              onClick={markAllRead}
            >
              Clear {unreadCount}
            </button>
          )}

        </div>

      </header>


      {/* =====================================
          SIGNAL SUMMARY
      ===================================== */}

      <section
        className="signal-strip"
        aria-label="Impressa activity summary"
      >

        <div>

          <span>
            Today
          </span>

          <strong>
            {todayImpressions}
          </strong>

          <small>
            impressions received
          </small>

        </div>


        <div>

          <span>
            Profile
          </span>

          <strong>
            {totalImpressions}
          </strong>

          <small>
            total impressions
          </small>

        </div>


        <div>

          <span>
            Next
          </span>

          <strong>
            {badgesNeeded}
          </strong>

          <small>
            badge to {nextStar}
          </small>

        </div>

      </section>


      {/* =====================================
          FILTERS
      ===================================== */}

      <nav
        className="activity-filters"
        aria-label="Activity filters"
      >

        <button
          type="button"
          className={
            activeFilter === "all"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveFilter("all")
          }
        >
          All
        </button>


        <button
          type="button"
          className={
            activeFilter === "people"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveFilter("people")
          }
        >
          People
        </button>


        <button
          type="button"
          className={
            activeFilter === "you"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveFilter("you")
          }
        >
          Your journey
        </button>

      </nav>


      {/* =====================================
          LIVE FEED
      ===================================== */}

      <section className="activity-section">

        <div className="section-heading">

          <div>

            <span className="section-kicker">
              LIVE FEED
            </span>

            <h2>
              What’s happening
            </h2>

          </div>

          <span>
            {filteredNotifications.length} updates
          </span>

        </div>


        <div className="notification-list">

          {filteredNotifications.length ===
          0 ? (

            <div className="empty-notifications">

              <div className="empty-mark">
                i
              </div>

              <h3>
                Nothing new here
              </h3>

              <p>
                When something happens around
                your account, it will appear here.
              </p>

            </div>

          ) : (

            filteredNotifications.map(
              (notification) => (

                <article
                  key={
                    notification.id
                  }
                  className={`notification-card ${
                    notification.read
                      ? "read"
                      : "unread"
                  } ${
                    notification.type
                  }`}
                  onClick={() =>
                    markRead(
                      notification.id
                    )
                  }
                >

                  <div
                    className={`notification-icon ${notification.type}`}
                  >
                    {getIcon(
                      notification.type
                    )}
                  </div>


                  {notification.image && (
                    <img
                      className="notification-avatar"
                      src={
                        notification.image
                      }
                      alt=""
                    />
                  )}


                  <div className="notification-content">

                    <div className="notification-topline">

                      {notification.username && (
                        <strong>
                          @
                          {
                            notification.username
                          }
                        </strong>
                      )}

                      <span className="notification-time">
                        {
                          notification.time
                        }
                      </span>

                    </div>


                    <p>
                      {
                        notification.message
                      }
                    </p>


                    {notification.detail && (
                      <span className="notification-detail">
                        {
                          notification.detail
                        }
                      </span>
                    )}

                  </div>


                  {notification.postImage && (
                    <img
                      className="notification-thumbnail"
                      src={
                        notification.postImage
                      }
                      alt=""
                    />
                  )}


                  {!notification.read && (
                    <span className="unread-dot" />
                  )}

                </article>

              )
            )

          )}

        </div>

      </section>


      {/* =====================================
          YOUR JOURNEY
      ===================================== */}

      <section className="journey-section">

        <div className="section-heading">

          <div>

            <span className="section-kicker">
              YOUR JOURNEY
            </span>

            <h2>
              Momentum
            </h2>

          </div>

          <span>
            Today
          </span>

        </div>


        <div className="momentum-grid">

          <article className="momentum-item">

            <span className="momentum-number">
              {postsToday}
            </span>

            <strong>
              Posts
            </strong>

            <p>
              shared today
            </p>

          </article>


          <article className="momentum-item highlight">

            <span className="momentum-number">
              {todayImpressions}
            </span>

            <strong>
              Impressions
            </strong>

            <p>
              received today
            </p>

          </article>


          <article className="momentum-item">

            <span className="momentum-number">
              {badgesNeeded}
            </span>

            <strong>
              To go
            </strong>

            <p>
              for {nextStar}
            </p>

          </article>

        </div>

      </section>


      {/* =====================================
          GETTING STARTED
      ===================================== */}

      <section className="getting-started">

        <div className="getting-started-title">

          <span className="spark-symbol">
            ✧
          </span>

          <div>

            <span className="section-kicker">
              NEW HERE?
            </span>

            <h2>
              Build your impression trail
            </h2>

            <p>
              Three simple actions to start
              your Impressa journey.
            </p>

          </div>

        </div>


        <div className="start-items">

          <div className="start-item">

            <div className="start-number">
              01
            </div>

            <div>

              <strong>
                Make an impression
              </strong>

              <p>
                Share a post that gives people
                something to notice.
              </p>

            </div>

          </div>


          <div className="start-item">

            <div className="start-number">
              02
            </div>

            <div>

              <strong>
                Collect impressions
              </strong>

              <p>
                Your impression count becomes
                part of your journey.
              </p>

            </div>

          </div>


          <div className="start-item">

            <div className="start-number">
              03
            </div>

            <div>

              <strong>
                Rise through badges
              </strong>

              <p>
                Keep building your impression
                trail to unlock your next badge.
              </p>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}

export default Impression;