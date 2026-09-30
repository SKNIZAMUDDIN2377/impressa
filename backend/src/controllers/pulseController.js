const Pulse = require("../models/Pulse");
const User = require("../models/User");
const {
  getBlockedUserIds,
  isBlockedBetween,
} = require("../utils/blockUtils");

// ==========================================
// DAILY CHALLENGES
// ==========================================

const DAILY_CHALLENGES = [
  { title: "Show your morning", description: "Capture a moment from your morning." },
  { title: "Something you love", description: "Share something that makes you happy." },
  { title: "Your current vibe", description: "Show everyone your vibe today." },
  { title: "A little detail", description: "Capture a small detail people might miss." },
  { title: "Something blue", description: "Find and capture something blue." },
  { title: "Your workspace", description: "Show where you create and work." },
  { title: "Look around", description: "Capture something interesting around you." },
  { title: "A peaceful moment", description: "Share a moment that feels peaceful." },
  { title: "Something you created", description: "Show something you made or created." },
  { title: "Your favorite place", description: "Capture a place you enjoy being in." },
  { title: "A candid moment", description: "Capture something natural and unplanned." },
  { title: "Your current view", description: "Show us what you can see right now." },
  { title: "Something colorful", description: "Find something colorful and capture it." },
  { title: "A moment worth remembering", description: "Capture something you want to remember." },
  { title: "Keep it simple", description: "Share one simple moment from today." },
  { title: "Your style today", description: "Show your style today." },
  { title: "Something inspiring", description: "Share something that inspires you." },
  { title: "Life right now", description: "Capture what life looks like right now." },
  { title: "Behind the scenes", description: "Show a little behind-the-scenes moment." },
  { title: "Make an impression", description: "Share a moment you want people to remember." },
  { title: "Your choice", description: "Post anything that represents your day." },
];

// ==========================================
// GET TODAY'S CHALLENGE
// ==========================================

const getTodayChallenge = () => {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const today = new Date();
  const difference = today.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(difference / oneDay);
  const challengeIndex = dayOfYear % DAILY_CHALLENGES.length;

  return {
    challengeIndex,
    ...DAILY_CHALLENGES[challengeIndex],
  };
};

// ==========================================
// GET DATE KEY
// ==========================================

const getDateKey = (date = new Date()) => {
  return date.toISOString().split("T")[0];
};

// ==========================================
// CALCULATE PULSE STREAK
// ==========================================

const calculatePulseStreak = (completedDates = []) => {
  if (!completedDates.length) {
    return 0;
  }

  const uniqueDates = [...new Set(completedDates)];
  const dateSet = new Set(uniqueDates);

  let streak = 0;
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const todayKey = getDateKey(currentDate);

  if (!dateSet.has(todayKey)) {
    return 0;
  }

  while (true) {
    const dateKey = getDateKey(currentDate);

    if (!dateSet.has(dateKey)) {
      break;
    }

    streak += 1;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
};

// ==========================================
// GET PULSE
// ==========================================

const getPulse = async (req, res) => {
  try {
    const userId = req.user.userId;

    const challenge = getTodayChallenge();

    const user = await User.findById(userId).select(
      "followers following pulseCompletedDates"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const todayKey = getDateKey();

    const completedToday =
      user.pulseCompletedDates?.includes(todayKey) || false;

    const streak = calculatePulseStreak(
      user.pulseCompletedDates || []
    );

    const myPulse = await Pulse.findOne({
      user: userId,
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "name username profilePicture badge")
      .lean();

    // ==========================================
    // BLOCK FILTER (both directions)
    // ==========================================

    const hiddenSet = new Set(
      (await getBlockedUserIds(userId)).map(String)
    );

    const visibleFollowers = (user.followers || []).filter(
      (id) => !hiddenSet.has(String(id))
    );

    const followerPulses = await Pulse.find({
      user: { $in: visibleFollowers },
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "name username profilePicture badge")
      .sort({ createdAt: -1 })
      .lean();

    const pulses = followerPulses
      .filter((pulse) => pulse.user)
      .map((pulse) => ({
        id: pulse._id,
        user: {
          id: pulse.user._id,
          name: pulse.user.name,
          username: pulse.user.username,
          profilePicture: pulse.user.profilePicture,
          badge: pulse.user.badge,
        },
        image: pulse.image,
        challengeIndex: pulse.challengeIndex,
        challengeTitle: pulse.challengeTitle,
        challengeDescription: pulse.challengeDescription,
        impressionsCount: pulse.impressionsCount,
        createdAt: pulse.createdAt,
        expiresAt: pulse.expiresAt,
        impressed:
          pulse.impressedBy?.some(
            (id) => id.toString() === userId.toString()
          ) || false,
      }));

    res.status(200).json({
      success: true,
      challenge: {
        index: challenge.challengeIndex,
        title: challenge.title,
        description: challenge.description,
      },
      streak,
      completedToday,
      myPulse: myPulse
        ? {
            id: myPulse._id,
            image: myPulse.image,
            challengeIndex: myPulse.challengeIndex,
            challengeTitle: myPulse.challengeTitle,
            challengeDescription: myPulse.challengeDescription,
            impressionsCount: myPulse.impressionsCount,
            createdAt: myPulse.createdAt,
            expiresAt: myPulse.expiresAt,
          }
        : null,
      followerPulses: pulses,
    });
  } catch (error) {
    console.error("Get Pulse error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching Pulse",
    });
  }
};

// ==========================================
// CREATE PULSE
// ==========================================

const createPulse = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Pulse image is required",
      });
    }

    const challenge = getTodayChallenge();

    const existingPulse = await Pulse.findOne({
      user: userId,
      expiresAt: { $gt: new Date() },
    });

    if (existingPulse) {
      return res.status(409).json({
        success: false,
        message: "You have already completed today's Pulse",
        pulse: existingPulse,
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const completionDate = getDateKey(now);

    const pulse = await Pulse.create({
      user: userId,
      challengeIndex: challenge.challengeIndex,
      challengeTitle: challenge.title,
      challengeDescription: challenge.description,
      image,
      impressionsCount: 0,
      impressedBy: [],
      createdAt: now,
      expiresAt,
      completionDate,
    });

    const user = await User.findById(userId);

    if (!user) {
      await pulse.deleteOne();

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.pulseCompletedDates.includes(completionDate)) {
      user.pulseCompletedDates.push(completionDate);

      if (user.pulseCompletedDates.length > 60) {
        user.pulseCompletedDates =
          user.pulseCompletedDates.slice(-60);
      }

      await user.save();
    }

    const streak = calculatePulseStreak(user.pulseCompletedDates);

    const populatedPulse = await Pulse.findById(pulse._id)
      .populate("user", "name username profilePicture badge")
      .lean();

    res.status(201).json({
      success: true,
      message: "Pulse created successfully",
      streak,
      completedToday: true,
      pulse: {
        id: populatedPulse._id,
        image: populatedPulse.image,
        challengeIndex: populatedPulse.challengeIndex,
        challengeTitle: populatedPulse.challengeTitle,
        challengeDescription: populatedPulse.challengeDescription,
        impressionsCount: populatedPulse.impressionsCount,
        createdAt: populatedPulse.createdAt,
        expiresAt: populatedPulse.expiresAt,
      },
    });
  } catch (error) {
    console.error("Create Pulse error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while creating Pulse",
    });
  }
};

// ==========================================
// DELETE MY PULSE
// ==========================================

const deletePulse = async (req, res) => {
  try {
    const userId = req.user.userId;

    const pulse = await Pulse.findOne({
      _id: req.params.pulseId,
      user: userId,
    });

    if (!pulse) {
      return res.status(404).json({
        success: false,
        message: "Pulse not found",
      });
    }

    // Remember which date this Pulse belonged to BEFORE deleting it,
    // so we can free that date up again below.
    const completionDate = pulse.completionDate;

    await pulse.deleteOne();

    // ------------------------------------------
    // ALLOW RE-POSTING TODAY
    // ------------------------------------------
    //
    // Without this, the user stays permanently marked as having
    // "completed" this date in pulseCompletedDates even after
    // deleting their Pulse — silently blocking every future repost
    // for that day. Removing the date here restores the ability to
    // upload a new Pulse for today.

    if (completionDate) {
      const user = await User.findById(userId);

      if (user) {
        user.pulseCompletedDates = (
          user.pulseCompletedDates || []
        ).filter((date) => date !== completionDate);

        await user.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Pulse deleted successfully",
    });
  } catch (error) {
    console.error("Delete Pulse error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while deleting Pulse",
    });
  }
};

// ==========================================
// IMPRESS PULSE
// ==========================================

const impressPulse = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { pulseId } = req.params;

    const pulse = await Pulse.findOne({
      _id: pulseId,
      expiresAt: { $gt: new Date() },
    });

    if (!pulse) {
      return res.status(404).json({
        success: false,
        message: "Pulse not found or has expired",
      });
    }

    // Blocked in either direction: treat as if the Pulse doesn't exist
    if (await isBlockedBetween(userId, pulse.user)) {
      return res.status(404).json({
        success: false,
        message: "Pulse not found or has expired",
      });
    }

    if (pulse.user.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot impress your own Pulse",
      });
    }

    const alreadyImpressed = pulse.impressedBy.some(
      (id) => id.toString() === userId.toString()
    );

    if (alreadyImpressed) {
      pulse.impressedBy = pulse.impressedBy.filter(
        (id) => id.toString() !== userId.toString()
      );

      pulse.impressionsCount = Math.max(
        0,
        pulse.impressionsCount - 1
      );

      await pulse.save();

      return res.status(200).json({
        success: true,
        impressed: false,
        impressionsCount: pulse.impressionsCount,
      });
    }

    pulse.impressedBy.push(userId);
    pulse.impressionsCount += 1;

    await pulse.save();

    res.status(200).json({
      success: true,
      impressed: true,
      impressionsCount: pulse.impressionsCount,
    });
  } catch (error) {
    console.error("Impress Pulse error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while impressing Pulse",
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  getPulse,
  createPulse,
  deletePulse,
  impressPulse,
};