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

    // NOTE: phone is intentionally NOT unique.
    // Impressa V1 allows multiple accounts on one phone number.
    phone: {
      type: String,
      required: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    // ==========================================
    // ACCOUNT RECOVERY (no OTP in V1)
    // ==========================================

    // Whether this account has a recovery code (safe to send to the client)
    recoveryCodeSet: {
      type: Boolean,
      default: false,
    },

    // bcrypt hash of the recovery code (never sent to the client)
    recoveryCodeHash: {
      type: String,
      default: "",
      select: false,
    },

    // Wrong recovery-code guesses since the last lock/success
    recoveryAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    // Recovery is blocked until this time after too many wrong guesses
    recoveryLockedUntil: {
      type: Date,
      default: null,
      select: false,
    },

    // Incremented after a password reset so every older JWT stops working
    tokenVersion: {
      type: Number,
      default: 0,
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