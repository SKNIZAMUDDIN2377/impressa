import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { getStoredTheme } from "../utils/theme";
import "./Customize.css";

// V2 placeholder: nothing here is purchasable or functional in V1.
// The theme previews below are drawn with CSS only (no image files).

const THEME_PREVIEWS = [
  {
    id: "sunset",
    name: "Sunset",
    bg: "linear-gradient(160deg, #ffe3c8 0%, #ff9a52 100%)",
    panel: "rgba(255, 255, 255, 0.88)",
    accent: "#ff6a00",
    ink: "#4a2208",
  },
  {
    id: "midnight",
    name: "Midnight",
    bg: "linear-gradient(160deg, #2a2a33 0%, #0e0e12 100%)",
    panel: "rgba(255, 255, 255, 0.12)",
    accent: "#ff8a3d",
    ink: "#f2f2f5",
  },
  {
    id: "ocean",
    name: "Ocean",
    bg: "linear-gradient(160deg, #d6f1f7 0%, #3aa6c4 100%)",
    panel: "rgba(255, 255, 255, 0.85)",
    accent: "#0e7c9b",
    ink: "#0b3340",
  },
  {
    id: "rose",
    name: "Rose",
    bg: "linear-gradient(160deg, #ffdbe6 0%, #ff7aa2 100%)",
    panel: "rgba(255, 255, 255, 0.86)",
    accent: "#d6336c",
    ink: "#4d1427",
  },
];

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ThemePreview({ theme }) {
  return (
    <div
      className="customize-theme"
      role="listitem"
      aria-disabled="true"
      aria-label={`${theme.name} theme, locked until Impressa V2`}
    >
      <div
        className="customize-preview"
        style={{
          "--pv-bg": theme.bg,
          "--pv-panel": theme.panel,
          "--pv-accent": theme.accent,
          "--pv-ink": theme.ink,
        }}
        aria-hidden="true"
      >
        <span className="pv-avatar" />
        <span className="pv-name" />
        <span className="pv-handle" />

        <span className="pv-stats">
          <i />
          <i />
          <i />
        </span>

        <span className="pv-star">★</span>

        <span className="pv-veil" />

        <span className="pv-lock">
          <LockIcon />
        </span>
      </div>

      <div className="customize-theme-info">
        <h3>{theme.name}</h3>
        <span className="customize-theme-tag">Unlocks in V2</span>
      </div>
    </div>
  );
}

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

      <section className="customize-previews">

        <div className="customize-section-head">
          <h2>Theme previews</h2>
          <p>A first look at themes for your profile.</p>
        </div>

        <div className="customize-grid" role="list">
          {THEME_PREVIEWS.map((theme) => (
            <ThemePreview key={theme.id} theme={theme} />
          ))}
        </div>

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