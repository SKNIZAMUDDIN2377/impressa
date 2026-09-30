const Comment = require("../models/Comment");
const Post = require("../models/Post");
const User = require("../models/User");
const {
  getBlockedUserIds,
  isBlockedBetween,
} = require("../utils/blockUtils");
const formatComment = (comment) => ({
  id: comment._id,
  text: comment.text,
  username: comment.user?.username || "unknown",
  profilePicture: comment.user?.profilePicture || "",
  createdAt: comment.createdAt,
});

// ==========================================
// GET COMMENTS FOR A POST
// ==========================================
const getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerId = req.user.userId;

    const post = await Post.findById(postId).select("author");

    if (!post || (await isBlockedBetween(viewerId, post.author))) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Hide comments written by anyone blocked in either direction
    const hidden = await getBlockedUserIds(viewerId);
    const filter = { post: postId, user: { $nin: hidden } };

    const comments = await Comment.find(filter)
      .sort({ createdAt: 1 })
      .limit(200)
      .populate("user", "username profilePicture")
      .lean();

    const commentsCount = await Comment.countDocuments(filter);

    res.status(200).json({
      success: true,
      comments: comments.map(formatComment),
      commentsCount,
    });
  } catch (error) {
    console.error("Get comments error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while loading comments",
    });
  }
};

// ==========================================
// ADD COMMENT
// ==========================================

const addComment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { postId } = req.params;

    const text = String(req.body.text || "").trim();

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty",
      });
    }

    if (text.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Comment is too long (max 500 characters)",
      });
    }

    const post = await Post.findById(postId).select("author");

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }
  
        if (await isBlockedBetween(userId, post.author)) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }
    // Respect the post owner's "Allow comments" privacy setting
    const author = await User.findById(post.author).select("privacy");

    if (
      author?.privacy?.commentsAllowed === false &&
      String(post.author) !== String(userId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Comments are turned off for this account",
      });
    }

    const created = await Comment.create({
      post: postId,
      user: userId,
      text,
    });

    const commentsCount = await Comment.countDocuments({ post: postId });

    await Post.findByIdAndUpdate(postId, { commentsCount });

    const populated = await Comment.findById(created._id)
      .populate("user", "username profilePicture")
      .lean();

    res.status(201).json({
      success: true,
      comment: formatComment(populated),
      commentsCount,
    });
  } catch (error) {
    console.error("Add comment error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while posting comment",
    });
  }
};

// ==========================================
// DELETE COMMENT
// (comment owner, or the owner of the post)
// ==========================================

const deleteComment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { postId, commentId } = req.params;

    const comment = await Comment.findOne({
      _id: commentId,
      post: postId,
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const post = await Post.findById(postId).select("author");

    const isCommentOwner = String(comment.user) === String(userId);
    const isPostOwner = post && String(post.author) === String(userId);

    if (!isCommentOwner && !isPostOwner) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete this comment",
      });
    }

    await comment.deleteOne();

    const commentsCount = await Comment.countDocuments({ post: postId });

    await Post.findByIdAndUpdate(postId, { commentsCount });

    res.status(200).json({
      success: true,
      message: "Comment deleted",
      commentsCount,
    });
  } catch (error) {
    console.error("Delete comment error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while deleting comment",
    });
  }
};

module.exports = {
  getComments,
  addComment,
  deleteComment,
};