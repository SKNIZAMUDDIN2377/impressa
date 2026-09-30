const mongoose = require("mongoose");
const streamifier = require("streamifier");

const cloudinary = require("../config/cloudinary");
const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");
const Impression = require("../models/Impression");
const Notification = require("../models/Notification");
const {
  getBlockedUserIds,
  isBlockedBetween,
} = require("../utils/blockUtils");

// ==========================================
// UPLOAD FILE TO CLOUDINARY
// ==========================================

const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    let resourceType = "image";

    if (file.mimetype.startsWith("video/")) {
      resourceType = "video";
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "impressa/posts",
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    streamifier
      .createReadStream(file.buffer)
      .pipe(uploadStream);
  });
};

// ==========================================
// CLOUDINARY PUBLIC ID FROM URL
// ==========================================

const getCloudinaryPublicId = (url) => {
  try {
    if (!url || !String(url).includes("res.cloudinary.com")) {
      return null;
    }

    const match = String(url).match(
      /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/
    );

    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
};

// ==========================================
// CREATE POST
// ==========================================

const createPost = async (req, res) => {
  try {
    // Check whether media files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image or video",
      });
    }

    const { caption } = req.body;

    let music = null;

    if (req.body.music) {
      try {
        music = JSON.parse(req.body.music);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid music data",
        });
      }
    }

    // ==========================================
    // CHECK OFFICIAL ACCOUNT
    // ==========================================

    const author = await User.findById(req.user.userId);

    if (!author) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ==========================================
    // OFFICIAL POST INITIAL IMPRESSIONS
    // ==========================================

    let initialImpressions = 0;

    if (author.isOfficial === true) {
      const officialPostCount = await Post.countDocuments({
        author: author._id,
      });

      if (officialPostCount === 0) {
        initialImpressions = 120;
      } else if (officialPostCount === 1) {
        initialImpressions = 100;
      } else if (officialPostCount === 2) {
        initialImpressions = 80;
      }
    }

    // ==========================================
    // UPLOAD EVERY MEDIA FILE TO CLOUDINARY
    // ==========================================

    const uploadedMedia = await Promise.all(
      req.files.map(async (file) => {
        const cloudinaryResult =
          await uploadToCloudinary(file);

        const mediaType = file.mimetype.startsWith(
          "video/"
        )
          ? "video"
          : "image";

        return {
          url: cloudinaryResult.secure_url,
          type: mediaType,
        };
      })
    );

    // ==========================================
    // CREATE POST IN MONGODB
    // ==========================================

    const post = await Post.create({
      author: req.user.userId,

      media: uploadedMedia,

      music: music,

      caption: caption || "",

      impressionsCount: initialImpressions,

      commentsCount: 0,

      sharesCount: 0,
    });

    // ==========================================
    // GET POST WITH AUTHOR INFORMATION
    // ==========================================

    const populatedPost = await Post.findById(
      post._id
    ).populate(
      "author",
      "name username profilePicture badge isOfficial"
    );

    // ==========================================
    // SEND RESPONSE
    // ==========================================

    res.status(201).json({
      success: true,
      message: "Post created successfully 🎉",
      post: populatedPost,
    });

  } catch (error) {
    console.error(
      "Create post error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while creating post",
    });
  }
};

// ==========================================
// GET POSTS
// ==========================================

const getPosts = async (req, res) => {
  try {
    // Hide posts from users blocked in either direction
    const hidden = await getBlockedUserIds(req.user.userId);

    const posts = await Post.find({ author: { $nin: hidden } })
      .populate(
        "author",
        "name username profilePicture badge isOfficial"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error) {
    console.error("Get posts error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching posts",
    });
  }
};

// ==========================================
// GET SINGLE POST BY ID
// ==========================================

const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const post = await Post.findById(postId).populate(
      "author",
      "name username profilePicture badge isOfficial"
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (await isBlockedBetween(req.user.userId, post.author?._id)) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    res.status(200).json({
      success: true,
      post,
    });
  } catch (error) {
    console.error(
      "Get single post error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error while fetching post",
    });
  }
};

// ==========================================
// DELETE POST (owner only)
// ==========================================

const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (String(post.author) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own posts",
      });
    }

    // Remove everything attached to the post.
    // (Reports are kept on purpose: they hold their own snapshot.)
    await Promise.all([
      Comment.deleteMany({ post: post._id }),
      Impression.deleteMany({ post: post._id }),
      Notification.deleteMany({ post: post._id }),
    ]);

    await post.deleteOne();

    // Best-effort cleanup of the media stored on Cloudinary.
    // A failure here never blocks the deletion itself.
    await Promise.allSettled(
      (post.media || []).map((item) => {
        const publicId = getCloudinaryPublicId(item.url);

        if (!publicId) return Promise.resolve();

        return cloudinary.uploader.destroy(publicId, {
          resource_type: item.type === "video" ? "video" : "image",
        });
      })
    );

    res.status(200).json({
      success: true,
      message: "Post deleted",
    });
  } catch (error) {
    console.error("Delete post error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while deleting post",
    });
  }
};

// ==========================================
// EXPORT
// ==========================================

module.exports = {
  createPost,
  getPosts,
  getPostById,
  deletePost,
};