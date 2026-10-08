import { useState } from "react";
import "./RecoveryCodeCard.css";

function RecoveryCodeCard({
  code,
  confirmLabel = "I've saved my recovery code",
  actionLabel = "Continue",
  onDone,
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");

        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      alert("Couldn't copy the code. Please write it down instead.");
    }
  };

  return (
    <div className="rc-card">
      <div className="rc-code" aria-label="Your recovery code">
        {code}
      </div>

      <button
        type="button"
        className="rc-copy"
        onClick={handleCopy}
      >
        {copied ? "Copied ✓" : "Copy code"}
      </button>

      <ul className="rc-notes">
        <li>
          This is the <strong>only way</strong> to get back into your
          account if you forget your password.
        </li>
        <li>
          It is shown <strong>once</strong>. We can't show it again.
        </li>
        <li>
          Anyone with this code can reset your password, so keep it
          private. Write it down or take a screenshot.
        </li>
      </ul>

      <label className="rc-confirm">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />

        <span>{confirmLabel}</span>
      </label>

      <button
        type="button"
        className="rc-primary-btn"
        disabled={!saved}
        onClick={onDone}
      >
        <span>{actionLabel}</span>
        <span>→</span>
      </button>
    </div>
  );
}

export default RecoveryCodeCard;