import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { getStoredTheme } from "../utils/theme";
import "./Customize.css";

// V2 placeholder: nothing here is purchasable or functional in V1.

function Customize() {
  const navigate = useNavigate();

  const isDark = useMemo(() => getStoredTheme() === "dark", []);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className={`customize-page ${isDark ? "theme-dark" : ""}`}>

      <div className="customize-topbar">
        <button
          type="button"
          className="customize-back"
          onClick={goBack}
          aria-label="Go back"
        >
          ←
        </button>
      </div>

      <section className="customize-hero">

        <div className="customize-hero-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="34"
            height="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
          </svg>
        </div>

        <span className="customize-eyebrow">IMPRESSA</span>

        <h1>Impressa Customize</h1>

        <span className="customize-v2-pill">Coming in Impressa V2</span>

        <p>
          Premium themes and customization options are coming in
          Impressa V2. Nothing here is available yet, and nothing
          in V1 requires a purchase.
        </p>

      </section>

      <section className="customize-list">

        <div className="customize-card" aria-disabled="true">
          <div className="customize-card-text">
            <h2>Premium themes</h2>
            <p>Personalize how Impressa looks.</p>
          </div>
          <span className="customize-card-tag">V2</span>
        </div>

        <div className="customize-card" aria-disabled="true">
          <div className="customize-card-text">
            <h2>Customization options</h2>
            <p>More ways to make your profile your own.</p>
          </div>
          <span className="customize-card-tag">V2</span>
        </div>

      </section>

    </div>
  );
}

export default Customize;