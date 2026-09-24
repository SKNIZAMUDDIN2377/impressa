import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AccountSettings.css";

function AccountSettings() {
  const navigate = useNavigate();

  // ==========================================
  // ACCOUNT INFORMATION
  // ==========================================

  const [username, setUsername] = useState("Loading...");
  const [phone, setPhone] = useState("Loading...");

  const [loadingAccount, setLoadingAccount] = useState(true);

  // ==========================================
  // PASSWORD VISIBILITY
  // ==========================================

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ==========================================
  // PASSWORD FORM
  // ==========================================

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);

  // ==========================================
  // DELETE ACCOUNT
  // ==========================================

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ==========================================
  // API
  // ==========================================

  const API_URL = `http://${window.location.hostname}:5000`;

  // ==========================================
  // LOAD ACCOUNT INFORMATION
  // ==========================================

  useEffect(() => {
    const loadAccountSettings = async () => {
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
            data.message || "Unable to load account settings"
          );
        }

        if (data.user) {
          setUsername(data.user.username || "");
          setPhone(data.user.phone || "");
        }
      } catch (error) {
        console.error(
          "Account settings loading error ❌",
          error
        );

        if (
          error.message.includes("expired") ||
          error.message.includes("Authentication")
        ) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/signin");
        }
      } finally {
        setLoadingAccount(false);
      }
    };

    loadAccountSettings();
  }, [navigate]);

  // ==========================================
  // PASSWORD VALIDATION
  // ==========================================

  const passwordsMatch =
    newPassword.length > 0 &&
    newPassword === confirmPassword;

  const passwordRequirements = {
    length:
      newPassword.length >= 8 &&
      newPassword.length <= 64,

    uppercase:
      /[A-Z]/.test(newPassword),

    lowercase:
      /[a-z]/.test(newPassword),

    number:
      /\d/.test(newPassword),

    special:
      /[^A-Za-z\d]/.test(newPassword),

    noSpaces:
      !/\s/.test(newPassword),
  };

  const passwordValid =
    Object.values(passwordRequirements).every(Boolean);

  // ==========================================
  // CHANGE PASSWORD
  // ==========================================

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    if (!currentPassword) {
      alert("Please enter your current password.");
      return;
    }

    if (!passwordValid) {
      alert("Please satisfy all password requirements.");
      return;
    }

    if (!passwordsMatch) {
      alert("New passwords do not match.");
      return;
    }

    try {
      setSaving(true);

      const token = localStorage.getItem("token");

      if (!token) {
        alert(
          "Your session has expired. Please sign in again."
        );
        navigate("/signin");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to change password"
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      alert("Password changed successfully 🔐");
    } catch (error) {
      console.error(
        "Change password error ❌",
        error
      );

      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    sessionStorage.clear();

    navigate("/signin");
  };

  // ==========================================
  // DELETE ACCOUNT
  // ==========================================

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      alert("Please enter your current password.");
      return;
    }

    try {
      setDeletingAccount(true);

      const token = localStorage.getItem("token");

      if (!token) {
        alert(
          "Your session has expired. Please sign in again."
        );

        navigate("/signin");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/auth/delete-account`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword: deletePassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to delete account"
        );
      }

      // ==========================================
      // CLEAR LOCAL ACCOUNT DATA
      // ==========================================

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      localStorage.removeItem(
        "impressa_accounts"
      );

      localStorage.removeItem(
        "impressa_active_account"
      );

      sessionStorage.clear();

      alert(
        "Your Impressa account and all associated data have been permanently deleted."
      );

      navigate("/signin", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Delete account error ❌",
        error
      );

      alert(error.message);
    } finally {
      setDeletingAccount(false);
    }
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <main className="settings-page">

      {/* BACKGROUND */}

      <div className="settings-orb settings-orb-one" />
      <div className="settings-orb settings-orb-two" />

      <div className="settings-container">

        {/* TOP BAR */}

        <header className="settings-topbar">

          <button
            className="settings-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>

          <div>
            <span className="settings-small-title">
              IMPRESSA
            </span>

            <h1>
              Account Settings
            </h1>
          </div>

          <div className="settings-top-space" />

        </header>


        {/* ==========================================
            ACCOUNT
        ========================================== */}

        <section className="settings-section">

          <div className="settings-section-title">

            <span className="settings-section-icon">
              👤
            </span>

            <div>
              <h2>Account</h2>

              <p>
                Your basic account information
              </p>
            </div>

          </div>

          <div className="settings-list">

            {/* USERNAME */}

            <div className="settings-row">

              <div>

                <span className="settings-label">
                  Username
                </span>

                <span className="settings-value">
                  {loadingAccount
                    ? "Loading..."
                    : `@${username}`}
                </span>

              </div>

            </div>


            {/* PHONE */}

            <div className="settings-row">

              <div>

                <span className="settings-label">
                  Phone number
                </span>

                <span className="settings-value">
                  {loadingAccount
                    ? "Loading..."
                    : phone || "Not available"}
                </span>

              </div>

            </div>

          </div>

        </section>


        {/* ==========================================
            SECURITY
        ========================================== */}

        <section className="settings-section security-section">

          <div className="settings-section-title">

            <span className="settings-section-icon orange-icon">
              🔐
            </span>

            <div>
              <h2>Security</h2>

              <p>
                Keep your Impressa account protected
              </p>
            </div>

          </div>


          <form
            className="password-form"
            onSubmit={handlePasswordChange}
          >

            {/* CURRENT PASSWORD */}

            <div className="settings-field">

              <label>
                Current password
              </label>

              <div className="settings-input">

                <input
                  type={
                    showCurrent
                      ? "text"
                      : "password"
                  }
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(
                      event.target.value
                    )
                  }
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowCurrent(
                      (value) => !value
                    )
                  }
                >
                  {showCurrent ? "◉" : "○"}
                </button>

              </div>

            </div>


            {/* NEW PASSWORD */}

            <div className="settings-field">

              <label>
                New password
              </label>

              <div className="settings-input">

                <input
                  type={
                    showNew
                      ? "text"
                      : "password"
                  }
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(
                      event.target.value
                    )
                  }
                  placeholder="Create new password"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowNew(
                      (value) => !value
                    )
                  }
                >
                  {showNew ? "◉" : "○"}
                </button>

              </div>

            </div>


            {/* PASSWORD REQUIREMENTS */}

            {newPassword && (
              <div className="password-rules">

                <span
                  className={
                    passwordRequirements.length
                      ? "valid"
                      : ""
                  }
                >
                  {passwordRequirements.length
                    ? "✓"
                    : "○"}{" "}
                  8–64 characters
                </span>


                <span
                  className={
                    passwordRequirements.uppercase
                      ? "valid"
                      : ""
                  }
                >
                  {passwordRequirements.uppercase
                    ? "✓"
                    : "○"}{" "}
                  Uppercase letter
                </span>


                <span
                  className={
                    passwordRequirements.lowercase
                      ? "valid"
                      : ""
                  }
                >
                  {passwordRequirements.lowercase
                    ? "✓"
                    : "○"}{" "}
                  Lowercase letter
                </span>


                <span
                  className={
                    passwordRequirements.number
                      ? "valid"
                      : ""
                  }
                >
                  {passwordRequirements.number
                    ? "✓"
                    : "○"}{" "}
                  Number
                </span>


                <span
                  className={
                    passwordRequirements.special
                      ? "valid"
                      : ""
                  }
                >
                  {passwordRequirements.special
                    ? "✓"
                    : "○"}{" "}
                  Special character
                </span>


                <span
                  className={
                    passwordRequirements.noSpaces
                      ? "valid"
                      : ""
                  }
                >
                  {passwordRequirements.noSpaces
                    ? "✓"
                    : "○"}{" "}
                  No spaces
                </span>

              </div>
            )}


            {/* CONFIRM PASSWORD */}

            <div className="settings-field">

              <label>
                Confirm new password
              </label>

              <div
                className={`settings-input ${
                  confirmPassword &&
                  !passwordsMatch
                    ? "settings-input-error"
                    : ""
                }`}
              >

                <input
                  type={
                    showConfirm
                      ? "text"
                      : "password"
                  }
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirm(
                      (value) => !value
                    )
                  }
                >
                  {showConfirm ? "◉" : "○"}
                </button>

              </div>

              {confirmPassword &&
                !passwordsMatch && (
                  <span className="password-match-error">
                    Passwords don't match
                  </span>
                )}

            </div>


            {/* CHANGE PASSWORD BUTTON */}

            <button
              type="submit"
              className="change-password-button"
              disabled={
                saving ||
                !currentPassword ||
                !passwordValid ||
                !passwordsMatch
              }
            >

              {saving ? (
                <span className="settings-loader">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <>
                  Change Password
                  <span>→</span>
                </>
              )}

            </button>

          </form>

        </section>


        {/* ==========================================
            PRIVACY
        ========================================== */}

        <section className="settings-section">

          <div className="settings-section-title">

            <span className="settings-section-icon">
              🛡
            </span>

            <div>
              <h2>Privacy</h2>

              <p>
                Control who can interact with you
              </p>
            </div>

          </div>


          <div className="future-setting">

            <div>

              <div className="privacy-setting-heading">

                <strong>
                  Public account
                </strong>

                <span className="v1-badge">
                  V1
                </span>

              </div>

              <span>
                All Impressa accounts are public in V1.
                Private accounts are coming in a future
                version.
              </span>

            </div>


            <button
              type="button"
              className="fake-toggle active"
              onClick={() =>
                alert(
                  "Private accounts are coming soon in Impressa V2. All accounts are public in V1."
                )
              }
              aria-label="Public account"
            >
              <span />
            </button>

          </div>

        </section>


        {/* ==========================================
            NOTIFICATIONS
        ========================================== */}

        <section className="settings-section">

          <div className="settings-section-title">

            <span className="settings-section-icon">
              🔔
            </span>

            <div>
              <h2>Notifications</h2>

              <p>
                Manage your Impressa alerts
              </p>
            </div>

          </div>


          <div className="future-setting">

            <div>

              <strong>
                Impressa notifications
              </strong>

              <span>
                Manage impressions, comments,
                followers, Notes and Spark alerts
                from the Notifications page.
              </span>

            </div>

            <button
              type="button"
              className="fake-toggle active"
              onClick={() =>
                navigate("/notifications")
              }
              aria-label="Open notifications"
            >
              <span />
            </button>

          </div>

        </section>


        {/* ==========================================
            DANGER ZONE
        ========================================== */}

        <section className="danger-section">

          <div className="danger-title">
            Account actions
          </div>


          {/* LOGOUT */}

          <button
            className="logout-button"
            onClick={handleLogout}
          >

            <span>↪</span>

            <div>

              <strong>
                Logout
              </strong>

              <small>
                Sign out of this Impressa account
              </small>

            </div>

            <b>→</b>

          </button>


          {/* DELETE ACCOUNT */}

          <button
            className="delete-account-button"
            onClick={() =>
              setShowDeleteConfirm(true)
            }
            disabled={deletingAccount}
          >
            Delete account
          </button>


          {/* DELETE ACCOUNT CONFIRMATION */}

          {showDeleteConfirm && (
            <div className="delete-confirm-box">

              <h3>
                Delete your account?
              </h3>

              <p>
                This will permanently delete your
                Impressa account, posts, Pulses,
                comments, impressions and other
                associated data. This action
                cannot be undone.
              </p>


              <div className="settings-field">

                <label>
                  Enter your current password
                </label>

                <div className="settings-input">

                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) =>
                      setDeletePassword(
                        event.target.value
                      )
                    }
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    disabled={deletingAccount}
                  />

                </div>

              </div>


              <div className="delete-confirm-actions">

                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword("");
                  }}
                  disabled={deletingAccount}
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={
                    deletingAccount ||
                    !deletePassword
                  }
                >
                  {deletingAccount
                    ? "Deleting..."
                    : "Permanently Delete"}
                </button>

              </div>

            </div>
          )}

        </section>


        <p className="settings-footer">
          Impressa · Rise through impressions
        </p>

      </div>

    </main>
  );
}

export default AccountSettings;