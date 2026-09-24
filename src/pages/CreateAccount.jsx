import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./CreateAccount.css";

function CreateAccount() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordsMatch =
    password === confirmPassword;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !username.trim() ||
      !phone.trim() ||
      !password ||
      !confirmPassword
    ) {
      return;
    }

    if (!passwordsMatch) {
      return;
    }

    setIsLoading(true);

    try {
      // ==========================================
      // IMPRESSA BACKEND URL
      // ==========================================

      const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

      // ==========================================
      // REGISTER USER
      // ==========================================

      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            // Backend requires name.
            // Current UI does not have a separate
            // name field, so username is used initially.
            name: username.trim(),

            username: username.trim(),

            phone: phone.trim(),

            password,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "Impressa registration response:",
        data
      );

      // ==========================================
      // REGISTRATION FAILED
      // ==========================================

      if (!response.ok) {
        alert(
          data.message ||
            "Unable to create Impressa account."
        );

        return;
      }

      // ==========================================
      // REGISTRATION SUCCESSFUL
      // ==========================================

      console.log(
        "Account created successfully 🎉"
      );

      /*
        Remove the old logged-in account session.

        This is important when creating a second
        account while the first account is still
        logged in.
      */

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      alert(
        data.message ||
          "Impressa account created successfully 🎉"
      );

      // ==========================================
      // GO TO SIGN IN
      // ==========================================

      navigate("/SignIn");

    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      alert(
        "Unable to connect to Impressa server. Make sure the backend is running."
      );

    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="create-account-page">

      {/* BACKGROUND DECORATION */}

      <div className="create-account-glow create-account-glow-one" />
      <div className="create-account-glow create-account-glow-two" />

      <div className="create-account-container">

        {/* BRAND */}

        <section className="create-account-brand">

          <div className="create-account-logo">
            impressa
          </div>

          <p className="create-account-tagline">
            Rise through impressions
          </p>

          <div className="create-account-line" />

        </section>

        {/* FORM AREA */}

        <section className="create-account-card">

          <div className="create-account-heading">

            <span className="create-account-eyebrow">
              JOIN IMPRESSA
            </span>

            <h1>
              Create your account
            </h1>

            <p>
              Start your journey through impressions.
            </p>

          </div>

          <form
            className="create-account-form"
            onSubmit={handleSubmit}
          >

            {/* USERNAME */}

            <div className="create-account-field">

              <label htmlFor="create-username">
                Username
              </label>

              <div className="create-account-input">

                <span className="create-account-icon">
                  @
                </span>

                <input
                  id="create-username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  placeholder="Choose a username"
                  autoComplete="username"
                />

              </div>

            </div>


            {/* PHONE */}

            <div className="create-account-field">

              <label htmlFor="create-phone">
                Phone number
              </label>

              <div className="create-account-input">

                <span className="create-account-icon phone-icon">
                  +
                </span>

                <input
                  id="create-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  placeholder="Enter your phone number"
                  autoComplete="tel"
                  inputMode="numeric"
                />

              </div>

            </div>


            {/* PASSWORD */}

            <div className="create-account-field">

              <label htmlFor="create-password">
                Password
              </label>

              <div className="create-account-input">

                <span className="create-account-icon">
                  •
                </span>

                <input
                  id="create-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Create a password"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="create-account-show"
                  onClick={() =>
                    setShowPassword(
                      (previous) => !previous
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? "◉" : "○"}
                </button>

              </div>

            </div>


            {/* CONFIRM PASSWORD */}

            <div className="create-account-field">

              <label htmlFor="confirm-password">
                Confirm password
              </label>

              <div
                className={`create-account-input ${
                  confirmPassword &&
                  !passwordsMatch
                    ? "password-error"
                    : ""
                }`}
              >

                <span className="create-account-icon">
                  •
                </span>

                <input
                  id="confirm-password"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="create-account-show"
                  onClick={() =>
                    setShowConfirmPassword(
                      (previous) => !previous
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showConfirmPassword ? "◉" : "○"}
                </button>

              </div>

              {confirmPassword &&
                !passwordsMatch && (
                  <span className="password-error-text">
                    Passwords do not match
                  </span>
                )}

            </div>


            {/* CREATE ACCOUNT BUTTON */}

            <button
              type="submit"
              className="create-account-button"
              disabled={
                isLoading ||
                !username.trim() ||
                !phone.trim() ||
                !password ||
                !confirmPassword ||
                !passwordsMatch
              }
            >

              {isLoading ? (
                <span className="create-account-loader">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <>
                  <span>
                    Create Account
                  </span>

                  <span className="create-account-arrow">
                    →
                  </span>
                </>
              )}

            </button>

          </form>


          {/* LOGIN LINK */}

          <div className="already-account">

            <span>
              Already have an account?
            </span>

            <Link to="/SignIn">
              Sign In
            </Link>

          </div>

        </section>


        {/* FOOTER */}

        <p className="create-account-footer">
          © {new Date().getFullYear()} Impressa
        </p>

      </div>

    </main>
  );
}

export default CreateAccount;