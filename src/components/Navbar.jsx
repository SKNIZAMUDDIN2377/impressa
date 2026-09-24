import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import "./Navbar.css";


// =====================================================
// HOME
// =====================================================

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="nav-icon"
      aria-hidden="true"
    >
      <path d="M3.5 10.5L12 3.5l8.5 7" />
      <path d="M5.5 9.5v10h13v-10" />
      <path d="M9.5 19.5v-5h5v5" />
    </svg>
  );
}


// =====================================================
// SEARCH
// =====================================================

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="nav-icon"
      aria-hidden="true"
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="6.3"
      />

      <path d="M15.3 15.3L21 21" />
    </svg>
  );
}


// =====================================================
// PULSE
// =====================================================

function PulseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="nav-icon pulse-nav-icon"
      aria-hidden="true"
    >
      <path d="M2.5 12h4l2-5.8L12.2 18l2.2-6H21.5" />
    </svg>
  );
}


// =====================================================
// IMPRESSION
// =====================================================

function ImpressionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="nav-icon impression-nav-icon"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="3"
      />

      <path d="M12 2.5v2.5" />
      <path d="M12 19v2.5" />

      <path d="M2.5 12H5" />
      <path d="M19 12h2.5" />

      <path d="M5.3 5.3l1.8 1.8" />
      <path d="M16.9 16.9l1.8 1.8" />

      <path d="M18.7 5.3l-1.8 1.8" />
      <path d="M7.1 16.9l-1.8-1.8" />
    </svg>
  );
}


// =====================================================
// PROFILE
// =====================================================

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="nav-icon"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="3.3"
      />

      <path
        d="
          M5.5 20
          c.8-3.6
          3-5.5
          6.5-5.5
          s5.7 1.9
          6.5 5.5
        "
      />
    </svg>
  );
}


// =====================================================
// CREATE POST
// =====================================================

function CreatePostIcon() {
  return (
    <span
      className="create-post-icon"
      aria-hidden="true"
    >
      <span className="i-letter">
        i
      </span>

      <span className="plus-letter">
        +
      </span>
    </span>
  );
}


// =====================================================
// NAVBAR
// =====================================================

function Navbar() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [
    hasUnreadNotifications,
    setHasUnreadNotifications,
  ] = useState(false);


  // =====================================================
  // API URL
  // =====================================================

  const API_URL =
    import.meta.env.VITE_API_URL ||
    `http://${window.location.hostname}:5000`;


  // =====================================================
  // CHECK UNREAD NOTIFICATIONS
  // =====================================================

  const checkUnreadNotifications =
    useCallback(
      async () => {
        try {
          const token =
            localStorage.getItem(
              "token"
            );

          if (!token) {
            setHasUnreadNotifications(
              false
            );

            return;
          }


          const response =
            await fetch(
              `${API_URL}/api/notifications`,
              {
                method: "GET",

                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );


          if (!response.ok) {
            return;
          }


          const data =
            await response.json();


          const notifications =
            data.notifications ||
            [];


          const unread =
            notifications.some(
              (notification) =>
                notification.read !==
                true
            );


          setHasUnreadNotifications(
            unread
          );

        } catch (error) {
          console.error(
            "Navbar notification check error ❌",
            error
          );
        }
      },
      [API_URL]
    );


  // =====================================================
  // INITIAL + PERIODIC CHECK
  // =====================================================

  useEffect(() => {
    checkUnreadNotifications();

    const interval =
      setInterval(
        checkUnreadNotifications,
        10000
      );

    return () => {
      clearInterval(
        interval
      );
    };
  }, [
    checkUnreadNotifications,
  ]);


  // =====================================================
  // REFRESH NOTIFICATION STATE
  // =====================================================

  useEffect(() => {

    const handleNotificationRefresh =
      () => {
        checkUnreadNotifications();
      };


    window.addEventListener(
      "impressa-notifications-refresh",
      handleNotificationRefresh
    );


    window.addEventListener(
      "focus",
      handleNotificationRefresh
    );


    return () => {

      window.removeEventListener(
        "impressa-notifications-refresh",
        handleNotificationRefresh
      );


      window.removeEventListener(
        "focus",
        handleNotificationRefresh
      );

    };

  }, [
    checkUnreadNotifications,
  ]);


  // =====================================================
  // HOME CLICK
  // =====================================================

  const handleHomeClick = (
    event
  ) => {

    event.preventDefault();


    // Always go to top

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });


    // Tell Home to fetch latest posts

    window.dispatchEvent(
      new Event(
        "impressa-home-refresh"
      )
    );


    // Navigate only if needed

    if (
      location.pathname !== "/"
    ) {
      navigate("/");
    }
  };


  return (
    <>

      {/* =================================================
          TOP BRAND BAR
      ================================================= */}

      <nav className="impressa-topbar">

        <div className="navbar-logo">

          <span>
            impressa
          </span>

        </div>

      </nav>


      {/* =================================================
          BOTTOM NAVIGATION
      ================================================= */}

      <nav
        className="impressa-bottom-nav"
        aria-label="Main navigation"
      >

        <div className="navbar-links">


          {/* HOME */}

          <NavLink
            to="/"
            end
            title="Home"
            aria-label="Home"
            onClick={
              handleHomeClick
            }
          >
            <HomeIcon />
          </NavLink>


          {/* SEARCH */}

          <NavLink
            to="/search"
            title="Search"
            aria-label="Search"
          >
            <SearchIcon />
          </NavLink>


          {/* PULSE */}

          <NavLink
            to="/pulse"
            title="Pulse"
            aria-label="Pulse"
          >
            <PulseIcon />
          </NavLink>


          {/* CREATE POST */}

          <NavLink
            to="/create-post"
            className="post-link"
            title="Create Post"
            aria-label="Create Post"
          >
            <CreatePostIcon />
          </NavLink>


          {/* IMPRESSIONS */}

          <NavLink
            to="/impressions"
            title="Impressions"
            aria-label="Impressions"
          >

            <ImpressionIcon />

            {hasUnreadNotifications && (
              <span
                className="notification-badge"
                aria-label="Unread notifications"
              />
            )}

          </NavLink>


          {/* PROFILE */}

          <NavLink
            to="/profile"
            title="Profile"
            aria-label="Profile"
          >
            <ProfileIcon />
          </NavLink>


        </div>

      </nav>

    </>
  );
}


export default Navbar;