const Impression = require("../models/Impression");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");

// ==========================================
// GIVE IMPRESSION
// ==========================================

const giveImpression = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Prevent duplicate impression
    const existingImpression =
      await Impression.findOne({
        post: postId,
        user: userId,
      });

    if (existingImpression) {
      return res.status(409).json({
        success: false,
        message:
          "You already gave an impression to this post",
        impressed: true,
        impressions: post.impressionsCount,
      });
    }

    // Create impression
    await Impression.create({
      post: postId,
      user: userId,
    });

    // Increase post impression count
    post.impressionsCount += 1;
    await post.save();

    // Get post owner
    const author = await User.findById(post.author);

    // ==========================================
    // UPDATE POST OWNER TOTAL IMPRESSIONS
    // ==========================================

    if (author) {
      author.impressionsReceived =
        (author.impressionsReceived || 0) + 1;

      await author.save();
    }

    // ==========================================
    // CREATE NOTIFICATION
    // ==========================================

    // Don't notify someone when they impress
    // their own post.
    if (
      author &&
      author._id.toString() !== userId.toString()
    ) {
      const actor = await User.findById(userId).select(
        "name username profilePicture badge isOfficial"
      );

      // Respect notification settings
      if (
        author.notifications?.impressions !== false &&
        actor
      ) {
        await Notification.create({
          recipient: author._id,
          sender: actor._id,
          type: "impression",
          post: post._id,
          message: `@${actor.username} impressed your post`,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Impression added",
      impressed: true,
      impressions: post.impressionsCount,
    });
  } catch (error) {
    console.error(
      "Give impression error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while giving impression",
    });
  }
};

// ==========================================
// REMOVE IMPRESSION
// ==========================================

const removeImpression = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    const impression =
      await Impression.findOneAndDelete({
        post: postId,
        user: userId,
      });

    if (!impression) {
      return res.status(404).json({
        success: false,
        message: "Impression not found",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Decrease post impression count
    post.impressionsCount = Math.max(
      0,
      post.impressionsCount - 1
    );

    await post.save();

    // ==========================================
    // UPDATE POST OWNER TOTAL IMPRESSIONS
    // ==========================================

    const author = await User.findById(post.author);

    if (author) {
      author.impressionsReceived = Math.max(
        0,
        (author.impressionsReceived || 0) - 1
      );

      await author.save();
    }

    // We intentionally DON'T create a notification
    // when an impression is removed.

    res.status(200).json({
      success: true,
      message: "Impression removed",
      impressed: false,
      impressions: post.impressionsCount,
    });
  } catch (error) {
    console.error(
      "Remove impression error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while removing impression",
    });
  }
};

// ==========================================
// CHECK USER IMPRESSION
// ==========================================

const checkImpression = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    const impression =
      await Impression.findOne({
        post: postId,
        user: userId,
      });

    res.status(200).json({
      success: true,
      impressed: Boolean(impression),
    });
  } catch (error) {
    console.error(
      "Check impression error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while checking impression",
    });
  }
};

module.exports = {
  giveImpression,
  removeImpression,
  checkImpression,
};