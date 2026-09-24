const express = require("express");

const {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Get all notifications
router.get(
  "/",
  authMiddleware,
  getNotifications
);

// Get unread count
router.get(
  "/unread-count",
  authMiddleware,
  getUnreadCount
);

// Mark one as read
router.put(
  "/:notificationId/read",
  authMiddleware,
  markNotificationRead
);

// Mark all as read
router.put(
  "/read-all",
  authMiddleware,
  markAllNotificationsRead
);

module.exports = router;