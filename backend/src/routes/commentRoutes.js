const express = require("express");

const {
  createComment,
  getComments,
  deleteComment,
} = require("../controllers/commentController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ==========================================
// GET COMMENTS FOR A POST
// ==========================================

router.get(
  "/:postId",
  authMiddleware,
  getComments
);

// ==========================================
// CREATE COMMENT
// ==========================================

router.post(
  "/:postId",
  authMiddleware,
  createComment
);

// ==========================================
// DELETE COMMENT
// ==========================================

router.delete(
  "/:commentId",
  authMiddleware,
  deleteComment
);

module.exports = router;