import { Link, useNavigate } from "react-router-dom";

import "../styles/safety.css";

const CONTACT_EMAIL = "contactimpressahelp@gmail.com";

function AccountDeletionInfo() {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="safety-page">
      <div className="safety-header">
        <button
          type="button"
          className="safety-back"
          onClick={goBack}
          aria-label="Go back"
        >
          ←
        </button>

        <h1>Delete Your Account</h1>
      </div>

      <p className="safety-intro">
        You can permanently delete your Impressa account at any time. This
        page explains how, and what happens to your data.
      </p>

      <div className="safety-rule">
        <h3>Delete it yourself in the app</h3>

        <ol>
          <li>Sign in to Impressa.</li>
          <li>Open your Profile and tap the menu (☰).</li>
          <li>Choose Account Settings.</li>
          <li>Tap Delete account.</li>
          <li>Enter your current password and tap Permanently Delete.</li>
        </ol>
      </div>

      <div className="safety-rule">
        <h3>What is deleted</h3>

        <ul>
          <li>Your profile, username, phone number and bio</li>
          <li>Your profile picture</li>
          <li>Your posts, including their photos and videos</li>
          <li>Your comments and impressions</li>
          <li>Your Pulses and i-Notes</li>
          <li>Your notifications, blocks and follow relationships</li>
        </ul>
      </div>

      <div className="safety-rule">
        <h3>What is kept</h3>

        <p>
          Reports about abuse that involve your account are kept so we can
          continue to act on violations of our Community Guidelines. Backup
          copies may remain for a limited time before they are overwritten.
        </p>
      </div>

      <div className="safety-rule">
        <h3>Can't sign in?</h3>

        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with
          the subject "Account deletion request" and include your Impressa
          username. We will verify the request and delete the account.
        </p>
      </div>

      <div className="safety-rule">
        <p>
          Read our <Link to="/privacy-policy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

export default AccountDeletionInfo;