import { useState } from "react";

import {
  REPORT_REASONS,
  reportUser,
  reportPost,
} from "../utils/safetyApi";

import "../styles/safety.css";

function ReportModal({ open, type = "user", target, onClose }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  const close = () => {
    setReason("");
    setDescription("");
    setError("");
    setDone(false);
    setSubmitting(false);
    onClose();
  };

  const submit = async () => {
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      if (type === "post") {
        await reportPost(target, reason, description.trim());
      } else {
        await reportUser(target, reason, description.trim());
      }

      setDone(true);
    } catch (err) {
      setError(err.message || "Unable to send report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="safety-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          close();
        }
      }}
    >
      <div
        className="safety-dialog safety-report"
        role="dialog"
        aria-modal="true"
        aria-label={type === "post" ? "Report Post" : "Report User"}
      >
        {done ? (
          <>
            <h3>Report sent</h3>
            <p>
              Thanks for helping keep Impressa safe. We'll review your
              report.
            </p>

            <div className="safety-dialog-actions">
              <button
                type="button"
                className="safety-btn-confirm"
                onClick={close}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>{type === "post" ? "Report Post" : "Report User"}</h3>
            <p>Why are you reporting this?</p>

            <div className="safety-reasons">
              {REPORT_REASONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`safety-reason ${
                    reason === item.value ? "selected" : ""
                  }`}
                  onClick={() => setReason(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <textarea
              className="safety-textarea"
              placeholder="Add details (optional)"
              value={description}
              maxLength={500}
              rows={3}
              onChange={(event) => setDescription(event.target.value)}
            />

            {error && <div className="safety-error-text">{error}</div>}

            <div className="safety-dialog-actions">
              <button
                type="button"
                className="safety-btn-cancel"
                onClick={close}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="safety-btn-confirm"
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? "Sending..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ReportModal;