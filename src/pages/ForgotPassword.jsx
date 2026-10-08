import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import RecoveryCodeCard from "../components/RecoveryCodeCard";
import {
  getPasswordHint,
  getPasswordRequirements,
} from "../utils/passwordRules";

import "./ForgotPassword.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

// Shows the code as XXXX-XXXX-XXXX-XXXX while typing
const formatRecoveryCode = (value) => {
  const raw = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);

  return raw.match(/.{1,4}/g)?.join("-") || "";
};

const STEP_NUMBER = {
  username: 1,
  code: 2,
  password: 3,
};

function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState("username");

  const [username, setUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [newRecoveryCode, setNewRecoveryCode] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordHint = getPasswordHint(newPassword);
  const passwordRules = getPasswordRequirements(newPassword);
  const passwordsMatch =
    newPassword.length > 0 && newPassword === confirmPassword;

  const codeComplete =
    recoveryCode.replace(/-/g, "").length === 16;

  // ==========================================
  // NAVIGATION
  // ==========================================

  const goBack = () => {
    setError("");

    if (step === "username" || step === "done") {
      navigate("/signin");
      return;
    }

    if (step === "code") {
      setStep("username");
      return;
    }

    setStep("code");
  };

  // ==========================================
  // STEP 1 — USERNAME (no server call, so nothing
  // reveals whether the account exists)
  // ==========================================

  const handleUsernameSubmit = (event) => {
    event.preventDefault();

    if (!username.trim()) return;

    setError("");
    setStep("code");
  };

  // ==========================================
  // STEP 2 — VERIFY RECOVERY CODE
  // ==========================================

  const handleVerify = async (event) => {
    event.preventDefault();

    if (isLoading || !codeComplete) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/auth/forgot-password/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            recoveryCode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "We couldn't verify that recovery code."
        );
        return;
      }

      setResetToken(data.resetToken);
      setStep("password");
    } catch (requestError) {
      console.error("Verify recovery error:", requestError);

      setError("Unable to connect to Impressa server.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // STEP 3 — NEW PASSWORD
  // ==========================================

  const handleReset = async (event) => {
    event.preventDefault();

    if (isLoading) return;

    if (passwordHint) {
      setError("Please satisfy all password requirements.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/auth/forgot-password/reset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resetToken,
            newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Reset session expired or already used → start verification again
        if (response.status === 401) {
          setResetToken("");
          setNewPassword("");
          setConfirmPassword("");
          setStep("code");
        }

        setError(data.message || "Unable to reset your password.");
        return;
      }

      setNewRecoveryCode(data.recoveryCode || "");

      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setRecoveryCode("");

      setStep("done");
    } catch (requestError) {
      console.error("Reset password error:", requestError);

      setError("Unable to connect to Impressa server.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <main className="fp-page">
      <div className="fp-container">
        <header className="fp-top">
          <button
            type="button"
            className="fp-back"
            onClick={goBack}
            aria-label="Go back"
          >
            ←
          </button>

          <div className="fp-logo">
            impressa<span>.</span>
          </div>
        </header>

        <section className="fp-card">
          {step !== "done" && (
            <div className="fp-steps" aria-hidden="true">
              {[1, 2, 3].map((number) => (
                <span
                  key={number}
                  className={
                    number <= STEP_NUMBER[step] ? "active" : ""
                  }
                />
              ))}
            </div>
          )}

          {/* ---------- STEP 1: USERNAME ---------- */}

          {step === "username" && (
            <>
              <div className="fp-heading">
                <span className="fp-eyebrow">ACCOUNT RECOVERY</span>

                <h1>Forgot your password?</h1>

                <p>
                  Enter your username. Next you'll confirm it's you
                  with your recovery code.
                </p>
              </div>

              <form className="fp-form" onSubmit={handleUsernameSubmit}>
                <div className="fp-field">
                  <label htmlFor="fp-username">Username</label>

                  <div className="fp-input">
                    <span className="fp-icon">@</span>

                    <input
                      id="fp-username"
                      type="text"
                      value={username}
                      onChange={(event) =>
                        setUsername(event.target.value)
                      }
                      placeholder="Enter your username"
                      autoComplete="username"
                      autoCapitalize="none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="fp-button"
                  disabled={!username.trim()}
                >
                  <span>Continue</span>
                  <span>→</span>
                </button>
              </form>
            </>
          )}

          {/* ---------- STEP 2: RECOVERY CODE ---------- */}

          {step === "code" && (
            <>
              <div className="fp-heading">
                <span className="fp-eyebrow">VERIFY IT'S YOU</span>

                <h1>Enter your recovery code</h1>

                <p>
                  This is the 16-character code you saved when you
                  created your account.
                </p>
              </div>

              <form className="fp-form" onSubmit={handleVerify}>
                <div className="fp-field">
                  <label htmlFor="fp-code">Recovery code</label>

                  <div className="fp-input">
                    <span className="fp-icon">#</span>

                    <input
                      id="fp-code"
                      className="fp-code-input"
                      type="text"
                      value={recoveryCode}
                      onChange={(event) =>
                        setRecoveryCode(
                          formatRecoveryCode(event.target.value)
                        )
                      }
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                    />
                  </div>
                </div>

                {error && <p className="fp-error">{error}</p>}

                <button
                  type="submit"
                  className="fp-button"
                  disabled={isLoading || !codeComplete}
                >
                  {isLoading ? (
                    <span className="fp-loader">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    <>
                      <span>Verify</span>
                      <span>→</span>
                    </>
                  )}
                </button>

                <p className="fp-help">
                  Don't have a code? Accounts created before recovery
                  codes existed don't have one yet. If you're still
                  signed in on another device, open{" "}
                  <strong>Account Settings → Account recovery</strong>{" "}
                  there to create it.
                </p>
              </form>
            </>
          )}

          {/* ---------- STEP 3: NEW PASSWORD ---------- */}

          {step === "password" && (
            <>
              <div className="fp-heading">
                <span className="fp-eyebrow">ALMOST DONE</span>

                <h1>Create a new password</h1>

                <p>
                  Choose a strong password you haven't used before.
                </p>
              </div>

              <form className="fp-form" onSubmit={handleReset}>
                <div className="fp-field">
                  <label htmlFor="fp-new">New password</label>

                  <div className="fp-input">
                    <span className="fp-icon">•</span>

                    <input
                      id="fp-new"
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) =>
                        setNewPassword(event.target.value)
                      }
                      placeholder="Create a new password"
                      autoComplete="new-password"
                    />

                    <button
                      type="button"
                      className="fp-show"
                      onClick={() => setShowNew((value) => !value)}
                      aria-label={
                        showNew ? "Hide password" : "Show password"
                      }
                    >
                      {showNew ? "◉" : "○"}
                    </button>
                  </div>
                </div>

                {newPassword && (
                  <div className="fp-rules">
                    <span className={passwordRules.length ? "valid" : ""}>
                      {passwordRules.length ? "✓" : "○"} 8–64 characters
                    </span>

                    <span
                      className={passwordRules.uppercase ? "valid" : ""}
                    >
                      {passwordRules.uppercase ? "✓" : "○"} Uppercase
                      letter
                    </span>

                    <span
                      className={passwordRules.lowercase ? "valid" : ""}
                    >
                      {passwordRules.lowercase ? "✓" : "○"} Lowercase
                      letter
                    </span>

                    <span className={passwordRules.number ? "valid" : ""}>
                      {passwordRules.number ? "✓" : "○"} Number
                    </span>

                    <span className={passwordRules.special ? "valid" : ""}>
                      {passwordRules.special ? "✓" : "○"} Special
                      character
                    </span>

                    <span
                      className={passwordRules.noSpaces ? "valid" : ""}
                    >
                      {passwordRules.noSpaces ? "✓" : "○"} No spaces
                    </span>
                  </div>
                )}

                <div className="fp-field">
                  <label htmlFor="fp-confirm">
                    Confirm new password
                  </label>

                  <div
                    className={`fp-input ${
                      confirmPassword && !passwordsMatch
                        ? "fp-input-error"
                        : ""
                    }`}
                  >
                    <span className="fp-icon">•</span>

                    <input
                      id="fp-confirm"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Confirm your new password"
                      autoComplete="new-password"
                    />

                    <button
                      type="button"
                      className="fp-show"
                      onClick={() =>
                        setShowConfirm((value) => !value)
                      }
                      aria-label={
                        showConfirm ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirm ? "◉" : "○"}
                    </button>
                  </div>

                  {confirmPassword && !passwordsMatch && (
                    <span className="fp-field-error">
                      Passwords don't match
                    </span>
                  )}
                </div>

                {error && <p className="fp-error">{error}</p>}

                <button
                  type="submit"
                  className="fp-button"
                  disabled={
                    isLoading || Boolean(passwordHint) || !passwordsMatch
                  }
                >
                  {isLoading ? (
                    <span className="fp-loader">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    <>
                      <span>Reset password</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ---------- DONE ---------- */}

          {step === "done" && (
            <>
              <div className="fp-heading">
                <span className="fp-eyebrow">ALL SET</span>

                <h1>Password reset ✓</h1>

                <p>
                  Your password has been changed and you've been
                  signed out everywhere.
                </p>
              </div>

              {newRecoveryCode ? (
                <>
                  <p className="fp-help fp-help-top">
                    Your old recovery code no longer works. Save this{" "}
                    <strong>new</strong> one:
                  </p>

                  <RecoveryCodeCard
                    code={newRecoveryCode}
                    confirmLabel="I've saved my new recovery code"
                    actionLabel="Back to Sign In"
                    onDone={() => navigate("/signin")}
                  />
                </>
              ) : (
                <button
                  type="button"
                  className="fp-button"
                  onClick={() => navigate("/signin")}
                >
                  <span>Back to Sign In</span>
                  <span>→</span>
                </button>
              )}
            </>
          )}

          {step !== "done" && (
            <div className="fp-footer-link">
              <span>Remembered it?</span>

              <Link to="/signin">Sign In</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default ForgotPassword;