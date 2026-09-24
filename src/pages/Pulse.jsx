import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import "./Pulse.css";

/* =====================================================
   DAILY CHALLENGES
===================================================== */

const challenges = [
  "Capture the Sky",
  "Golden Moment",
  "Something Green",
  "Your Moment",
  "Your Steps",
  "Something  Beautiful",
  "Through the Window",
  "After the Rain",
  "Look Up",
  "Your Place",
  "A Splash of Color",
  "Nature Around You",
  "On the Way",
  "Something That Shines",
  "What You're Learning",
  "Today's Food",
  "Something You Almost Missed",
  "A Moment in Time",
  "Something You Like",
  "Your Best Shot",
];

const challengeDescriptions = [
  "Take a picture of the sky above you.",
  "Capture something touched by beautiful sunlight.",
  "Find and photograph something naturally green.",
  "Capture what you're doing right now.",
  "Take a picture of your shoes or feet where you are.",
  "Photograph something you find beautiful today.",
  "Capture the view outside your window.",
  "Capture the rain or something showing its aftermath.",
  "Capture the moon or evening sky.",
  "Photograph a small part of your home or room.",
  "Find something with a strong color and capture it.",
  "Photograph something from nature around you.",
  "Capture something interesting you see while walking or travelling.",
  "Find something reflecting or producing light.",
  "Capture your study or work setup.",
  "Photograph something you're eating today.",
  "Capture a small detail people might overlook.",
  "Photograph something that represents your day.",
  "Capture something you genuinely like.",
  "Take the best picture you can today.",
];

/* =====================================================
   DAILY CHALLENGE FALLBACK
===================================================== */

function getDailyChallenge() {
  const startDate =
    new Date("2026-01-01T00:00:00");

  const today = new Date();

  const difference =
    today.getTime() -
    startDate.getTime();

  const daysPassed =
    Math.floor(
      difference /
        (1000 * 60 * 60 * 24)
    );

  return (
    daysPassed %
    challenges.length
  );
}

/* =====================================================
   PULSE
===================================================== */

function Pulse() {
  const [challengeIndex, setChallengeIndex] =
    useState(getDailyChallenge());

  const [challengeTitle, setChallengeTitle] =
    useState("");

  const [challengeDescription, setChallengeDescription] =
    useState("");

  const [myImage, setMyImage] =
    useState(null);

  const [myPulseId, setMyPulseId] =
    useState(null);

  const [followers, setFollowers] =
    useState([]);

  const [likedPosts, setLikedPosts] =
    useState([]);

  const [streak, setStreak] =
    useState(0);

  const [completedToday, setCompletedToday] =
    useState(false);

  const [showReward, setShowReward] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isUploading, setIsUploading] =
    useState(false);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =================================================
     API
  ================================================= */

  const API_URL =
    `http://${window.location.hostname}:5000`;

  const getToken = () =>
    localStorage.getItem("token");

  /* =================================================
     FETCH PULSE
  ================================================= */

  const fetchPulse = async () => {
    try {
      setIsLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        setError("Please sign in to use Pulse.");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/pulse`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load Pulse"
        );
      }

      /* ------------------------------------------
         CHALLENGE
      ------------------------------------------ */

      if (data.challenge) {
        setChallengeIndex(
          data.challenge.index
        );

        setChallengeTitle(
          data.challenge.title
        );

        setChallengeDescription(
          data.challenge.description
        );
      }

      /* ------------------------------------------
         STREAK
      ------------------------------------------ */

      setStreak(
        Number(data.streak) || 0
      );

      setCompletedToday(
        Boolean(data.completedToday)
      );

      /* ------------------------------------------
         MY PULSE
      ------------------------------------------ */

      if (data.myPulse) {
        setMyPulseId(
          data.myPulse.id
        );

        setMyImage(
          data.myPulse.image
        );
      } else {
        setMyPulseId(null);
        setMyImage(null);
      }

      /* ------------------------------------------
         FOLLOWER PULSES
      ------------------------------------------ */

      setFollowers(
        Array.isArray(data.followerPulses)
          ? data.followerPulses
          : []
      );
    } catch (err) {
      console.error(
        "Fetch Pulse error:",
        err
      );

      setError(
        err.message ||
          "Unable to connect to Impressa server."
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* =================================================
     LOAD PULSE
  ================================================= */

  useEffect(() => {
    fetchPulse();
  }, []);

  /* =================================================
     DAILY CHALLENGE CHECK
  ================================================= */

  useEffect(() => {
    const updateChallenge = () => {
      setChallengeIndex(
        getDailyChallenge()
      );
    };

    const timer =
      setInterval(
        updateChallenge,
        60 * 1000
      );

    return () =>
      clearInterval(timer);
  }, []);

  /* =================================================
     STREAK CALCULATIONS
  ================================================= */

  const streakProgress =
    Math.min(
      100,
      (streak / 7) * 100
    );

  const daysRemaining =
    Math.max(
      0,
      7 - streak
    );

  const streakDays =
    useMemo(
      () =>
        Array.from(
          { length: 7 },
          (_, index) =>
            index <
            Math.min(streak, 7)
        ),
      [streak]
    );

  /* =================================================
     FILE TO BASE64
  ================================================= */

  const fileToBase64 = (
    file
  ) => {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onload = () =>
          resolve(
            reader.result
          );

        reader.onerror =
          () =>
            reject(
              new Error(
                "Unable to read image"
              )
            );

        reader.readAsDataURL(file);
      }
    );
  };

  /* =================================================
     UPLOAD
  ================================================= */

  const handleUpload = async (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      alert(
        "Please select an image."
      );

      return;
    }

    const token = getToken();

    if (!token) {
      alert(
        "Please sign in first."
      );

      return;
    }

    try {
      setIsUploading(true);
      setError("");

      /* ------------------------------------------
         CONVERT IMAGE
      ------------------------------------------ */

      const image =
        await fileToBase64(
          file
        );

      /* ------------------------------------------
         CREATE PULSE
      ------------------------------------------ */

      const response =
        await fetch(
          `${API_URL}/api/pulse`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              image,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to create Pulse"
        );
      }

      /* ------------------------------------------
         UPDATE MY PULSE
      ------------------------------------------ */

      if (data.pulse) {
        setMyPulseId(
          data.pulse.id
        );

        setMyImage(
          data.pulse.image
        );
      }

      /* ------------------------------------------
         UPDATE STREAK
      ------------------------------------------ */

      if (
        data.streak !== undefined
      ) {
        const previousStreak =
          streak;

        const newStreak =
          Number(data.streak);

        setStreak(
          newStreak
        );

        setCompletedToday(
          true
        );

        if (
          previousStreak < 7 &&
          newStreak >= 7
        ) {
          setTimeout(() => {
            setShowReward(true);
          }, 500);
        }
      } else {
        setCompletedToday(
          true
        );
      }

      /* ------------------------------------------
         REFRESH PULSE DATA
      ------------------------------------------ */

      await fetchPulse();
    } catch (err) {
      console.error(
        "Upload Pulse error:",
        err
      );

      alert(
        err.message ||
          "Unable to upload Pulse."
      );
    } finally {
      setIsUploading(false);

      event.target.value = "";
    }
  };

  /* =================================================
     DELETE IMAGE
  ================================================= */

  const deleteMyImage =
    async () => {
      if (!myPulseId) {
        setMyImage(null);
        return;
      }

      const token = getToken();

      if (!token) {
        alert(
          "Please sign in first."
        );

        return;
      }

      try {
        setIsDeleting(true);

        const response =
          await fetch(
            `${API_URL}/api/pulse/${myPulseId}`,
            {
              method: "DELETE",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to delete Pulse"
          );
        }

        setMyImage(null);
        setMyPulseId(null);

        /*
          Refresh backend state after deletion.
        */

        await fetchPulse();
      } catch (err) {
        console.error(
          "Delete Pulse error:",
          err
        );

        alert(
          err.message ||
            "Unable to delete Pulse."
        );
      } finally {
        setIsDeleting(false);
      }
    };

  /* =================================================
     IMPRESS PULSE
  ================================================= */

  const toggleLike =
    async (id) => {
      const token =
        getToken();

      if (!token) {
        alert(
          "Please sign in first."
        );

        return;
      }

      /*
        Find current follower pulse.
      */

      const currentPulse =
        followers.find(
          (pulse) =>
            pulse.id === id
        );

      if (!currentPulse) {
        return;
      }

      /*
        Optimistic UI update.
      */

      setLikedPosts(
        (previous) => {
          if (
            previous.includes(id)
          ) {
            return previous.filter(
              (pulseId) =>
                pulseId !== id
            );
          }

          return [
            ...previous,
            id,
          ];
        }
      );

      try {
        const response =
          await fetch(
            `${API_URL}/api/pulse/${id}/impress`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to impress Pulse"
          );
        }

        /*
          Keep the server as the
          source of truth.
        */

        setFollowers(
          (previous) =>
            previous.map(
              (pulse) =>
                pulse.id === id
                  ? {
                      ...pulse,
                      impressed:
                        data.impressed,
                      impressionsCount:
                        data.impressionsCount,
                    }
                  : pulse
            )
        );

        setLikedPosts(
          (previous) => {
            if (
              data.impressed
            ) {
              return previous.includes(
                id
              )
                ? previous
                : [
                    ...previous,
                    id,
                  ];
            }

            return previous.filter(
              (pulseId) =>
                pulseId !== id
            );
          }
        );
      } catch (err) {
        console.error(
          "Impress Pulse error:",
          err
        );

        /*
          Revert optimistic update.
        */

        setLikedPosts(
          (previous) => {
            if (
              currentPulse.impressed
            ) {
              return previous.includes(
                id
              )
                ? previous
                : [
                    ...previous,
                    id,
                  ];
            }

            return previous.filter(
              (pulseId) =>
                pulseId !== id
            );
          }
        );

        alert(
          err.message ||
            "Unable to impress Pulse."
        );
      }
    };

  /* =================================================
     REWARD CLOSE
  ================================================= */

  const closeReward = () => {
    setShowReward(false);
  };

  /* =================================================
     LOADING
  ================================================= */

  if (isLoading) {
    return (
      <div className="pulse-page">
        <div
          style={{
            textAlign: "center",
            paddingTop: "100px",
            color: "#999",
            fontSize: "13px",
          }}
        >
          Loading Pulse...
        </div>
      </div>
    );
  }

  /* =================================================
     RETURN
  ================================================= */

  return (
    <div className="pulse-page">

      {/* =============================================
          HEADER
      ============================================= */}

      <header className="pulse-header">

        <span className="pulse-small-title">
          i-pulse
        </span>

        <div className="pulse-title-row">

          <div>

            <h1>
              Challenge
            </h1>

            <p>
              One challenge.
              One moment.
              Every 24 hours.
            </p>

          </div>

          <div className="pulse-fire">
            🔥
          </div>

        </div>

      </header>


      {/* =============================================
          ERROR
      ============================================= */}

      {error && (
        <div
          style={{
            marginBottom: "15px",
            padding: "12px",
            textAlign: "center",
            color: "#d9534f",
            fontSize: "12px",
            borderRadius: "10px",
            background: "#fff5f5",
          }}
        >
          {error}
        </div>
      )}


      {/* =============================================
          7 DAY STREAK
      ============================================= */}

      <section className="streak-card">

        <div className="streak-top">

          <div>

            <span className="streak-eyebrow">
              PULSE STREAK
            </span>

            <h2>
              {streak}

              <span>
                / 7 DAYS
              </span>
            </h2>

          </div>

          <div className="streak-fire">
            🔥
          </div>

        </div>


        {/* DAY INDICATORS */}

        <div className="streak-days">

          {streakDays.map(
            (completed, index) => (

              <div
                className={
                  completed
                    ? "streak-day completed"
                    : "streak-day"
                }
                key={index}
              >

                <div className="day-circle">

                  {completed
                    ? index === 6
                      ? "★"
                      : "✓"
                    : index + 1}

                </div>

                <span>
                  Day {index + 1}
                </span>

              </div>

            )
          )}

        </div>


        {/* PROGRESS */}

        <div className="streak-progress">

          <div className="streak-progress-track">

            <div
              className="streak-progress-fill"
              style={{
                width:
                  `${streakProgress}%`,
              }}
            />

          </div>

          <span>
            {Math.round(
              streakProgress
            )}
            %
          </span>

        </div>


        {/* STREAK MESSAGE */}

        <div className="streak-message">

          {streak >= 7 ? (

            <>
              <strong>
                🔥 7-Day Streak Unlocked
              </strong>

              <span>
                You completed the full
                Pulse challenge.
              </span>
            </>

          ) : (

            <>
              <strong>
                {daysRemaining} more{" "}
                {daysRemaining === 1
                  ? "day"
                  : "days"}{" "}
                to unlock
              </strong>

              <span>
                🔥 Pulse Streak
              </span>
            </>

          )}

        </div>

      </section>


      {/* =============================================
          TODAY'S CHALLENGE
      ============================================= */}

      <section className="today-challenge">

        <div className="challenge-label">
          TODAY'S CHALLENGE
        </div>

        <div className="challenge-number">

          CHALLENGE #
          {challengeIndex + 1}

        </div>

        <h2>
          {challengeTitle ||
            challenges[challengeIndex]}
        </h2>

        <p>
          {challengeDescription ||
            challengeDescriptions[
              challengeIndex
            ]}
        </p>

        <div className="challenge-timer">

          <span>
            ⏱
          </span>

          Active for 24 hours

        </div>

      </section>


      {/* =============================================
          MY PULSE
      ============================================= */}

      <section className="my-pulse-section">

        <div className="section-heading">

          <div>

            <span className="section-eyebrow">
              YOUR PULSE
            </span>

            <h2>
              Your Moment
            </h2>

          </div>

          <div className="my-pulse-avatar">
            👤
          </div>

        </div>


        {myImage ? (

          <div className="my-image-container">

            <img
              src={myImage}
              alt="My challenge"
            />

            <div className="image-overlay">

              <span>
                Today's Pulse
              </span>

              <button
                className="delete-image-button"
                onClick={
                  deleteMyImage
                }
                disabled={
                  isDeleting
                }
                title="Delete image"
              >
                {isDeleting
                  ? "..."
                  : "🗑"}
              </button>

            </div>

          </div>

        ) : (

          <label className="empty-upload">

            <div className="upload-icon">
              📷
            </div>

            <strong>
              {isUploading
                ? "Uploading..."
                : completedToday
                  ? "Pulse completed"
                  : "Upload your challenge"}
            </strong>

            <span>
              Share this moment with
              your followers
            </span>

            <small>
              {isUploading
                ? "Please wait..."
                : "Tap anywhere to choose"}
            </small>

            <input
              type="file"
              accept="image/*"
              onChange={
                handleUpload
              }
              disabled={
                isUploading ||
                completedToday
              }
            />

          </label>

        )}

      </section>


      {/* =============================================
          YOUR PEOPLE
      ============================================= */}

      <section className="followers-section">

        <div className="section-title">

          <div>

            <span className="section-eyebrow">
              FOLLOWERS
            </span>

            <h2>
              Your People
            </h2>

          </div>

          <span className="today-label">
            Today's Pulse
          </span>

        </div>


        <div className="pulse-feed">

          {followers.length === 0 ? (

            <div
              style={{
                textAlign: "center",
                padding: "35px 15px",
                color: "#999",
                fontSize: "12px",
              }}
            >
              No active Pulses from your followers yet.
            </div>

          ) : (

            followers.map(
              (person) => {

                const isLiked =
                  person.impressed ||
                  likedPosts.includes(
                    person.id
                  );

                return (

                  <article
                    className="pulse-card"
                    key={person.id}
                  >

                    <div className="pulse-user">

                      <div className="small-avatar">

                        {person.user
                          ?.profilePicture ? (

                          <img
                            src={
                              person.user
                                .profilePicture
                            }
                            alt={
                              person.user
                                .username
                            }
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit:
                                "cover",
                              borderRadius:
                                "50%",
                            }}
                          />

                        ) : (
                          "👤"
                        )}

                      </div>

                      <strong>
                        @
                        {
                          person.user
                            ?.username
                        }
                      </strong>

                    </div>


                    <div className="follower-image">

                      <img
                        src={
                          person.image
                        }
                        alt={`${
                          person.user
                            ?.username
                        }'s challenge`}
                      />

                    </div>


                    <div className="pulse-like-row">

                      <button
                        className={
                          isLiked
                            ? "like-button liked"
                            : "like-button"
                        }
                        onClick={() =>
                          toggleLike(
                            person.id
                          )
                        }
                        aria-label="Impress"
                      >

                        {isLiked
                          ? "♥"
                          : "♡"}

                      </button>

                      <span>
                        Impress
                      </span>

                    </div>

                  </article>

                );
              }
            )

          )}

        </div>

      </section>


      {/* =============================================
          7 DAY REWARD
      ============================================= */}

      {showReward && (

        <div className="reward-overlay">

          <div className="reward-card">

            <button
              className="reward-close"
              onClick={
                closeReward
              }
            >
              ×
            </button>


            <div className="reward-burst">

              <span>✦</span>
              <span>✦</span>
              <span>✦</span>
              <span>✦</span>
              <span>✦</span>

            </div>


            <div className="reward-star">
              ★
            </div>


            <span className="reward-eyebrow">
              PULSE REWARD
            </span>


            <h2>
              7 DAYS.
              <br />
              YOU DID IT.
            </h2>


            <p>
              You've completed a full
              seven-day Pulse streak.
            </p>


            <div className="reward-badge">

              🔥

              <span>
                Pulse Streak
              </span>

            </div>


            <button
              className="reward-button"
              onClick={
                closeReward
              }
            >
              Continue
            </button>

          </div>

        </div>

      )}

    </div>
  );
}

export default Pulse;