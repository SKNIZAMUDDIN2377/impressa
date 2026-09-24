const express = require("express");

const {
  followUser,
  unfollowUser,
  checkFollowStatus,
} = require("../controllers/followController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// ==========================================
// CHECK FOLLOW STATUS
// ==========================================

router.get(
  "/status/:username",
  authMiddleware,
  checkFollowStatus
);


// ==========================================
// FOLLOW USER
// ==========================================

router.post(
  "/:username",
  authMiddleware,
  followUser
);


// ==========================================
// UNFOLLOW USER
// ==========================================

router.delete(
  "/:username",
  authMiddleware,
  unfollowUser
);


// ==========================================
// EXPORT
// ==========================================

module.exports = router;