const User = require("../models/User");
const Post = require("../models/Post");
const {
  getBlockedUserIds,
  isBlockedBetween,
} = require("../utils/blockUtils");

// ==========================================
// V1 STAR / BADGE SYSTEM
// ==========================================

const getStarInfo = (impressionsReceived = 0) => {
  const impressions = Math.max(0, Number(impressionsReceived) || 0);

  // 100 impressions = 1 badge
  const badges = Math.floor(impressions / 100);

  let badge = "No Star";
  let star = "No Star";

  if (badges >= 15) {
    badge = "i Pro";
    star = "i Pro";
  } else if (badges >= 7) {
    badge = "Legend";
    star = "Legend";
  } else if (badges >= 5) {
    badge = "i Gold Star";
    star = "i Gold Star";
  } else if (badges >= 3) {
    badge = "i Silver Star";
    star = "i Silver Star";
  } else if (badges >= 1) {
    badge = "i Bronze Star";
    star = "i Bronze Star";
  }

  let nextStar = null;
  let nextStarImpressions = null;
  let impressionsToNextStar = 0;

  if (badges < 1) {
    nextStar = "i Bronze Star";
    nextStarImpressions = 100;
  } else if (badges < 3) {
    nextStar = "i Silver Star";
    nextStarImpressions = 300;
  } else if (badges < 5) {
    nextStar = "i Gold Star";
    nextStarImpressions = 500;
  } else if (badges < 7) {
    nextStar = "Legend";
    nextStarImpressions = 700;
  } else if (badges < 15) {
    nextStar = "i Pro";
    nextStarImpressions = 1500;
  }

  if (nextStarImpressions !== null) {
    impressionsToNextStar = Math.max(0, nextStarImpressions - impressions);
  }

  return {
    badges,
    badge,
    star,
    nextStar,
    nextStarImpressions,
    impressionsToNextStar,
  };
};

// ==========================================
// FORMAT USER PROFILE
// ==========================================

const formatProfileUser = (user, extra = {}) => {
  const starInfo = getStarInfo(user.impressionsReceived);

  const formatted = {
    id: user._id,
    name: user.name,
    username: user.username,
    bio: user.bio,
    profilePicture: user.profilePicture,

    followersCount: (user.followers || []).length,
    followingCount: (user.following || []).length,

    impressionsReceived: user.impressionsReceived || 0,

    badges: starInfo.badges,
    badge: starInfo.badge,
    star: starInfo.star,

    nextStar: starInfo.nextStar,
    nextStarImpressions: starInfo.nextStarImpressions,
    impressionsToNextStar: starInfo.impressionsToNextStar,

    isOfficial: user.isOfficial || false,
  };

  if (typeof extra.isFollowing === "boolean") {
    formatted.isFollowing = extra.isFollowing;
  }

  return formatted;
};

// ==========================================
// GET LOGGED-IN USER PROFILE
// ==========================================

const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-password -phone")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: formatProfileUser(user),
    });
  } catch (error) {
    console.error("Get my profile error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching profile",
    });
  }
};

// ==========================================
// GET PUBLIC USER PROFILE
// ==========================================

const getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({
      username: username.toLowerCase(),
    })
      .select("-password -phone")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (await isBlockedBetween(req.user.userId, user._id)) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Follow state comes back with the profile so the frontend
    // does not need a separate /api/follow/status request.
    const viewerId = String(req.user.userId);

    const isFollowing = (user.followers || []).some(
      (id) => String(id) === viewerId
    );

    res.status(200).json({
      success: true,
      user: formatProfileUser(user, { isFollowing }),
    });
  } catch (error) {
    console.error("Get user profile error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching user profile",
    });
  }
};

// ==========================================
// SEARCH USERS
// ==========================================

const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    const searchText = query?.trim() || "";

    const escapedQuery = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Fetched once here so isFollowing can be computed per result
    // without a separate follow-status request per user.
    const currentUser = await User.findById(req.user.userId)
      .select("following")
      .lean();

    const followingSet = new Set(
      (currentUser?.following || []).map((id) => id.toString())
    );

    const hiddenIds = await getBlockedUserIds(req.user.userId);

    const users = await User.find({
      _id: {
        $ne: req.user.userId,
        $nin: hiddenIds,
      },

      $or: [
        {
          username: {
            $regex: escapedQuery,
            $options: "i",
          },
        },

        {
          name: {
            $regex: escapedQuery,
            $options: "i",
          },
        },
      ],
    })
      .select(
        "name username bio profilePicture impressionsReceived isOfficial"
      )
      .lean();

    // Official account first
    users.sort((a, b) => {
      if (a.isOfficial && !b.isOfficial) {
        return -1;
      }

      if (!a.isOfficial && b.isOfficial) {
        return 1;
      }

      return 0;
    });

    const formattedUsers = users.slice(0, 50).map((user) => {
      const starInfo = getStarInfo(user.impressionsReceived);

      return {
        id: user._id,
        name: user.name,
        username: user.username,
        bio: user.bio,
        image: user.profilePicture,
        impressions: user.impressionsReceived || 0,

        badges: starInfo.badges,
        badge: starInfo.badge,
        star: starInfo.star,

        isOfficial: user.isOfficial || false,

        isFollowing: followingSet.has(user._id.toString()),
      };
    });

    res.status(200).json({
      success: true,
      count: formattedUsers.length,
      users: formattedUsers,
    });
  } catch (error) {
    console.error("Search users error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while searching users",
    });
  }
};

// ==========================================
// GET USER POSTS
// ==========================================
// ?compact=1 returns only what the profile grid needs
// (_id, first media item, createdAt). Without it the
// full post documents are returned, as before.

const getUserPosts = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({
      username: username.toLowerCase(),
    })
      .select("_id")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      req.user?.userId &&
      (await isBlockedBetween(req.user.userId, user._id))
    ) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const compact =
      req.query.compact === "1" || req.query.compact === "true";

    let query = Post.find({ author: user._id }).sort({ createdAt: -1 });

    if (compact) {
      query = query.select("_id media createdAt");
    }

    const found = await query.lean();

    const posts = compact
      ? found.map((post) => ({
          _id: post._id,
          createdAt: post.createdAt,
          media:
            Array.isArray(post.media) && post.media.length > 0
              ? [post.media[0]]
              : [],
        }))
      : found;

    res.status(200).json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error) {
    console.error("Get user posts error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching user posts",
    });
  }
};

// ==========================================
// GET USER FOLLOWERS
// ==========================================

const getUserFollowers = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({
      username: username.toLowerCase(),
    })
      .select("followers")
      .populate({
        path: "followers",
        select: "name username profilePicture bio badge",
      })
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const [blocked, hiddenIds] = await Promise.all([
      isBlockedBetween(req.user.userId, user._id),
      getBlockedUserIds(req.user.userId),
    ]);

    if (blocked) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const hidden = new Set((hiddenIds || []).map(String));

    const followers = (user.followers || [])
      .filter((f) => f && !hidden.has(String(f._id)))
      .map((follower) => ({
        id: follower._id,
        name: follower.name,
        username: follower.username,
        profilePicture: follower.profilePicture,
        bio: follower.bio,
        badge: follower.badge,
      }));

    res.status(200).json({
      success: true,
      count: followers.length,
      followers,
    });
  } catch (error) {
    console.error("Get user followers error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching followers",
    });
  }
};

// ==========================================
// GET USER FOLLOWING
// ==========================================

const getUserFollowing = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({
      username: username.toLowerCase(),
    })
      .select("following")
      .populate({
        path: "following",
        select: "name username profilePicture bio badge",
      })
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const [blocked, hiddenIds] = await Promise.all([
      isBlockedBetween(req.user.userId, user._id),
      getBlockedUserIds(req.user.userId),
    ]);

    if (blocked) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const hidden = new Set((hiddenIds || []).map(String));

    const following = (user.following || [])
      .filter((f) => f && !hidden.has(String(f._id)))
      .map((followedUser) => ({
        id: followedUser._id,
        name: followedUser.name,
        username: followedUser.username,
        profilePicture: followedUser.profilePicture,
        bio: followedUser.bio,
        badge: followedUser.badge,
      }));

    res.status(200).json({
      success: true,
      count: following.length,
      following,
    });
  } catch (error) {
    console.error("Get user following error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching following",
    });
  }
};

// ==========================================
// UPDATE LOGGED-IN USER PROFILE
// ==========================================

const updateMyProfile = async (req, res) => {
  try {
    const { name, username, bio, profilePicture } = req.body;

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update username
    if (
      username !== undefined &&
      username.trim().toLowerCase() !== user.username
    ) {
      const newUsername = username.trim().toLowerCase();

      const existingUsername = await User.findOne({
        username: newUsername,
        _id: {
          $ne: user._id,
        },
      });

      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: "Username already exists",
        });
      }

      user.username = newUsername;
    }

    // Update name
    if (name !== undefined) {
      user.name = name.trim();
    }

    // Update bio
    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    // Update profile picture
    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: formatProfileUser(user),
    });
  } catch (error) {
    console.error("Update profile error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while updating profile",
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  getMyProfile,
  getUserProfile,
  searchUsers,
  getUserPosts,
  getUserFollowers,
  getUserFollowing,
  updateMyProfile,
};