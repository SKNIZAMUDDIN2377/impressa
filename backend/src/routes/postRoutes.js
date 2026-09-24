const express = require("express");

const {
  createPost,
  getPosts,
  getPostById,
} = require("../controllers/postController");

const {
  giveImpression,
  removeImpression,
  checkImpression,
} = require("../controllers/impressionController");

const authMiddleware = require("../middleware/authMiddleware");

const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// ==========================================
// GET ALL POSTS
// ==========================================

router.get(
  "/",
  authMiddleware,
  getPosts
);

// ==========================================
// GET SINGLE POST
// ==========================================

router.get(
  "/:postId",
  authMiddleware,
  getPostById
);

// ==========================================
// CREATE POST
// ==========================================

router.post(
  "/",
  authMiddleware,
  upload.array("media", 10),
  createPost
);

// ==========================================
// GIVE IMPRESSION
// ==========================================

router.post(
  "/:postId/impression",
  authMiddleware,
  giveImpression
);

// ==========================================
// REMOVE IMPRESSION
// ==========================================

router.delete(
  "/:postId/impression",
  authMiddleware,
  removeImpression
);

// ==========================================
// CHECK IMPRESSION
// ==========================================

router.get(
  "/:postId/impression",
  authMiddleware,
  checkImpression
);

module.exports = router;