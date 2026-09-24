const Comment = require("../models/Comment");
const Post = require("../models/Post");
const User = require("../models/User");

// ==========================================
// CREATE COMMENT
// ==========================================

const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const author = await User.findById(req.user.userId);

    if (!author) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Respect owner's comment privacy setting
    const postOwner = await User.findById(post.author);

    if (
      postOwner &&
      postOwner.privacy &&
      postOwner.privacy.commentsAllowed === false &&
      post.author.toString() !== req.user.userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Comments are disabled for this post",
      });
    }

    const comment = await Comment.create({
      post: postId,
      author: req.user.userId,
      text: text.trim(),
    });

    post.commentsCount =
      (post.commentsCount || 0) + 1;

    await post.save();

    const populatedComment =
      await Comment.findById(comment._id).populate(
        "author",
        "name username profilePicture badge isOfficial"
      );

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: populatedComment,
    });
  } catch (error) {
    console.error(
      "Create comment error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error while creating comment",
    });
  }
};

// ==========================================
// GET COMMENTS FOR POST
// ==========================================

const getComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const comments = await Comment.find({
      post: postId,
    })
      .populate(
        "author",
        "name username profilePicture badge isOfficial"
      )
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error(
      "Get comments error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error while fetching comments",
    });
  }
};

// ==========================================
// DELETE COMMENT
// ==========================================

const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(
      commentId
    );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Only the comment author can delete it
    if (
      comment.author.toString() !==
      req.user.userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only delete your own comments",
      });
    }

    await Comment.findByIdAndDelete(commentId);

    const post = await Post.findById(
      comment.post
    );

    if (post) {
      post.commentsCount = Math.max(
        0,
        (post.commentsCount || 0) - 1
      );

      await post.save();
    }

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete comment error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error while deleting comment",
    });
  }
};

module.exports = {
  createComment,
  getComments,
  deleteComment,
};