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

    // User who caused the notification
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

module.exports = mongoose.model(
  "Notification",
  notificationSchema
);