const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One user can follow another user only once
followSchema.index(
  { follower: 1, following: 1 },
  { unique: true }
);

// Prevent a user from following themselves
followSchema.pre("validate", function () {
  if (
    this.follower &&
    this.following &&
    this.follower.equals(this.following)
  ) {
    throw new Error("A user cannot follow themselves");
  }
});

module.exports = mongoose.model("Follow", followSchema);