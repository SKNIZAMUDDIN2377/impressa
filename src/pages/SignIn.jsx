import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./SignIn.css";

function SignIn() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      const API_URL = `http://${window.location.hostname}:5000`;

      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Login failed");
        return;
      }

      // ==========================================
      // SAVE JWT TOKEN
      // ==========================================

      localStorage.setItem("token", data.token);

      // ==========================================
      // SAVE USER INFORMATION
      // ==========================================

      if (data.user) {
        const loggedInUser = {
          id: data.user.id,
          name: data.user.name,
          username: data.user.username,
        };

        localStorage.setItem(
          "user",
          JSON.stringify(loggedInUser)
        );

        // ==========================================
        // SAVE / UPDATE ACCOUNT FOR ACCOUNT CENTER
        // ==========================================

        const storedAccounts = JSON.parse(
          localStorage.getItem(
            "impressa_accounts"
          ) || "[]"
        );

        const loggedInAccount = {
          id: data.user.id,
          name: data.user.name,
          username: data.user.username,
          phone: data.user.phone || "",
          profilePic:
            data.user.profilePicture || "",
          token: data.token,
        };

        const existingAccountIndex =
          storedAccounts.findIndex(
            (account) =>
              String(account.id) ===
              String(loggedInAccount.id)
          );

        if (existingAccountIndex !== -1) {
          storedAccounts[
            existingAccountIndex
          ] = {
            ...storedAccounts[
              existingAccountIndex
            ],
            ...loggedInAccount,
          };
        } else {
          storedAccounts.push(
            loggedInAccount
          );
        }

        localStorage.setItem(
          "impressa_accounts",
          JSON.stringify(storedAccounts)
        );

        // ==========================================
        // SET ACTIVE ACCOUNT
        // ==========================================

        localStorage.setItem(
          "impressa_active_account",
          JSON.stringify(loggedInAccount)
        );
      }

      // Login successful
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);

      alert(
        "Unable to connect to Impressa server. Make sure the backend is running."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="signin-page">

      {/* BACKGROUND */}

      <div className="signin-glow signin-glow-one" />
      <div className="signin-glow signin-glow-two" />

      <div className="signin-container">

        {/* BRAND */}

        <section className="signin-brand">

          <div className="signin-logo">
            impressa
          </div>

          <p className="signin-tagline">
            Rise through impressions
          </p>

          <div className="signin-brand-line" />

        </section>

        {/* LOGIN CARD */}

        <section className="signin-card">

          <div className="signin-heading">

            <span className="signin-eyebrow">
              WELCOME BACK
            </span>

            <h1>
              Login to Impressa
            </h1>

            <p>
              Your moments. Your impressions.
            </p>

          </div>

          <form
            className="signin-form"
            onSubmit={handleSubmit}
          >

            {/* USERNAME */}

            <div className="signin-field">

              <label htmlFor="signin-username">
                Username
              </label>

              <div className="signin-input-box">

                <span className="signin-input-icon">
                  @
                </span>

                <input
                  id="signin-username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  placeholder="Enter your username"
                  autoComplete="username"
                />

              </div>

            </div>

            {/* PASSWORD */}

            <div className="signin-field">

              <div className="signin-password-header">

                <label htmlFor="signin-password">
                  Password
                </label>

                <button
                  type="button"
                  className="signin-forgot"
                  onClick={() => {
                    alert(
                      "Forgot password will be connected with the backend."
                    );
                  }}
                >
                  Forgot password?
                </button>

              </div>

              <div className="signin-input-box">

                <span className="signin-input-icon">
                  •
                </span>

                <input
                  id="signin-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="signin-show-password"
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

            {/* SIGN IN BUTTON */}

            <button
              type="submit"
              className="signin-button"
              disabled={
                isLoading ||
                !username.trim() ||
                !password.trim()
              }
            >

              {isLoading ? (
                <span className="signin-loader">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <>
                  <span>Sign In</span>

                  <span className="signin-arrow">
                    →
                  </span>
                </>
              )}

            </button>

          </form>

          {/* CREATE ACCOUNT */}

          <div className="signin-create">

            <span>
              New to Impressa?
            </span>

            <Link to="/create-account">
              Create Account
            </Link>

          </div>

        </section>

        {/* FOOTER */}

        <p className="signin-footer">
          © {new Date().getFullYear()} Impressa
        </p>

      </div>

    </main>
  );
}

export default SignIn;