const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
  {
    // User who created the block
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // User who was blocked
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One block per direction. Prevents duplicates, even with double-taps
// or simultaneous requests.
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

// Fast reverse lookup: "who has blocked me?"
blockSchema.index({ blocked: 1 });

// Prevent a user from blocking themselves
blockSchema.pre("validate", function (next) {
  if (this.blocker.equals(this.blocked)) {
    return next(new Error("A user cannot block themselves"));
  }

  next();
});

module.exports = mongoose.model("Block", blockSchema);