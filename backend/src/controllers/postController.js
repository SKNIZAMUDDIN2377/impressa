const mongoose = require("mongoose");
const crypto = require("crypto");
const streamifier = require("streamifier");

const cloudinary = require("../config/cloudinary");
const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");
const Impression = require("../models/Impression");
const Notification = require("../models/Notification");
const { onPostCreated } = require("../utils/motivation");
const {
  getBlockedUserIds,
  isBlockedBetween,
} = require("../utils/blockUtils");

const UPLOAD_FOLDER = "impressa/posts";
const MAX_MEDIA_PER_POST = 10;

// ==========================================
// UPLOAD FILE TO CLOUDINARY (legacy multipart path)
// ==========================================

const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    let resourceType = "image";

    if (file.mimetype.startsWith("video/")) {
      resourceType = "video";
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: UPLOAD_FOLDER,
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
// CREATE-POST HELPERS
// ==========================================

// Music arrives as a JSON string (multipart) or an object (JSON body)
const parseMusic = (raw) => {
  if (raw === undefined || raw === null || raw === "") {
    return { music: null };
  }

  let value = raw;

  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch (error) {
      return { error: true };
    }
  }

  if (!value || typeof value !== "object") {
    return { music: null };
  }

  const idNumber = Number(value.id);

  return {
    music: {
      id: Number.isFinite(idNumber) ? idNumber : null,
      title: String(value.title || "").slice(0, 120),
      artist: String(value.artist || "").slice(0, 120),
      audioUrl: String(value.audioUrl || "").slice(0, 500),
    },
  };
};

// Validates media that the browser already uploaded to Cloudinary.
// Only URLs on OUR Cloudinary account, inside our post folder, are accepted.
const normalizeClientMedia = (rawList) => {
  if (
    !Array.isArray(rawList) ||
    rawList.length === 0 ||
    rawList.length > MAX_MEDIA_PER_POST
  ) {
    return null;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!cloudName) return null;

  const prefix = `https://res.cloudinary.com/${cloudName}/`;

  const result = [];

  for (const item of rawList) {
    const url = typeof item?.url === "string" ? item.url : "";

    const type =
      item?.type === "video"
        ? "video"
        : item?.type === "image"
        ? "image"
        : null;

    if (
      !type ||
      !url.startsWith(prefix) ||
      !url.includes(`/${type}/upload/`) ||
      !url.includes(`/${UPLOAD_FOLDER}/`)
    ) {
      return null;
    }

    const entry = { url, type };

    const width = Number(item.width);
    const height = Number(item.height);

    if (width > 0 && height > 0 && width <= 20000 && height <= 20000) {
      entry.width = Math.round(width);
      entry.height = Math.round(height);
    }

    result.push(entry);
  }

  return result;
};

// ==========================================
// UPLOAD SIGNATURE (browser uploads straight to Cloudinary)
// ==========================================

const getUploadSignature = async (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({
        success: false,
        message: "Media uploads are not configured on the server",
      });
    }

    const timestamp = Math.round(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: UPLOAD_FOLDER },
      apiSecret
    );

    res.status(200).json({
      success: true,
      cloudName,
      apiKey,
      timestamp,
      folder: UPLOAD_FOLDER,
      signature,
    });
  } catch (error) {
    console.error("Upload signature error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while preparing upload",
    });
  }
};

// ==========================================
// FEED HELPERS
// ==========================================

const FEED_DEFAULT_LIMIT = 10;
const FEED_MAX_LIMIT = 20;

// Profile pictures saved as base64 data URLs are huge. Instead of
// sending them inside every feed post, the feed sends a short URL
// that the browser downloads once and caches.
const parseInlineAvatar = (value) => {
  if (typeof value !== "string" || !value.startsWith("data:")) {
    return null;
  }

  const commaIndex = value.indexOf(",");

  if (commaIndex === -1) return null;

  const header = value.slice(0, commaIndex);

  const match = header.match(
    /^data:(image\/(?:jpeg|png|webp|gif));base64$/i
  );

  if (!match) return null;

  return {
    mime: match[1].toLowerCase(),
    base64: value.slice(commaIndex + 1),
  };
};

const getFeedAvatarUrl = (author) => {
  const picture = author?.profilePicture;

  if (!picture) return "";

  if (typeof picture === "string" && picture.startsWith("data:")) {
    if (!parseInlineAvatar(picture)) {
      // Unsupported inline format: keep the original value
      return picture;
    }

    const version = crypto
      .createHash("md5")
      .update(picture)
      .digest("hex")
      .slice(0, 10);

    return `/api/posts/author-avatar/${author._id}?v=${version}`;
  }

  return picture;
};

const parseFeedCursor = (raw) => {
  if (!raw || typeof raw !== "string") return null;

  const [time, id] = raw.split("_");

  const ms = Number(time);

  if (!Number.isFinite(ms) || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return { date: new Date(ms), id };
};

const makeFeedCursor = (post) =>
  `${new Date(post.createdAt).getTime()}_${post._id}`;

// Which of these posts has the current user already impressed?
// Returns null when the Impression model's field names cannot be
// determined, in which case the frontend falls back to its own check.
const IMPRESSION_USER_FIELDS = [
  "user",
  "userId",
  "impressedBy",
  "author",
  "giver",
];

const getImpressedPostIds = async (userId, postIds) => {
  try {
    if (!Impression.schema.path("post")) return null;

    const userField = IMPRESSION_USER_FIELDS.find((field) =>
      Impression.schema.path(field)
    );

    if (!userField || postIds.length === 0) return null;

    const rows = await Impression.find({
      post: { $in: postIds },
      [userField]: userId,
    })
      .select("post")
      .lean();

    return new Set(rows.map((row) => String(row.post)));
  } catch (error) {
    console.error("Feed impression lookup error ❌", error);
    return null;
  }
};

// ==========================================
// CREATE POST
// ==========================================
// Two ways in:
//  1) JSON body { media: [{url,type,width,height}], caption, music }
//     media was already uploaded by the browser straight to Cloudinary
//  2) multipart files (legacy path, still supported)

const createPost = async (req, res) => {
  try {
    const hasFiles = Array.isArray(req.files) && req.files.length > 0;

    let clientMedia = null;

    if (!hasFiles) {
      clientMedia = normalizeClientMedia(req.body?.media);

      if (!clientMedia) {
        return res.status(400).json({
          success: false,
          message: "Please upload an image or video",
        });
      }
    }

    const caption = String(req.body?.caption || "").slice(0, 500);

    const parsedMusic = parseMusic(req.body?.music);

    if (parsedMusic.error) {
      return res.status(400).json({
        success: false,
        message: "Invalid music data",
      });
    }

    const music = parsedMusic.music;

    // ==========================================
    // CHECK OFFICIAL ACCOUNT
    // ==========================================

    const author = await User.findById(req.user.userId)
      .select("_id isOfficial")
      .lean();

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
    // MEDIA
    // ==========================================

    let uploadedMedia = clientMedia;

    if (hasFiles) {
      uploadedMedia = await Promise.all(
        req.files.map(async (file) => {
          const cloudinaryResult = await uploadToCloudinary(file);

          return {
            url: cloudinaryResult.secure_url,
            type: file.mimetype.startsWith("video/")
              ? "video"
              : "image",
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
          };
        })
      );
    }

    // ==========================================
    // CREATE POST IN MONGODB
    // ==========================================

    const post = await Post.create({
      author: req.user.userId,

      media: uploadedMedia,

      music: music,

      caption: caption,

      impressionsCount: initialImpressions,

      commentsCount: 0,

      sharesCount: 0,
    });
        onPostCreated(req.user.userId);

    // ==========================================
    // GET POST WITH AUTHOR INFORMATION
    // ==========================================

    const populatedPost = await Post.findById(
      post._id
    ).populate(
      "author",
      "name username profilePicture badge isOfficial"
    );

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
// With ?limit=N  -> paginated "feed" response (newest first):
//   { posts, hasMore, nextCursor }  pass nextCursor back as ?cursor=
// Without limit  -> original behavior (every post), unchanged.

const getPosts = async (req, res) => {
  try {
    // Hide posts from users blocked in either direction
    const hidden = await getBlockedUserIds(req.user.userId);

    const feedMode = req.query.limit !== undefined;

    // ---------- original behavior ----------
    if (!feedMode) {
      const posts = await Post.find({ author: { $nin: hidden } })
        .populate(
          "author",
          "name username profilePicture badge isOfficial"
        )
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count: posts.length,
        posts,
      });
    }

    // ---------- paginated feed ----------
    const requestedLimit = parseInt(req.query.limit, 10);

    const limit = Math.min(
      FEED_MAX_LIMIT,
      Math.max(
        1,
        Number.isFinite(requestedLimit)
          ? requestedLimit
          : FEED_DEFAULT_LIMIT
      )
    );

    const filter = { author: { $nin: hidden } };

    const cursor = parseFeedCursor(req.query.cursor);

    if (cursor) {
      filter.$or = [
        { createdAt: { $lt: cursor.date } },
        { createdAt: cursor.date, _id: { $lt: cursor.id } },
      ];
    }

    const rows = await Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate(
        "author",
        "name username profilePicture badge isOfficial"
      )
      .lean();

    const hasMore = rows.length > limit;

    const page = hasMore ? rows.slice(0, limit) : rows;

    const impressedIds = await getImpressedPostIds(
      req.user.userId,
      page.map((post) => post._id)
    );

    const posts = page.map((post) => {
      const item = {
        ...post,
        author: post.author
          ? {
              _id: post.author._id,
              name: post.author.name,
              username: post.author.username,
              badge: post.author.badge,
              isOfficial: post.author.isOfficial,
              profilePicture: getFeedAvatarUrl(post.author),
            }
          : post.author,
      };

      if (impressedIds) {
        item.impressed = impressedIds.has(String(post._id));
      }

      return item;
    });

    res.status(200).json({
      success: true,
      count: posts.length,
      posts,
      hasMore,
      nextCursor:
        hasMore && page.length > 0
          ? makeFeedCursor(page[page.length - 1])
          : null,
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
// AUTHOR AVATAR (public image endpoint)
// ==========================================
// Serves a base64-stored profile picture as a real image with
// long-lived caching. The ?v= hash in the URL changes whenever the
// picture changes, so the cache is always correct.

const getAuthorAvatar = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).end();
    }

    const user = await User.findById(userId)
      .select("profilePicture")
      .lean();

    const picture = user?.profilePicture;

    if (!picture) {
      return res.status(404).end();
    }

    const inline = parseInlineAvatar(picture);

    if (!inline) {
      if (/^https?:\/\//i.test(picture)) {
        return res.redirect(302, picture);
      }

      return res.status(404).end();
    }

    const buffer = Buffer.from(inline.base64, "base64");

    res.set({
      "Content-Type": inline.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
    });

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Get author avatar error ❌", error);

    return res.status(500).end();
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
// EDIT POST CAPTION (owner only)
// ==========================================

const updatePostCaption = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (typeof req.body?.caption !== "string") {
      return res.status(400).json({
        success: false,
        message: "Caption must be text",
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
        message: "You can only edit your own posts",
      });
    }

    post.caption = req.body.caption.trim().slice(0, 500);

    await post.save();

    res.status(200).json({
      success: true,
      message: "Caption updated",
      caption: post.caption,
    });
  } catch (error) {
    console.error("Update caption error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while updating caption",
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
  updatePostCaption,
  getAuthorAvatar,
  getUploadSignature,
};