const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // User who receives the notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // User who caused the notification.
    // null = sent by Impressa itself (motivation / milestones)
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Notification type
    type: {
      type: String,
      enum: [
        "impression",
        "comment",
        "follow",
        "follow_accepted",
        "pulse",
        "system",
        "spark",
        "milestone",
      ],
      required: true,
    },

    // Optional related post
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    // Optional related pulse
    pulse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pulse",
      default: null,
    },

    // Notification message
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Only for Impressa's own messages. Together with `recipient` it is
    // unique, so a message like "first impression" can only be sent once.
    key: {
      type: String,
      default: undefined,
    },

    // Read / unread
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Fast notification loading
notificationSchema.index({
  recipient: 1,
  createdAt: -1,
});

// No duplicate motivation messages (ignored when `key` is not set)
notificationSchema.index(
  { recipient: 1, key: 1 },
  {
    unique: true,
    partialFilterExpression: { key: { $type: "string" } },
  }
);

module.exports = mongoose.model("Notification", notificationSchema);