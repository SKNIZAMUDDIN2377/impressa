import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Help.css";

function Help() {
  const navigate = useNavigate();

  const [openSection, setOpenSection] =
    useState(null);

  const toggleSection = (section) => {
    setOpenSection(
      openSection === section
        ? null
        : section
    );
  };

  return (
    <main className="help-page">

      <div className="help-container">

        {/* =========================================
            HEADER
        ========================================= */}

        <header className="help-header">

          <button
            className="help-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>

          <div className="help-heading">

            <span>IMPRESSA</span>

            <h1>
              Help & Support
            </h1>

          </div>

          <div className="help-header-space" />

        </header>


        {/* =========================================
            SUPPORT EMAIL
        ========================================= */}

        <section className="help-contact-top">

          <div className="help-contact-top-icon">
            @
          </div>

          <div className="help-contact-top-content">

            <span>
              NEED HELP?
            </span>

            <h2>
              Contact Impressa
            </h2>

            <a
              href="mailto:contactimpressahelp@gmail.com"
            >
              contactimpressahelp@gmail.com
            </a>

          </div>

        </section>


        {/* =========================================
            HERO
        ========================================= */}

        <section className="help-hero">

          <div className="help-hero-icon">
            ?
          </div>

          <div>

            <span>
              WE'RE HERE TO HELP
            </span>

            <h2>
              How can we help?
            </h2>

            <p>
              Find answers about your Impressa
              account and features.
            </p>

          </div>

        </section>


        {/* =========================================
            QUICK HELP
        ========================================= */}

        <section className="help-section">

          <div className="help-section-heading">

            <span>
              QUICK HELP
            </span>

            <h2>
              Explore Impressa
            </h2>

          </div>


          <HelpItem
            icon="🚀"
            title="Getting Started"
            description="Learn the basics of Impressa."
            section="getting-started"
            openSection={openSection}
            toggleSection={toggleSection}
          >

            <HelpAnswer>
              Impressa is a public social platform
              where you can share moments, receive
              Impressions, comment on posts and
              discover other users.
            </HelpAnswer>

            <HelpAnswer>
              V1 includes Home, Search, Create Post,
              Pulse, Impressions, Profile, i-Notes
              and Spark.
            </HelpAnswer>

          </HelpItem>


          <HelpItem
            icon="👤"
            title="Your Account"
            description="Profile, password and account settings."
            section="account"
            openSection={openSection}
            toggleSection={toggleSection}
          >

            <HelpAnswer>
              You can edit your profile name,
              username, profile picture and bio
              from your Profile page.
            </HelpAnswer>

            <HelpAnswer>
              Account Settings contains your
              security, privacy, notification and
              account-management options.
            </HelpAnswer>

            <HelpAnswer>
              Forgot your password? See the
              Recovery Code section below.
            </HelpAnswer>

          </HelpItem>


          <HelpItem
            icon="🔑"
            title="Recovery Code"
            description="Your way back in if you forget your password."
            section="recovery-code"
            openSection={openSection}
            toggleSection={toggleSection}
          >

            <HelpAnswer>
              <strong>What is it?</strong> Your
              recovery code is a private 16-character
              code, like XXXX-XXXX-XXXX-XXXX, made
              just for your account. It proves the
              account is really yours.
            </HelpAnswer>

            <HelpAnswer>
              <strong>Why do I need it?</strong>{" "}
              Impressa doesn't send OTP messages in
              V1, so your recovery code is the only
              way to reset your password if you
              forget it. Without it, there is no way
              to get back into your account.
            </HelpAnswer>

            <HelpAnswer>
              <strong>How do I use it?</strong> On
              the Sign In page, tap Forgot password,
              enter your username, then enter your
              recovery code. After that you can
              create a new password. Your old
              password is never shown.
            </HelpAnswer>

            <HelpAnswer>
              <strong>Keep it safe.</strong> You see
              your code only once, when you create
              your account, and we can't show it
              again. Write it down or take a
              screenshot and store it somewhere
              private.
            </HelpAnswer>

            <HelpAnswer>
              <strong>Never share it.</strong> Anyone
              who has your username and recovery code
              can reset your password. Impressa will
              never ask you for it.
            </HelpAnswer>

            <HelpAnswer>
              <strong>After you use it.</strong> Each
              recovery code works once. When you
              reset your password, you get a new
              code. Save the new one, because the old
              one stops working. You'll also be
              signed out of your other devices.
            </HelpAnswer>

            <HelpAnswer>
              <strong>Don't have a code yet?</strong>{" "}
              If your account was created before
              recovery codes existed, sign in and go
              to Account Settings, then Account
              recovery, to create one. You can
              generate a new code there at any time.
              The old code stops working when you do.
            </HelpAnswer>

          </HelpItem>


          <HelpItem
            icon="📸"
            title="Posts & Content"
            description="Create and manage your posts."
            section="posts"
            openSection={openSection}
            toggleSection={toggleSection}
          >

            <HelpAnswer>
              Create Post supports images, videos
              and mixed media posts.
            </HelpAnswer>

            <HelpAnswer>
              You can prepare your media with
              editing, crop and filter options
              before publishing.
            </HelpAnswer>

          </HelpItem>


          <HelpItem
            icon="✨"
            title="Impressions"
            description="Understand the unique Impressa interaction."
            section="impressions"
            openSection={openSection}
            toggleSection={toggleSection}
          >

            <HelpAnswer>
              Impressa uses Impressions instead of
              a traditional Like button.
            </HelpAnswer>

            <HelpAnswer>
              Your Impression count contributes to
              your Impressa badge progression.
            </HelpAnswer>

          </HelpItem>


          <HelpItem
            icon="✎"
            title="i-Notes"
            description="Share public thoughts with the community."
            section="notes"
            openSection={openSection}
            toggleSection={toggleSection}
          >

            <HelpAnswer>
              i-Notes are public notes that can be
              viewed by people on Impressa.
            </HelpAnswer>

          </HelpItem>


          <HelpItem
            icon="⚡"
            title="Spark"
            description="Discover the daily Impressa challenge."
            section="spark"
            openSection={openSection}
            toggleSection={toggleSection}
          >

            <HelpAnswer>
              Spark is Impressa's challenge-based
              feature where the daily challenge
              changes over time.
            </HelpAnswer>

            <HelpAnswer>
              Spark is designed as one of the
              unique experiences of Impressa.
            </HelpAnswer>

          </HelpItem>


          <HelpItem
            icon="🏆"
            title="Badges"
            description="Learn about your Impressa progress."
            section="badges"
            openSection={openSection}
            toggleSection={toggleSection}
          >

            <HelpAnswer>
              Badges are based on Impressions.
              Posting is required to receive
              Impressions.
            </HelpAnswer>

            <HelpAnswer>
              Your badge progression is designed
              around Impressa's own achievement
              system.
            </HelpAnswer>

          </HelpItem>


          <HelpItem
            icon="🛡"
            title="Safety & Privacy"
            description="Keep control of your Impressa experience."
            section="privacy"
            openSection={openSection}
            toggleSection={toggleSection}
          >

            <HelpAnswer>
              Impressa V1 keeps all accounts public.
              Private-account functionality is
              planned for a future version.
            </HelpAnswer>

            <HelpAnswer>
              Use the Privacy page to manage the
              privacy controls currently available
              in V1.
            </HelpAnswer>

          </HelpItem>

        </section>


       


        {/* =========================================
            V1 NOTE
        ========================================= */}

        <section className="help-v1">

          <div className="help-v1-icon">
            i
          </div>

          <div>

            <strong>
              Impressa V1
            </strong>

            <p>
              Some features shown in Help are
              designed for future backend versions
              and will be connected as development
              continues.
            </p>

          </div>

        </section>


        {/* =========================================
            FOOTER
        ========================================= */}

        <p className="help-footer">
          Impressa · Rise through impressions
        </p>

      </div>

    </main>
  );
}


/* =====================================================
   HELP ITEM
===================================================== */

function HelpItem({
  icon,
  title,
  description,
  section,
  openSection,
  toggleSection,
  children,
}) {

  const isOpen =
    openSection === section;

  return (
    <div
      className={`help-item ${
        isOpen ? "open" : ""
      }`}
    >

      <button
        type="button"
        className="help-item-button"
        onClick={() =>
          toggleSection(section)
        }
      >

        <div className="help-item-icon">
          {icon}
        </div>

        <div className="help-item-text">

          <strong>
            {title}
          </strong>

          <span>
            {description}
          </span>

        </div>

        <div className="help-item-arrow">
          {isOpen ? "−" : "+"}
        </div>

      </button>


      {isOpen && (

        <div className="help-answer-box">

          {children}

        </div>

      )}

    </div>
  );
}


/* =====================================================
   ANSWER
===================================================== */

function HelpAnswer({ children }) {

  return (
    <p className="help-answer">
      {children}
    </p>
  );
}


export default Help;