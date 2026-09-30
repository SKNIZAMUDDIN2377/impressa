const mongoose = require("mongoose");

const Report = require("../models/Report");
const User = require("../models/User");
const Post = require("../models/Post");
const { isBlockedBetween } = require("../utils/blockUtils");

const getMyId = (req) => req.user && req.user.userId;

const DAILY_LIMIT = 20;

const validateBody = (body) => {
  const reason = String(body.reason || "").trim();

  if (!Report.REASONS.includes(reason)) {
    return { error: "Please choose a valid reason" };
  }

  const description = String(body.description || "").trim().slice(0, 500);

  return { reason, description };
};

const overDailyLimit = async (reporterId) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const count = await Report.countDocuments({
    reporter: reporterId,
    createdAt: { $gte: since },
  });

  return count >= DAILY_LIMIT;
};

// ==========================================
// REPORT USER
// POST /api/reports/user/:username
// ==========================================

const reportUser = async (req, res) => {
  try {
    const me = getMyId(req);

    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { reason, description, error } = validateBody(req.body || {});

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const target = await User.findOne({
      username: String(req.params.username || "").trim().toLowerCase(),
    }).select("_id");

    if (!target || (await isBlockedBetween(me, target._id))) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (String(target._id) === String(me)) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot report yourself" });
    }

    // Repeat report of the same open case: accept quietly, store nothing new
    const existing = await Report.exists({
      reporter: me,
      targetType: "user",
      reportedUser: target._id,
      status: "pending",
    });

    if (!existing) {
      if (await overDailyLimit(me)) {
        return res.status(429).json({
          success: false,
          message: "Too many reports today. Please try again later.",
        });
      }

      await Report.create({
        targetType: "user",
        reporter: me,
        reportedUser: target._id,
        reason,
        description,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Thanks for your report. We'll review it.",
    });
  } catch (error) {
    console.error("reportUser error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to submit report" });
  }
};

// ==========================================
// REPORT POST
// POST /api/reports/post/:postId
// ==========================================

const reportPost = async (req, res) => {
  try {
    const me = getMyId(req);

    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const { reason, description, error } = validateBody(req.body || {});

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const post = await Post.findById(req.params.postId).lean();

    if (!post || (await isBlockedBetween(me, post.author))) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (String(post.author) === String(me)) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot report your own post" });
    }

    const existing = await Report.exists({
      reporter: me,
      targetType: "post",
      post: post._id,
      status: "pending",
    });

    if (!existing) {
      if (await overDailyLimit(me)) {
        return res.status(429).json({
          success: false,
          message: "Too many reports today. Please try again later.",
        });
      }

      await Report.create({
        targetType: "post",
        reporter: me,
        reportedUser: post.author,
        post: post._id,
        postSnapshot: {
          caption: post.caption || "",
          mediaUrls: (post.media || []).map((m) => m.url),
        },
        reason,
        description,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Thanks for your report. We'll review it.",
    });
  } catch (error) {
    console.error("reportPost error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to submit report" });
  }
};

module.exports = { reportUser, reportPost };