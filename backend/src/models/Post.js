const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Multiple images/videos can belong to one post
    media: [
      {
        url: {
          type: String,
          required: true,
        },

        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
      },
    ],

    // Music attached to the post
    music: {
      id: {
        type: Number,
        default: null,
      },

      title: {
        type: String,
        default: "",
        trim: true,
      },

      artist: {
        type: String,
        default: "",
        trim: true,
      },

      audioUrl: {
        type: String,
        default: "",
        trim: true,
      },
    },

    caption: {
      type: String,
      default: "",
      trim: true,
    },

    impressionsCount: {
      type: Number,
      default: 0,
    },

    commentsCount: {
      type: Number,
      default: 0,
    },

    sharesCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Post", postSchema);