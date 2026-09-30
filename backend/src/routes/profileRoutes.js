const express = require("express");

const {
  getMyProfile,
  getUserProfile,
  getUserPosts,
  getUserFollowers,
  getUserFollowing,
  updateMyProfile,
  searchUsers,
} = require("../controllers/profileController");

const authMiddleware = require("../middleware/authMiddleware");


const router = express.Router();

// ==========================================
// GET MY PROFILE
// ==========================================

router.get(
  "/me",
  authMiddleware,
  getMyProfile
);

// ==========================================
// UPDATE MY PROFILE
// ==========================================

router.put(
  "/me",
  authMiddleware,
  updateMyProfile
);

// ==========================================
// SEARCH USERS
// ==========================================

router.get(
  "/search",
  authMiddleware,
  searchUsers
);

// ==========================================
// GET USER FOLLOWERS
// ==========================================

router.get(
  "/:username/followers",
  getUserFollowers
);

// ==========================================
// GET USER FOLLOWING
// ==========================================

router.get(
  "/:username/following",
  getUserFollowing
);

// ==========================================
// GET USER POSTS
// ==========================================

router.get(
  "/:username/posts",
  getUserPosts
);

// ==========================================
// GET PUBLIC USER PROFILE
// ==========================================

router.get(
  "/:username",
  getUserProfile
);

// ==========================================
// EXPORT
// ==========================================
router.get("/:username/followers", authMiddleware, getUserFollowers);

router.get("/:username/following", authMiddleware, getUserFollowing);

router.get("/:username/posts", authMiddleware, getUserPosts);

router.get("/:username", authMiddleware, getUserProfile);
module.exports = router;