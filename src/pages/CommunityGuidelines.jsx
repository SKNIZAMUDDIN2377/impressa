import { useNavigate } from "react-router-dom";

import "../styles/safety.css";

const RULES = [
  {
    title: "Be respectful",
    text: "Do not harass, bully, shame or target other people, whether in posts, comments, i-Notes or profiles.",
  },
  {
    title: "No threats or violence",
    text: "Do not threaten, encourage or glorify violence or harm against any person or group.",
  },
  {
    title: "No hate or abusive content",
    text: "Do not attack people based on race, ethnicity, nationality, religion, gender, sexual orientation, disability or similar characteristics.",
  },
  {
    title: "No sexual or explicit content",
    text: "Do not post nudity, sexually explicit material or sexually suggestive content.",
  },
  {
    title: "Protect minors",
    text: "Any content that sexualizes, exploits or endangers children is strictly prohibited and will be removed immediately.",
  },
  {
    title: "No illegal content",
    text: "Do not use Impressa to promote, sell or facilitate illegal activity.",
  },
  {
    title: "No impersonation",
    text: "Do not pretend to be another person, brand or organization, or mislead others about who you are.",
  },
  {
    title: "No spam",
    text: "Do not post repetitive, deceptive or unsolicited content, fake engagement, scams or misleading links.",
  },
  {
    title: "Respect copyright",
    text: "Only share photos, videos, music and other content that you own or have the right to share.",
  },
  {
    title: "No malicious or harmful content",
    text: "Do not share malware, phishing links or anything designed to damage devices, steal information or harm others.",
  },
];

function CommunityGuidelines() {
  const navigate = useNavigate();

  return (
    <div className="safety-page">
      <div className="safety-header">
        <button
          type="button"
          className="safety-back"
                   onClick={() =>
            window.history.length > 1 ? navigate(-1) : navigate("/")
          }
          aria-label="Go back"
        >
          ←
        </button>

        <h1>Community Guidelines</h1>
      </div>

      <p className="safety-intro">
        Impressa is a place to share real moments and make a good
        impression. To keep it safe and welcoming for everyone, these
        rules apply to all accounts and content.
      </p>

      {RULES.map((rule) => (
        <div className="safety-rule" key={rule.title}>
          <h3>{rule.title}</h3>
          <p>{rule.text}</p>
        </div>
      ))}

      <div className="safety-rule">
        <h3>What happens if rules are broken</h3>

        <p>
          Impressa may remove content that violates these guidelines,
          restrict features on an account, suspend an account, or remove
          an account permanently where appropriate. The action taken
          depends on how serious the violation is and whether it has
          happened before.
        </p>
      </div>

      <div className="safety-rule">
        <h3>Help keep Impressa safe</h3>

        <p>
          If you see a profile or post that breaks these rules, use
          Report User or Report Post. If someone bothers you, you can
          block them at any time from their profile. Blocked accounts
          cannot find or interact with you.
        </p>
      </div>
    </div>
  );
}

export default CommunityGuidelines;