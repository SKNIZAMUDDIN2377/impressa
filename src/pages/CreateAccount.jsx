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

  // ==========================================
  // PHONE VALIDATION
  // ==========================================
  // Previously any non-empty string (including a 3-digit number)
  // passed validation and was sent straight to the backend. This
  // now requires digits only, with a real phone-length minimum.

  const digitsOnly = phone.replace(/\D/g, "");

  const isPhoneValid =
    digitsOnly.length >= 10 &&
    digitsOnly.length <= 15;

  const handlePhoneChange = (event) => {
    // Strip anything that isn't a digit as the user types.
    const cleaned = event.target.value.replace(/\D/g, "");

    setPhone(cleaned);
  };

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

    if (!isPhoneValid) {
      return;
    }

    if (!passwordsMatch) {
      return;
    }

    setIsLoading(true);

    try {
      const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
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

      if (!response.ok) {
        alert(
          data.message ||
            "Unable to create Impressa account."
        );

        return;
      }

      console.log(
        "Account created successfully 🎉"
      );

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      alert(
        data.message ||
          "Impressa account created successfully 🎉"
      );

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

      <div className="create-account-container">

        <section className="create-account-brand">

          <div className="create-account-logo">
            impressa<span>.</span>
          </div>

          <p className="create-account-tagline">
            Rise through impressions
          </p>

        </section>

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

            <div className="create-account-field">

              <label htmlFor="create-phone">
                Phone number
              </label>

              <div
                className={`create-account-input ${
                  phone && !isPhoneValid
                    ? "field-error"
                    : ""
                }`}
              >

                <span className="create-account-icon phone-icon">
                  +
                </span>

                <input
                  id="create-phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="Enter your phone number"
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={15}
                />

              </div>

              {phone && !isPhoneValid && (
                <span className="field-error-text">
                  {digitsOnly.length < 10
                    ? "Enter a valid phone number (at least 10 digits)"
                    : "Phone number is too long"}
                </span>
              )}

            </div>

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

            <div className="create-account-field">

              <label htmlFor="confirm-password">
                Confirm password
              </label>

              <div
                className={`create-account-input ${
                  confirmPassword &&
                  !passwordsMatch
                    ? "field-error"
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
                  <span className="field-error-text">
                    Passwords do not match
                  </span>
                )}

            </div>

            <button
              type="submit"
              className="create-account-button"
              disabled={
                isLoading ||
                !username.trim() ||
                !isPhoneValid ||
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

            <p className="create-account-terms">
              By creating an account you agree to our{" "}
              <Link to="/community-guidelines">
                Community Guidelines
              </Link>{" "}
              and{" "}
              <Link to="/privacy-policy">
                Privacy Policy
              </Link>
              .
            </p>

          </form>

          <div className="already-account">

            <span>
              Already have an account?
            </span>

            <Link to="/SignIn">
              Sign In
            </Link>

          </div>

        </section>

        <p className="create-account-footer">
          © {new Date().getFullYear()} Impressa
        </p>

      </div>

    </main>
  );
}

export default CreateAccount;