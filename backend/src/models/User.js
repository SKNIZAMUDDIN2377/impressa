const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // ==========================================
    // OFFICIAL ACCOUNT
    // ==========================================

    isOfficial: {
      type: Boolean,
      default: false,
    },

    phone: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
    },

    profilePicture: {
      type: String,
      default: "",
    },

    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    impressionsReceived: {
      type: Number,
      default: 0,
    },

    badge: {
      type: String,
      default: "Impression Starter",
    },

    // ==========================================
    // PULSE COMPLETION HISTORY
    // ==========================================

    pulseCompletedDates: [
      {
        type: String,
      },
    ],

    // ==========================================
    // PRIVACY SETTINGS
    // ==========================================

    privacy: {
      commentsAllowed: {
        type: Boolean,
        default: true,
      },

      followersVisible: {
        type: Boolean,
        default: true,
      },

      activityVisible: {
        type: Boolean,
        default: true,
      },
    },

    // ==========================================
    // NOTIFICATION SETTINGS
    // ==========================================

    notifications: {
      impressions: {
        type: Boolean,
        default: true,
      },

      comments: {
        type: Boolean,
        default: true,
      },

      followers: {
        type: Boolean,
        default: true,
      },

      notes: {
        type: Boolean,
        default: true,
      },

      spark: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);