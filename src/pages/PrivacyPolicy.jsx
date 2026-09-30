import { Link, useNavigate } from "react-router-dom";

import "../styles/safety.css";

const CONTACT_EMAIL = "contactimpressahelp@gmail.com";

const LAST_UPDATED = "30 September 2026";

const SECTIONS = [
  {
    title: "1. Information you give us",
    items: [
      "Account details: your name, username and phone number when you create an account. Your phone number is used for your account and sign-in and is not shown on your public profile.",
      "Password: stored only in hashed form. We cannot read it.",
      "Profile details: your bio and profile picture.",
    ],
  },
  {
    title: "2. Content you create",
    items: [
      "Posts: photos, videos, captions and the music you choose to attach.",
      "Comments and impressions you give to posts.",
      "i-Notes you publish on your profile.",
      "Pulse photos, which expire automatically after 24 hours.",
    ],
  },
  {
    title: "3. Activity and relationships",
    items: [
      "Who you follow and who follows you.",
      "Accounts you block and reports you submit.",
      "Notifications created when people interact with you, such as impressions, comments and new followers.",
      "Your privacy and notification settings.",
    ],
  },
  {
    title: "4. Information stored on your device",
    paragraphs: [
      "Impressa stores a sign-in token (valid for 7 days), the accounts you added to Account Center on this device, cached profile, feed and search data so the app loads faster, and your theme preference. This stays on your device. Some of it is removed when you log out or delete your account, and you can clear the rest from your device settings.",
    ],
  },
  {
    title: "5. What we do not collect",
    paragraphs: [
      "Impressa does not collect your precise location or your contacts, and does not use advertising or analytics trackers.",
    ],
  },
  {
    title: "6. How we use information",
    items: [
      "To create and run your account and show your profile, posts and activity.",
      "To deliver in-app notifications.",
      "To keep Impressa safe: handling blocks and reports, enforcing the Community Guidelines and preventing abuse.",
      "To respond to support requests.",
    ],
  },
  {
    title: "7. What other people can see",
    paragraphs: [
      "All Impressa accounts are public in this version. Other users can see your name, username, bio, profile picture, follower and following counts, impressions, badge, posts, comments and i-Notes. Your Pulse is visible temporarily while it is active.",
      "Your phone number and password are never shown to other users. People you have blocked, and people who have blocked you, cannot find or interact with your account.",
    ],
  },
  {
    title: "8. Service providers",
    paragraphs: [
      "We use trusted providers to run Impressa: MongoDB Atlas stores our database, Cloudinary stores and delivers post photos and videos, and cloud hosting runs our servers. Music previews attached to posts are streamed from a third-party music service. These providers process data only to provide their service to us.",
      "We do not sell your personal information and we do not share it for advertising. We may disclose information if required by law or to protect the safety of users.",
    ],
  },
  {
    title: "9. Blocking and reporting",
    paragraphs: [
      "When you block an account, neither of you can find or interact with the other on Impressa. You can unblock at any time from Blocked Accounts.",
      "When you report a user or post, we store who reported, the reported account, the reason, any details you add, a copy of the reported post's caption and media links, and the time of the report. We use this to review content against our Community Guidelines. We do not tell the reported user who reported them. Reports are kept even if either account is later deleted, so we can still act on abuse.",
    ],
  },
  {
    title: "10. Retention and deletion",
    paragraphs: [
      "We keep your information while your account exists. You can delete individual posts from your profile at any time.",
      "To delete your account, go to Profile, open the menu, choose Account Settings and then Delete account. This permanently deletes your profile, posts and their photos and videos, comments, impressions, Pulses, i-Notes, notifications, blocks and follow relationships. Reports about abuse are kept as described above. Backup copies may remain for a limited time before they are overwritten.",
    ],
    link: { to: "/delete-account-info", label: "How to delete your account" },
  },
  {
    title: "11. Security",
    paragraphs: [
      "We protect your data with measures such as hashed passwords and encrypted connections (HTTPS). No system is completely secure, so please choose a strong password and keep it private.",
    ],
  },
  {
    title: "12. Children",
    paragraphs: [
      "Impressa is not intended for children under 13. If we learn that an account belongs to a child under 13, we will remove it.",
    ],
  },
  {
    title: "13. Your choices",
    items: [
      "Edit your profile details from your profile page.",
      "Change privacy and notification settings in Privacy and Notifications.",
      "Block or report accounts and posts from their menus.",
      "Delete your account from Account Settings.",
    ],
  },
  {
    title: "14. Changes to this policy",
    paragraphs: [
      "We may update this policy as Impressa changes. The date at the top shows when it was last updated. Continuing to use Impressa after an update means you accept the new version.",
    ],
  },
];

function PrivacyPolicy() {
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

        <h1>Privacy Policy</h1>
      </div>

      <p className="safety-updated">Last updated: {LAST_UPDATED}</p>

      <p className="safety-intro">
        This policy explains what information Impressa collects, how it is
        used and the choices you have. By creating an account you agree to
        it.
      </p>

      {SECTIONS.map((section) => (
        <div className="safety-rule" key={section.title}>
          <h3>{section.title}</h3>

          {section.paragraphs?.map((text) => (
            <p key={text} style={{ marginBottom: "8px" }}>
              {text}
            </p>
          ))}

          {section.items && (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          {section.link && (
            <p style={{ marginTop: "8px" }}>
              <Link to={section.link.to}>{section.link.label}</Link>
            </p>
          )}
        </div>
      ))}

      <div className="safety-rule">
        <h3>15. Contact us</h3>

        <p>
          Questions about this policy or your data? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </div>
  );
}

export default PrivacyPolicy;