const User = require("../models/User");
const Notification = require("../models/Notification");

// ==========================================
// FOLLOW USER
// ==========================================

const followUser = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { username } = req.params;

    const currentUser = await User.findById(currentUserId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "Current user not found",
      });
    }

    const targetUser = await User.findOne({
      username: username.toLowerCase(),
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ==========================================
    // CANNOT FOLLOW YOURSELF
    // ==========================================

    if (
      currentUser._id.toString() ===
      targetUser._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself",
      });
    }

    // ==========================================
    // CHECK EXISTING RELATIONSHIP
    // ==========================================

    const alreadyFollowing =
      currentUser.following.some(
        (id) =>
          id.toString() ===
          targetUser._id.toString()
      );

    const alreadyFollower =
      targetUser.followers.some(
        (id) =>
          id.toString() ===
          currentUser._id.toString()
      );

    // ==========================================
    // ALREADY FOLLOWING
    // ==========================================

    if (
      alreadyFollowing &&
      alreadyFollower
    ) {
      return res.status(200).json({
        success: true,
        message: "Already following this user",
        following: true,
        followersCount:
          targetUser.followers.length,
        followingCount:
          currentUser.following.length,
      });
    }

    // ==========================================
    // ADD FOLLOW RELATIONSHIP
    // ==========================================

    // Remove any old duplicate IDs first
    currentUser.following =
      currentUser.following.filter(
        (id) =>
          id.toString() !==
          targetUser._id.toString()
      );

    targetUser.followers =
      targetUser.followers.filter(
        (id) =>
          id.toString() !==
          currentUser._id.toString()
      );

    // Add exactly one relationship
    currentUser.following.push(
      targetUser._id
    );

    targetUser.followers.push(
      currentUser._id
    );

    await currentUser.save();
    await targetUser.save();

    // ==========================================
    // FOLLOW NOTIFICATION
    // ==========================================

    if (
      targetUser.notifications?.followers !==
      false
    ) {
      await Notification.create({
        recipient: targetUser._id,
        sender: currentUser._id,
        type: "follow",
        message: `@${currentUser.username} started following you`,
      });
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    res.status(200).json({
      success: true,
      message: "User followed successfully",
      following: true,
      followersCount:
        targetUser.followers.length,
      followingCount:
        currentUser.following.length,
    });

  } catch (error) {
    console.error(
      "Follow user error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while following user",
    });
  }
};


// ==========================================
// UNFOLLOW USER
// ==========================================

const unfollowUser = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { username } = req.params;

    const currentUser = await User.findById(
      currentUserId
    );

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "Current user not found",
      });
    }

    const targetUser = await User.findOne({
      username: username.toLowerCase(),
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ==========================================
    // CANNOT UNFOLLOW YOURSELF
    // ==========================================

    if (
      currentUser._id.toString() ===
      targetUser._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid follow relationship",
      });
    }

    // ==========================================
    // REMOVE ALL MATCHING IDs
    // ==========================================

    currentUser.following =
      currentUser.following.filter(
        (id) =>
          id.toString() !==
          targetUser._id.toString()
      );

    targetUser.followers =
      targetUser.followers.filter(
        (id) =>
          id.toString() !==
          currentUser._id.toString()
      );

    await currentUser.save();
    await targetUser.save();

    // ==========================================
    // NO NOTIFICATION ON UNFOLLOW
    // ==========================================

    res.status(200).json({
      success: true,
      message: "User unfollowed successfully",
      following: false,
      followersCount:
        targetUser.followers.length,
      followingCount:
        currentUser.following.length,
    });

  } catch (error) {
    console.error(
      "Unfollow user error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while unfollowing user",
    });
  }
};


// ==========================================
// CHECK FOLLOW STATUS
// ==========================================

const checkFollowStatus = async (
  req,
  res
) => {
  try {
    const currentUserId =
      req.user.userId;

    const { username } =
      req.params;

    const currentUser =
      await User.findById(
        currentUserId
      );

    const targetUser =
      await User.findOne({
        username:
          username.toLowerCase(),
      });

    if (
      !currentUser ||
      !targetUser
    ) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const following =
      currentUser.following.some(
        (id) =>
          id.toString() ===
          targetUser._id.toString()
      );

    res.status(200).json({
      success: true,
      following,
    });

  } catch (error) {
    console.error(
      "Check follow status error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while checking follow status",
    });
  }
};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  followUser,
  unfollowUser,
  checkFollowStatus,
};