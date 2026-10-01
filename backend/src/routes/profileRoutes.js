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
// MY PROFILE
// ==========================================

router.get("/me", authMiddleware, getMyProfile);

router.put("/me", authMiddleware, updateMyProfile);

// ==========================================
// SEARCH USERS
// ==========================================

router.get("/search", authMiddleware, searchUsers);

// ==========================================
// USER FOLLOWERS / FOLLOWING / POSTS
// (must be declared before "/:username")
// ==========================================

router.get("/:username/followers", authMiddleware, getUserFollowers);

router.get("/:username/following", authMiddleware, getUserFollowing);

router.get("/:username/posts", authMiddleware, getUserPosts);

// ==========================================
// PUBLIC USER PROFILE
// ==========================================

router.get("/:username", authMiddleware, getUserProfile);

// ==========================================
// EXPORT
// ==========================================

module.exports = router;