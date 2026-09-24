import "./Action.css";

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-5 3v-3.8a2 2 0 0 1-3-1.2v-8a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 3.5L10.8 13.2" />
      <path d="M20.5 3.5L14.3 20.5L10.8 13.2L3.5 9.7L20.5 3.5Z" />
    </svg>
  );
}

function ImpressionIcon({ active }) {
  return (
    <span
      className={`impression-i ${
        active ? "is-active" : ""
      }`}
      aria-hidden="true"
    >
      i
    </span>
  );
}

function Action({
  comments = 0,
  impressions = 0,
  impressed = false,
  onComment,
  onImpression,
  onShare,
}) {
  return (
    <div className="post-actions">

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


      {/* IMPRESSIONS */}

      <button
        type="button"
        className={`impression-button ${
          impressed ? "impressed" : ""
        }`}
        aria-label={
          impressed
            ? "Already impressed"
            : `Impressions ${impressions}`
        }
        aria-pressed={impressed}
        onClick={onImpression}
      >
        <ImpressionIcon
          active={impressed}
        />

        <span>
          {impressions}
        </span>
      </button>


      {/* SHARE */}

      <button
        type="button"
        className="action-button"
        aria-label="Share post"
        onClick={onShare}
      >
        <ShareIcon />
      </button>

    </div>
  );
}

export default Action;