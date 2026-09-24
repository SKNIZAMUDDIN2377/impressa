const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    // ==========================================
    // NOTE OWNER
    // ==========================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ==========================================
    // NOTE CONTENT
    // ==========================================

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Note", noteSchema);