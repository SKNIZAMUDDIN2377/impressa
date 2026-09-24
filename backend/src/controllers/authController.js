const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Impression = require("../models/Impression");
const Pulse = require("../models/Pulse");

// ==========================================
// REGISTER / CREATE ACCOUNT
// ==========================================

const registerUser = async (req, res) => {
  try {
    const { name, username, phone, password } = req.body;

    // 1. Check required fields
    if (!name || !username || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // 2. Check whether username already exists
    const existingUsername = await User.findOne({
      username: username.toLowerCase(),
    });

    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

   

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 5. Create user
    const user = await User.create({
      name,
      username: username.toLowerCase(),
      phone,
      password: hashedPassword,
    });

    // 6. Return safe user data
    res.status(201).json({
      success: true,
      message: "Impressa account created successfully 🎉",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        bio: user.bio,
        profilePicture: user.profilePicture,
        badge: user.badge,
      },
    });
  } catch (error) {
    console.error("Registration error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

// ==========================================
// LOGIN / SIGN IN
// ==========================================

const loginUser = async (req, res) => {
  try {
    const { username, phone, password } = req.body;

    // 1. Check required fields
    if ((!username && !phone) || !password) {
      return res.status(400).json({
        success: false,
        message: "Username or phone and password are required",
      });
    }

    // 2. Find user
    let user;

    if (username) {
      user = await User.findOne({
        username: username.toLowerCase(),
      });
    } else {
      user = await User.findOne({ phone });
    }

    // 3. Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username/phone or password",
      });
    }

    // 4. Compare password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid username/phone or password",
      });
    }

    // 5. Create JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // 6. Return safe user data
    res.status(200).json({
      success: true,
      message: "Sign in successful 🎉",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        bio: user.bio,
        profilePicture: user.profilePicture,
        badge: user.badge,
      },
    });
  } catch (error) {
    console.error("Login error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error during sign in",
    });
  }
};

// ==========================================
// GET ACCOUNT SETTINGS
// ==========================================

const getAccountSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "-password"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        bio: user.bio,
        profilePicture: user.profilePicture,
        badge: user.badge,
        privacy: user.privacy,
        notifications: user.notifications,
      },
    });
  } catch (error) {
    console.error("Get account settings error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while loading account settings",
    });
  }
};

// ==========================================
// UPDATE PRIVACY + NOTIFICATION SETTINGS
// ==========================================

const updateAccountSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { privacy, notifications } = req.body;

    // Update privacy settings
    if (privacy) {
      if (typeof privacy.commentsAllowed === "boolean") {
        user.privacy.commentsAllowed = privacy.commentsAllowed;
      }

      if (typeof privacy.followersVisible === "boolean") {
        user.privacy.followersVisible = privacy.followersVisible;
      }

      if (typeof privacy.activityVisible === "boolean") {
        user.privacy.activityVisible = privacy.activityVisible;
      }
    }

    // Update notification settings
    if (notifications) {
      if (typeof notifications.impressions === "boolean") {
        user.notifications.impressions = notifications.impressions;
      }

      if (typeof notifications.comments === "boolean") {
        user.notifications.comments = notifications.comments;
      }

      if (typeof notifications.followers === "boolean") {
        user.notifications.followers = notifications.followers;
      }

      if (typeof notifications.notes === "boolean") {
        user.notifications.notes = notifications.notes;
      }

      if (typeof notifications.spark === "boolean") {
        user.notifications.spark = notifications.spark;
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      privacy: user.privacy,
      notifications: user.notifications,
    });
  } catch (error) {
    console.error("Update settings error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while updating settings",
    });
  }
};

// ==========================================
// CHANGE PASSWORD
// ==========================================

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Check required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // 2. Password length
    if (newPassword.length < 8 || newPassword.length > 64) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 64 characters",
      });
    }

    // 3. Password requirements
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain an uppercase letter",
      });
    }

    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain a lowercase letter",
      });
    }

    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain a number",
      });
    }

    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain a special character",
      });
    }

    if (/\s/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password cannot contain spaces",
      });
    }

    // 4. Find user
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 5. Verify current password
    const currentPasswordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!currentPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // 6. Prevent same password
    const samePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // 7. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // 8. Save new password
    user.password = hashedPassword;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while changing password",
    });
  }
};

// ==========================================
// DELETE ACCOUNT PERMANENTLY
// ==========================================

const deleteAccount = async (req, res) => {
  try {
    const { currentPassword } = req.body;

    // ==========================================
    // 1. CHECK PASSWORD
    // ==========================================

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is required",
      });
    }

    // ==========================================
    // 2. FIND USER
    // ==========================================

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ==========================================
    // 3. VERIFY CURRENT PASSWORD
    // ==========================================

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const userId = user._id;

    // ==========================================
    // 4. FIND USER'S POSTS
    // ==========================================

    const userPosts = await Post.find({
      author: userId,
    }).select("_id");

    const userPostIds = userPosts.map((post) => post._id);

    // ==========================================
    // 5. DELETE COMMENTS
    // ==========================================
    //
    // Delete:
    // - Comments written by this user
    // - Comments made by anyone on this user's posts
    //

    await Comment.deleteMany({
      $or: [
        { author: userId },
        { post: { $in: userPostIds } },
      ],
    });

    // ==========================================
    // 6. DELETE IMPRESSIONS GIVEN BY USER
    // ==========================================

    await Impression.deleteMany({
      user: userId,
    });

    // ==========================================
    // 7. DELETE USER'S POSTS
    // ==========================================

    await Post.deleteMany({
      author: userId,
    });

    // ==========================================
    // 8. DELETE USER'S PULSES
    // ==========================================

    await Pulse.deleteMany({
      user: userId,
    });

    // ==========================================
    // 9. REMOVE USER FROM OTHER USERS'
    //    FOLLOWERS / FOLLOWING
    // ==========================================

    await User.updateMany(
      {},
      {
        $pull: {
          followers: userId,
          following: userId,
        },
      }
    );

    // ==========================================
    // 10. REMOVE USER FROM OTHER PULSES'
    //     IMPRESSION LISTS
    // ==========================================

    await Pulse.updateMany(
      {
        impressedBy: userId,
      },
      {
        $pull: {
          impressedBy: userId,
        },
      }
    );

    // ==========================================
    // 11. DELETE USER DOCUMENT
    // ==========================================

    await User.findByIdAndDelete(userId);

    // ==========================================
    // 12. SUCCESS
    // ==========================================

    res.status(200).json({
      success: true,
      message: "Your Impressa account has been permanently deleted",
    });
  } catch (error) {
    console.error("Delete account error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while deleting account",
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  registerUser,
  loginUser,
  getAccountSettings,
  updateAccountSettings,
  changePassword,
  deleteAccount,
};