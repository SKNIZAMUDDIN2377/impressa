import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCache, setCache } from "../utils/impressaCache";
import "./Pulse.css";

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

function Pulse() {
  const token = localStorage.getItem("token");

  const pulseCacheKey = token
    ? `pulse_data_${token}`
    : "pulse_data";

  const initialCache = getCache(pulseCacheKey);

  const hadCacheRef = useRef(
    Boolean(initialCache)
  );

  const requestIdRef = useRef(0);

  const [challengeIndex, setChallengeIndex] =
    useState(
      initialCache?.challengeIndex ??
        getDailyChallenge()
    );

  const [challengeTitle, setChallengeTitle] =
    useState(initialCache?.challengeTitle || "");

  const [challengeDescription, setChallengeDescription] =
    useState(initialCache?.challengeDescription || "");

  const [myImage, setMyImage] =
    useState(initialCache?.myImage ?? null);

  const [myPulseId, setMyPulseId] =
    useState(initialCache?.myPulseId ?? null);

  const [followers, setFollowers] =
    useState(initialCache?.followers || []);

  const [likedPosts, setLikedPosts] =
    useState([]);

  const [streak, setStreak] =
    useState(initialCache?.streak ?? 0);

  const [completedToday, setCompletedToday] =
    useState(initialCache?.completedToday ?? false);

  const [showReward, setShowReward] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(!hadCacheRef.current);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [isUploading, setIsUploading] =
    useState(false);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [error, setError] =
    useState("");

 const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

  const getToken = () =>
    localStorage.getItem("token");

  const fetchPulse = async () => {
    const requestId = ++requestIdRef.current;

    try {
      if (hadCacheRef.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError("");

      const token = getToken();

      if (!token) {
        if (requestId === requestIdRef.current) {
          setError("Please sign in to use Pulse.");
        }
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

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load Pulse"
        );
      }

      let nextChallengeIndex = challengeIndex;
      let nextChallengeTitle = challengeTitle;
      let nextChallengeDescription = challengeDescription;

      if (data.challenge) {
        nextChallengeIndex = data.challenge.index;
        nextChallengeTitle = data.challenge.title;
        nextChallengeDescription = data.challenge.description;

        setChallengeIndex(nextChallengeIndex);
        setChallengeTitle(nextChallengeTitle);
        setChallengeDescription(nextChallengeDescription);
      }

      const nextStreak = Number(data.streak) || 0;
      const nextCompletedToday = Boolean(data.completedToday);

      setStreak(nextStreak);
      setCompletedToday(nextCompletedToday);

      let nextMyPulseId = null;
      let nextMyImage = null;

      if (data.myPulse) {
        nextMyPulseId = data.myPulse.id;
        nextMyImage = data.myPulse.image;
      }

      setMyPulseId(nextMyPulseId);
      setMyImage(nextMyImage);

      const nextFollowers = Array.isArray(data.followerPulses)
        ? data.followerPulses
        : [];

      setFollowers(nextFollowers);

      hadCacheRef.current = true;

      setCache(pulseCacheKey, {
        challengeIndex: nextChallengeIndex,
        challengeTitle: nextChallengeTitle,
        challengeDescription: nextChallengeDescription,
        streak: nextStreak,
        completedToday: nextCompletedToday,
        myPulseId: nextMyPulseId,
        myImage: nextMyImage,
        followers: nextFollowers,
      });
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      console.error(
        "Fetch Pulse error:",
        err
      );

      if (!getCache(pulseCacheKey)) {
        setError(
          err.message ||
            "Unable to connect to Impressa server."
        );
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchPulse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // FIX: this was `index > Math.min(streak, 7)`, which inverted
  // completed/incomplete days. Completed days must be index < streak.
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

      const image =
        await fileToBase64(
          file
        );

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

      if (data.pulse) {
        setMyPulseId(
          data.pulse.id
        );

        setMyImage(
          data.pulse.image
        );
      }

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

      const currentPulse =
        followers.find(
          (pulse) =>
            pulse.id === id
        );

      if (!currentPulse) {
        return;
      }

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

        setFollowers(
          (previous) => {
            const updated = previous.map(
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
            );

            setCache(pulseCacheKey, {
              ...(getCache(pulseCacheKey) || {}),
              followers: updated,
            });

            return updated;
          }
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

  const closeReward = () => {
    setShowReward(false);
  };

  if (isLoading) {
    return (
      <div className="pulse-page">

        <header className="pulse-header">
          <span className="pulse-small-title">
            i-pulse
          </span>

          <div className="pulse-title-row">
            <div>
              <h1>Challenge</h1>
              <p>
                One challenge. One moment.
                Every 24 hours.
              </p>
            </div>

            <div className="pulse-fire">🔥</div>
          </div>
        </header>

        <div className="pulse-skeleton streak-skeleton" />
        <div className="pulse-skeleton challenge-skeleton" />
        <div className="pulse-skeleton upload-skeleton" />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div className="pulse-skeleton card-skeleton" />
          <div className="pulse-skeleton card-skeleton" />
        </div>

      </div>
    );
  }

  return (
    <div className="pulse-page">

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

          <div className="pulse-fire-orbit">
            <span className="pulse-fire-ring" />
            <span className="pulse-fire-ring pulse-fire-ring-2" />
            <div className="pulse-fire">🔥</div>
          </div>

        </div>

      </header>

      {error && (
        <div className="pulse-error-banner">
          {error}
        </div>
      )}

      <section className="streak-card reveal" style={{ animationDelay: "0.05s" }}>

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
                style={{ animationDelay: `${index * 0.06}s` }}
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

      <section className="today-challenge reveal" style={{ animationDelay: "0.12s" }}>

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

      <section className="my-pulse-section reveal" style={{ animationDelay: "0.18s" }}>

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

            <div className="upload-icon-wrap">
              <span className="upload-ping" />
              <div className="upload-icon">
                📷
              </div>
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

      <section className="followers-section reveal" style={{ animationDelay: "0.24s" }}>

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

            <div className="pulse-feed-empty">
              No active Pulses from your followers yet.
            </div>

          ) : (

            followers.map(
              (person, index) => {

                const isLiked =
                  person.impressed ||
                  likedPosts.includes(
                    person.id
                  );

                return (

                  <article
                    className="pulse-card"
                    key={person.id}
                    style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                  >

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

                    </div>

                  </article>

                );
              }
            )

          )}

        </div>

      </section>

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