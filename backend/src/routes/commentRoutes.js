const express = require("express");

// ⚠️ Use the SAME auth middleware your other routes use
// (for example the one used by your pulse or notes routes).
const authMiddleware = require("../middleware/authMiddleware");

const {
  getComments,
  addComment,
  deleteComment,
} = require("../controllers/commentController");

const router = express.Router();

router.get("/:postId/comments", getComments);
router.post("/:postId/comments", authMiddleware, addComment);
router.delete("/:postId/comments/:commentId", authMiddleware, deleteComment);

router.get("/:postId/comments", authMiddleware, getComments);

module.exports = router;