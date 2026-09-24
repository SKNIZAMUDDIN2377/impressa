const mongoose = require("mongoose");

const pulseSchema = new mongoose.Schema(
  {
    // ==========================================
    // USER WHO CREATED THE PULSE
    // ==========================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ==========================================
    // DAILY CHALLENGE
    // ==========================================

    challengeIndex: {
      type: Number,
      required: true,
    },

    challengeTitle: {
      type: String,
      required: true,
      trim: true,
    },

    challengeDescription: {
      type: String,
      required: true,
      trim: true,
    },

    // ==========================================
    // PULSE IMAGE
    // ==========================================

    image: {
      type: String,
      required: true,
    },

    // ==========================================
    // IMPRESSIONS
    // ==========================================

    impressedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    impressionsCount: {
      type: Number,
      default: 0,
    },

    // ==========================================
    // CREATED / EXPIRES
    // ==========================================

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // ==========================================
    // STREAK / CHALLENGE COMPLETION
    // ==========================================
    //
    // Stores the date on which this challenge
    // was completed.
    //
    // This allows the backend to calculate the
    // user's consecutive Pulse streak.
    //

    completionDate: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// AUTOMATIC EXPIRATION
// ==========================================
//
// MongoDB will automatically remove the Pulse
// after expiresAt.
//

pulseSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// ==========================================
// ONE ACTIVE PULSE PER USER
// ==========================================

pulseSchema.index(
  { user: 1, expiresAt: 1 }
);

module.exports = mongoose.model(
  "Pulse",
  pulseSchema
);