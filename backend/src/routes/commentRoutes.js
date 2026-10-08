const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
  getComments,
  addComment,
  deleteComment,
} = require("../controllers/commentController");

const router = express.Router();

// Mounted at /api/posts in server.js, so these become:
//   GET    /api/posts/:postId/comments
//   POST   /api/posts/:postId/comments
//   DELETE /api/posts/:postId/comments/:commentId

router.get("/:postId/comments", authMiddleware, getComments);

router.post("/:postId/comments", authMiddleware, addComment);

router.delete(
  "/:postId/comments/:commentId",
  authMiddleware,
  deleteComment
);

module.exports = router;