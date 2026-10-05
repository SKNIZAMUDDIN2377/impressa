const Notification = require("../models/Notification");
const User = require("../models/User");
const Post = require("../models/Post");

// ==========================================
// MESSAGES (edit freely)
// ==========================================

const IMPRESSION_MILESTONES = [
  { at: 1, type: "spark", message: "You got your first impression 🎉 Someone noticed your post. Keep going!" },
  { at: 10, type: "spark", message: "10 impressions! People are noticing you. Post again to keep it going." },
  { at: 50, type: "spark", message: "50 impressions 🙌 Your posts are making an impression." },
  { at: 100, type: "milestone", message: "You reached 100 impressions 🎉 Keep sharing to unlock your next badge." },
  { at: 500, type: "milestone", message: "500 impressions! You're becoming a familiar face on Impressa." },
];

const POST_NUDGES = [
  "Share something today. Even a small moment can make an impression.",
  "Your followers would love to see what you're up to. Post something new.",
  "A photo, a view, a moment. Post something today and see who notices.",
];

const PULSE_NUDGE =
  "Today's Pulse is live. Join the 24-hour challenge before it ends.";

const WELCOME =
  "Welcome to Impressa 👋 Start by posting your first photo and following a few people.";

const PULSE_STREAKS = {
  3: "3-day Pulse streak 🔥 Keep it going!",
  7: "7-day Pulse streak! A whole week of showing up.",
  30: "30-day Pulse streak 🏆 That's real commitment.",
};

// ==========================================
// HELPERS
// ==========================================

// Same format the Pulse controller uses for pulseCompletedDates
const getDateKey = (date = new Date()) => date.toISOString().split("T")[0];

const dayOfYear = () => {
  const start = new Date(new Date().getFullYear(), 0, 0);
  return Math.floor((Date.now() - start.getTime()) / 86400000);
};

// Creates one Impressa notification. Never throws.
// Returns true only if a NEW notification was created.
const sendMotivation = async (userId, { key, type = "spark", message }) => {
  try {
    const user = await User.findById(userId).select("notifications").lean();

    if (!user) return false;

    // Users can switch these off in their notification settings
    if (user.notifications && user.notifications.spark === false) {
      return false;
    }

    await Notification.create({
      recipient: userId,
      sender: null,
      type,
      message,
      key,
    });

    return true;
  } catch (error) {
    // 11000 = already sent before (expected, not an error)
    if (error.code !== 11000) {
      console.error("sendMotivation error ❌", error);
    }
    return false;
  }
};

// ==========================================
// ACHIEVEMENTS
// ==========================================

// Call after a user's impression count increases.
// Sends only the highest milestone reached, once.
const checkImpressionMilestones = async (userId) => {
  try {
    const user = await User.findById(userId).select("impressionsReceived").lean();

    if (!user) return;

    const total = Number(user.impressionsReceived || 0);

    const reached = IMPRESSION_MILESTONES.filter((m) => total >= m.at).pop();

    if (!reached) return;

    await sendMotivation(userId, {
      key: `impressions-${reached.at}`,
      type: reached.type,
      message: reached.message,
    });
  } catch (error) {
    console.error("checkImpressionMilestones error ❌", error);
  }
};

// Call after a post is created
const onPostCreated = async (userId) => {
  try {
    const count = await Post.countDocuments({ author: userId });

    if (count === 1) {
      await sendMotivation(userId, {
        key: "first-post",
        message: "Your first post is live 🎉 Now follow a few people so they can find you.",
      });
    } else if (count === 10) {
      await sendMotivation(userId, {
        key: "posts-10",
        message: "10 posts! You're building your impression trail.",
      });
    }
  } catch (error) {
    console.error("onPostCreated error ❌", error);
  }
};

// Call after a Pulse is created (pass the streak you already calculated)
const onPulseCompleted = async (userId, streak) => {
  try {
    await sendMotivation(userId, {
      key: "pulse-first",
      type: "pulse",
      message: "You completed your first Pulse ✨ Come back tomorrow for a new challenge.",
    });

    if (PULSE_STREAKS[streak]) {
      await sendMotivation(userId, {
        key: `pulse-streak-${streak}`,
        type: "pulse",
        message: PULSE_STREAKS[streak],
      });
    }
  } catch (error) {
    console.error("onPulseCompleted error ❌", error);
  }
};

// ==========================================
// DAILY NUDGE (max one per user per day)
// ==========================================

// Skips users checked in the last 10 minutes, so frequent
// unread-count polling does not hit the database every time.
const lastChecked = new Map();
const CHECK_EVERY_MS = 10 * 60 * 1000;

const maybeSendDailyNudge = async (userId) => {
  try {
    const id = String(userId);
    const last = lastChecked.get(id) || 0;

    if (Date.now() - last < CHECK_EVERY_MS) return;

    lastChecked.set(id, Date.now());

    const user = await User.findById(userId)
      .select("createdAt pulseCompletedDates")
      .lean();

    if (!user) return;

    const ageMs = Date.now() - new Date(user.createdAt).getTime();

    // New accounts get a one-time welcome, and no nudge on the same visit
    if (ageMs < 7 * 86400000) {
      const sentWelcome = await sendMotivation(userId, {
        key: "welcome",
        message: WELCOME,
      });

      if (sentWelcome) return;
    }

    const todayKey = getDateKey();

    const postedRecently = await Post.exists({
      author: userId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (!postedRecently) {
      await sendMotivation(userId, {
        key: `nudge-${todayKey}`,
        message: POST_NUDGES[dayOfYear() % POST_NUDGES.length],
      });
      return;
    }

    const pulseDoneToday = (user.pulseCompletedDates || []).includes(todayKey);

    if (!pulseDoneToday) {
      await sendMotivation(userId, {
        key: `nudge-${todayKey}`,
        type: "pulse",
        message: PULSE_NUDGE,
      });
    }
  } catch (error) {
    console.error("maybeSendDailyNudge error ❌", error);
  }
};

module.exports = {
  sendMotivation,
  checkImpressionMilestones,
  onPostCreated,
  onPulseCompleted,
  maybeSendDailyNudge,
};