const crypto = require("crypto");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Impression = require("../models/Impression");
const Pulse = require("../models/Pulse");
const Note = require("../models/Note");
const Notification = require("../models/Notification");
const Block = require("../models/Block");
const { deleteCloudinaryMedia } = require("../utils/cloudinaryCleanup");

// ==========================================
// CONSTANTS
// ==========================================

const BCRYPT_ROUNDS = 12;

const USERNAME_REGEX = /^[a-z0-9._]{3,30}$/;
const PHONE_REGEX = /^\d{10,15}$/;

// Recovery code: 16 chars, no look-alikes (no 0/O, 1/I) → ~80 bits
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_CODE_LENGTH = 16;

const MAX_RECOVERY_ATTEMPTS = 5;
const RECOVERY_LOCK_MINUTES = 30;
const RESET_TOKEN_MINUTES = 10;

// One message for every recovery failure (unknown user, no code,
// wrong code, locked) so nothing reveals whether an account exists.
const GENERIC_RECOVERY_ERROR =
  "Invalid username or recovery code, or too many attempts. Please try again later.";

const EXPIRED_RESET_MESSAGE =
  "Your reset session has expired. Please start again.";

// Used so unknown usernames take as long to answer as real ones
const DUMMY_HASH = bcrypt.hashSync(
  "impressa-dummy-recovery-value",
  BCRYPT_ROUNDS
);

// ==========================================
// HELPERS
// ==========================================

const asTrimmedString = (value) =>
  typeof value === "string" ? value.trim() : "";

// Same rules as Change Password, shared with register + reset
const getPasswordError = (password) => {
  if (password.length < 8 || password.length > 64) {
    return "Password must be between 8 and 64 characters";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain an uppercase letter";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain a lowercase letter";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain a number";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain a special character";
  }

  if (/\s/.test(password)) {
    return "Password cannot contain spaces";
  }

  return "";
};

const createRecoveryCode = () => {
  let raw = "";

  for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) {
    raw += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
  }

  return raw.match(/.{4}/g).join("-");
};

const normalizeRecoveryCode = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

// Reset tokens use a different secret from login tokens, so a reset
// token can never be used as a login token (and vice versa).
const getResetSecret = () => `${process.env.JWT_SECRET}:password-reset`;

const registerFailedRecoveryAttempt = async (userId) => {
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { recoveryAttempts: 1 } },
    { new: true }
  ).select("+recoveryAttempts");

  if (updated && updated.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          recoveryAttempts: 0,
          recoveryLockedUntil: new Date(
            Date.now() + RECOVERY_LOCK_MINUTES * 60 * 1000
          ),
        },
      }
    );
  }
};

// ==========================================
// REGISTER / CREATE ACCOUNT
// ==========================================

const registerUser = async (req, res) => {
  try {
    const name = asTrimmedString(req.body.name);
    const username = asTrimmedString(req.body.username).toLowerCase();
    const phone = String(req.body.phone ?? "").trim();
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    // 1. Required fields
    if (!name || !username || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // 2. Validation (friendly messages instead of "Server Error")
    if (name.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name must be 50 characters or fewer",
      });
    }

    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json({
        success: false,
        message:
          "Username must be 3–30 characters and can only use letters, numbers, dots and underscores",
      });
    }

    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid phone number (10–15 digits)",
      });
    }

    const passwordError = getPasswordError(password);

    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    // 3. Username must be unique.
    //    Phone numbers are NOT checked — many accounts may share one.
    const existingUsername = await User.findOne({ username });

    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    // 4. Hash password + create the recovery code
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const recoveryCode = createRecoveryCode();

    const recoveryCodeHash = await bcrypt.hash(
      normalizeRecoveryCode(recoveryCode),
      BCRYPT_ROUNDS
    );

    // 5. Create user
    const user = await User.create({
      name,
      username,
      phone,
      password: hashedPassword,
      recoveryCodeHash,
      recoveryCodeSet: true,
    });

    // 6. Return safe user data (+ recovery code, shown ONCE)
    res.status(201).json({
      success: true,
      message: "Impressa account created successfully 🎉",
      recoveryCode,
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
    // Duplicate key (e.g. two people grabbing a username at the same time)
    if (error && error.code === 11000) {
      const duplicatedField = Object.keys(
        error.keyPattern || error.keyValue || {}
      )[0];

      if (duplicatedField === "username") {
        return res.status(409).json({
          success: false,
          message: "Username already exists",
        });
      }

      console.error(
        `Registration blocked by an unexpected unique index on "${duplicatedField}" ❌`,
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          "We couldn't create your account right now. Please try again in a moment.",
      });
    }

    if (error && error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Please check your details and try again",
      });
    }

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
    const username = asTrimmedString(req.body.username).toLowerCase();
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    // 1. Check required fields
    // (Login by phone was removed: many accounts can share a phone
    //  number, so a phone number can't identify one account.)
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // 2. Find user
    const user = await User.findOne({ username });

    // 3. Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
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
        message: "Invalid username or password",
      });
    }

    // 5. Create JWT token (tokenVersion lets a reset revoke old tokens)
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        tokenVersion: user.tokenVersion || 0,
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
// FORGOT PASSWORD — STEP 1
// Verify username + recovery code → short-lived reset token
// ==========================================

const verifyRecoveryCode = async (req, res) => {
  try {
    const username = asTrimmedString(req.body.username).toLowerCase();
    const code = normalizeRecoveryCode(req.body.recoveryCode);

    // Malformed input says nothing about whether an account exists
    if (!username || code.length !== RECOVERY_CODE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "Enter your username and your 16-character recovery code.",
      });
    }

    const user = await User.findOne({ username }).select(
      "+recoveryCodeHash +recoveryAttempts +recoveryLockedUntil"
    );

    const hasCode = Boolean(user && user.recoveryCodeHash);

    const isLocked = Boolean(
      user &&
        user.recoveryLockedUntil &&
        user.recoveryLockedUntil > new Date()
    );

    // Always run one bcrypt compare so response time doesn't leak
    // whether the account exists.
    const codeMatches = await bcrypt.compare(
      code,
      hasCode ? user.recoveryCodeHash : DUMMY_HASH
    );

    if (!hasCode || isLocked || !codeMatches) {
      if (hasCode && !isLocked) {
        await registerFailedRecoveryAttempt(user._id);
      }

      return res.status(401).json({
        success: false,
        message: GENERIC_RECOVERY_ERROR,
      });
    }

    if (user.recoveryAttempts || user.recoveryLockedUntil) {
      await User.updateOne(
        { _id: user._id },
        { $set: { recoveryAttempts: 0, recoveryLockedUntil: null } }
      );
    }

    const resetToken = jwt.sign(
      {
        purpose: "password-reset",
        uid: String(user._id),
        v: user.tokenVersion || 0,
      },
      getResetSecret(),
      { expiresIn: `${RESET_TOKEN_MINUTES}m` }
    );

    res.status(200).json({
      success: true,
      resetToken,
    });
  } catch (error) {
    console.error("Verify recovery code error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
};

// ==========================================
// FORGOT PASSWORD — STEP 2
// Reset token + new password → password changed
// ==========================================

const resetPasswordWithToken = async (req, res) => {
  try {
    const resetToken =
      typeof req.body.resetToken === "string" ? req.body.resetToken : "";

    const newPassword =
      typeof req.body.newPassword === "string"
        ? req.body.newPassword
        : "";

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset session and new password are required",
      });
    }

    const passwordError = getPasswordError(newPassword);

    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(resetToken, getResetSecret());
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: EXPIRED_RESET_MESSAGE,
      });
    }

    if (
      !decoded ||
      decoded.purpose !== "password-reset" ||
      !decoded.uid
    ) {
      return res.status(401).json({
        success: false,
        message: EXPIRED_RESET_MESSAGE,
      });
    }

    // The recovery code is single-use: a fresh one replaces it
    const newRecoveryCode = createRecoveryCode();

    const [hashedPassword, recoveryCodeHash] = await Promise.all([
      bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      bcrypt.hash(
        normalizeRecoveryCode(newRecoveryCode),
        BCRYPT_ROUNDS
      ),
    ]);

    // Atomic + single-use: only succeeds while tokenVersion still
    // matches the version stored in the reset token.
    const expectedVersion = Number(decoded.v) || 0;

    const versionFilter =
      expectedVersion === 0
        ? {
            $or: [
              { tokenVersion: 0 },
              { tokenVersion: { $exists: false } },
            ],
          }
        : { tokenVersion: expectedVersion };

    const updated = await User.findOneAndUpdate(
      { _id: decoded.uid, ...versionFilter },
      {
        $set: {
          password: hashedPassword,
          recoveryCodeHash,
          recoveryCodeSet: true,
          recoveryAttempts: 0,
          recoveryLockedUntil: null,
        },
        // Invalidates every login token issued before this reset
        $inc: { tokenVersion: 1 },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(401).json({
        success: false,
        message: EXPIRED_RESET_MESSAGE,
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
      recoveryCode: newRecoveryCode,
    });
  } catch (error) {
    console.error("Reset password error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while resetting password",
    });
  }
};

// ==========================================
// CREATE / REPLACE RECOVERY CODE (logged-in users)
// ==========================================

const issueRecoveryCode = async (req, res) => {
  try {
    const currentPassword =
      typeof req.body.currentPassword === "string"
        ? req.body.currentPassword
        : "";

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is required",
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

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

    const recoveryCode = createRecoveryCode();

    const recoveryCodeHash = await bcrypt.hash(
      normalizeRecoveryCode(recoveryCode),
      BCRYPT_ROUNDS
    );

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          recoveryCodeHash,
          recoveryCodeSet: true,
          recoveryAttempts: 0,
          recoveryLockedUntil: null,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Recovery code created",
      recoveryCode,
    });
  } catch (error) {
    console.error("Issue recovery code error ❌", error);

    res.status(500).json({
      success: false,
      message: "Server error while creating recovery code",
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
        hasRecoveryCode: Boolean(user.recoveryCodeSet),
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
// CHANGE PASSWORD (logged-in users) — unchanged
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
// DELETE ACCOUNT PERMANENTLY — unchanged
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

    // Find the user's posts
    const userPosts = await Post.find({ author: userId }).select("_id media");
    const userPostIds = userPosts.map((post) => post._id);

    // Posts owned by OTHER people that this user commented on.
    // Their stored commentsCount must be recalculated afterwards.
    const commentedPostIds = await Comment.distinct("post", {
      user: userId,
      post: { $nin: userPostIds },
    });

    // Comments written by this user + all comments on this user's posts
    // (the old code filtered on `author`, but the field is `user`)
    await Comment.deleteMany({
      $or: [{ user: userId }, { post: { $in: userPostIds } }],
    });

    for (const postId of commentedPostIds) {
      const count = await Comment.countDocuments({ post: postId });
      await Post.updateOne({ _id: postId }, { commentsCount: count });
    }

    // Impressions given by this user + impressions on this user's posts
    await Impression.deleteMany({
      $or: [{ user: userId }, { post: { $in: userPostIds } }],
    });

    await Post.deleteMany({ author: userId });

    // Remove the user's photos/videos from Cloudinary (best-effort)
    await deleteCloudinaryMedia(
      userPosts.flatMap((post) => post.media || [])
    );

    await Pulse.deleteMany({ user: userId });

    await Note.deleteMany({ user: userId });

    await Notification.deleteMany({
      $or: [{ recipient: userId }, { sender: userId }],
    });

    await Block.deleteMany({
      $or: [{ blocker: userId }, { blocked: userId }],
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
  verifyRecoveryCode,
  resetPasswordWithToken,
  issueRecoveryCode,
  getAccountSettings,
  updateAccountSettings,
  changePassword,
  deleteAccount,
};