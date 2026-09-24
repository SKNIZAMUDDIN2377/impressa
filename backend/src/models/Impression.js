const mongoose = require("mongoose");

const impressionSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One user can give only one impression to the same post
impressionSchema.index(
  { post: 1, user: 1 },
  { unique: true }
);

module.exports = mongoose.model("Impression", impressionSchema);