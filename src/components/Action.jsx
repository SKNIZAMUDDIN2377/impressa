import { useEffect, useLayoutEffect, useState } from "react";
import "./Action.css";

// [x, y] distance each spark flies from the dot
const DROPS = [
  [-11, -2],
  [-8, -8],
  [-3, -12],
  [3, -12],
  [8, -8],
  [11, -2],
];

// 4-point sparkle centred on the dot
const STAR =
  "M12 -1.5L13.6 3.9L19 5.5L13.6 7.1L12 12.5L10.4 7.1L5 5.5L10.4 3.9Z";

// How long each animation plays before the icon returns to rest
const ON_MS = 1300;
const OFF_MS = 900;

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 11.5a8 8 0 0 1-11.6 7.1L4 20l1.5-4.6A8 8 0 1 1 20.5 11.5Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3l-6.5 18-4-7.5L3 9.5 21 3Z" />
    </svg>
  );
}

// A bold, rounded "i". The dot is always orange (the Impressa signature).
// Tapping lifts the dot, fills the stem with ink, and the dot lands with a
// jelly bounce, a glow and sparks. Changing the key restarts the animation.
function ImpressionIcon({ impressed, anim }) {
  const play = anim ? `play-${anim.kind}` : "";

  return (
    <span
      key={anim ? anim.id : "idle"}
      className={`imp-icon ${impressed ? "on" : ""} ${play}`}
      aria-hidden="true"
    >
      <span className="imp-aura" />

      <svg viewBox="0 0 24 32" className="imp-glyph">
        <defs>
          <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffa25c" />
            <stop offset="1" stopColor="#ff6a00" />
          </linearGradient>
          <clipPath id="impStemClip">
            <rect x="8.4" y="12" width="7.2" height="16.5" rx="3.6" />
          </clipPath>
        </defs>

        <g className="imp-body">
          <g clipPath="url(#impStemClip)">
            <rect
              className="imp-rise"
              x="6"
              y="10"
              width="12"
              height="20"
              fill="url(#impGrad)"
            />
          </g>

          <rect
            className="imp-stem"
            x="8.4"
            y="12"
            width="7.2"
            height="16.5"
            rx="3.6"
          />

          <rect
            className="imp-shine"
            x="10.1"
            y="15"
            width="1.6"
            height="8"
            rx="0.8"
          />
        </g>

        <path className="imp-star" d={STAR} />

        {anim?.kind === "on" &&
          DROPS.map(([dx, dy], index) => (
            <circle
              key={index}
              className="imp-drop"
              cx="12"
              cy="5.5"
              r="1.1"
              style={{ "--dx": `${dx}px`, "--dy": `${dy}px` }}
            />
          ))}

        <circle className="imp-dot" cx="12" cy="5.5" r="3.6" />
      </svg>
    </span>
  );
}

function Action({
  comments = 0,
  impressions = 0,
  impressed = false,
  pulseKey,
  onComment,
  onImpression,
  onShare,
}) {
  // pulseKey comes from Post.jsx and changes on every button tap AND every
  // double-tap on the photo. If it is not passed, taps on this button
  // trigger the animation by themselves.
  const [localKey, setLocalKey] = useState(0);

  const animKey = pulseKey === undefined ? localKey : pulseKey;

  const [anim, setAnim] = useState(null);

  const [roll, setRoll] = useState({ n: impressions, dir: "" });

  // Runs before the browser paints, so there is no flash of the final state
  useLayoutEffect(() => {
    if (!animKey) return undefined;

    const kind = impressed ? "on" : "off";

    setAnim({ kind, id: animKey });

    if (kind === "on") {
      try {
        if (navigator.vibrate) navigator.vibrate(12);
      } catch (error) {
        // vibration is optional
      }
    }

    const timer = setTimeout(
      () => setAnim(null),
      kind === "on" ? ON_MS : OFF_MS
    );

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  // The count rolls up or down whenever it changes (not on first load)
  useEffect(() => {
    setRoll((current) =>
      current.n === impressions
        ? current
        : {
            n: impressions,
            dir: impressions > current.n ? "up" : "down",
          }
    );
  }, [impressions]);

  const handleImpression = () => {
    if (pulseKey === undefined) {
      setLocalKey((value) => value + 1);
    }

    if (onImpression) onImpression();
  };

  return (
    <div className="post-actions">
      {/* IMPRESSION */}

      <button
        type="button"
        className={`impression-button ${impressed ? "impressed" : ""}`}
        aria-label={impressed ? "Remove impression" : "Give impression"}
        aria-pressed={impressed}
        onClick={handleImpression}
      >
        <ImpressionIcon impressed={impressed} anim={anim} />

        <span className="imp-count">
          <span key={roll.n} className={`imp-num ${roll.dir}`}>
            {impressions}
          </span>
        </span>
      </button>

      {/* COMMENTS */}

      <button
        type="button"
        className="action-button"
        aria-label={`Comments ${comments}`}
        onClick={onComment}
      >
        <CommentIcon />

        <span>{comments}</span>
      </button>

      {/* SHARE */}

      <button
        type="button"
        className="action-button action-share"
        aria-label="Share post"
        onClick={onShare}
      >
        <ShareIcon />
      </button>
    </div>
  );
}

export default Action;