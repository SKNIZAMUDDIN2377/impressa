const express = require("express");

const {
  createPost,
  getPosts,
  getPostById,
  deletePost,
  getAuthorAvatar,
  getUploadSignature,
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
// AUTHOR AVATAR (public, cacheable image)
// <img> tags cannot send an Authorization header,
// so this route has no authMiddleware.
// Declared before "/:postId" on purpose.
// ==========================================

router.get(
  "/author-avatar/:userId",
  getAuthorAvatar
);

// ==========================================
// UPLOAD SIGNATURE (direct browser -> Cloudinary uploads)
// ==========================================

router.post(
  "/upload-signature",
  authMiddleware,
  getUploadSignature
);

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
// JSON body (media already on Cloudinary) or multipart files
// ==========================================

router.post(
  "/",
  authMiddleware,
  upload.array("media", 10),
  createPost
);

// ==========================================
// DELETE POST (owner only)
// ==========================================

router.delete(
  "/:postId",
  authMiddleware,
  deletePost
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