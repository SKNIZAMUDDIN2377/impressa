import "../styles/safety.css";

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  busy = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div
      className="safety-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div
        className="safety-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3>{title}</h3>
        <p>{message}</p>

        <div className="safety-dialog-actions">
          <button
            type="button"
            className="safety-btn-cancel"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            className="safety-btn-confirm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;