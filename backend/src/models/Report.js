const mongoose = require("mongoose");

const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate_abuse",
  "sexual_content",
  "violence",
  "impersonation",
  "copyright",
  "other",
];

const reportSchema = new mongoose.Schema(
  {
    // "user" = profile report, "post" = post report
    targetType: {
      type: String,
      enum: ["user", "post"],
      required: true,
    },

    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The account being reported (for post reports: the post's author)
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Only for post reports
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    // Evidence copy: the post may be deleted before a moderator reviews it
    postSnapshot: {
      caption: { type: String, default: "" },
      mediaUrls: [{ type: String }],
    },

    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ["pending", "reviewed", "action_taken", "dismissed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Moderation queue
reportSchema.index({ status: 1, createdAt: -1 });

// Duplicate-report check
reportSchema.index({
  reporter: 1,
  targetType: 1,
  reportedUser: 1,
  post: 1,
});

reportSchema.pre("validate", function (next) {
  if (this.reporter.equals(this.reportedUser)) {
    return next(new Error("You cannot report yourself"));
  }

  if (this.targetType === "post" && !this.post) {
    return next(new Error("A post report requires a post"));
  }

  next();
});

reportSchema.statics.REASONS = REPORT_REASONS;

module.exports = mongoose.model("Report", reportSchema);