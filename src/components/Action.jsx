import "./Action.css";

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

function ImpressionIcon({ active }) {
  return (
    <span
      className={`impression-i ${active ? "is-active" : ""}`}
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
      {/* IMPRESSION */}

      <button
        type="button"
        className={`impression-button ${impressed ? "impressed" : ""}`}
        aria-label={
          impressed ? "Remove impression" : "Give impression"
        }
        aria-pressed={impressed}
        onClick={onImpression}
      >
        <ImpressionIcon active={impressed} />

        <span>{impressions}</span>
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