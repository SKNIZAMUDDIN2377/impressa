const Notification = require("../models/Notification");

// ==========================================
// GET MY NOTIFICATIONS
// ==========================================

const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.userId,
    })
      .populate(
        "sender",
        "name username profilePicture badge isOfficial"
      )
      .populate(
        "post",
        "media caption impressionsCount"
      )
      .sort({ createdAt: -1 })
      .limit(100);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user.userId,
      read: false,
    });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error(
      "Get notifications error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error while fetching notifications",
    });
  }
};

// ==========================================
// GET UNREAD COUNT
// ==========================================

const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user.userId,
      read: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error(
      "Get unread count error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error while checking notifications",
    });
  }
};

// ==========================================
// MARK ONE NOTIFICATION AS READ
// ==========================================

const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipient: req.user.userId,
        },
        {
          $set: {
            read: true,
          },
        },
        {
          new: true,
        }
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error(
      "Mark notification read error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error while updating notification",
    });
  }
};

// ==========================================
// MARK ALL NOTIFICATIONS AS READ
// ==========================================

const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user.userId,
        read: false,
      },
      {
        $set: {
          read: true,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error(
      "Mark all notifications read error ❌",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Server error while updating notifications",
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};