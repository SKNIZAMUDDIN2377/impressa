const express = require("express");

const {
  registerUser,
  loginUser,
  verifyRecoveryCode,
  resetPasswordWithToken,
  issueRecoveryCode,
  getAccountSettings,
  updateAccountSettings,
  changePassword,
  deleteAccount,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const createRateLimiter = require("../middleware/rateLimiter");

const router = express.Router();

// ==========================================
// RATE LIMITERS (per IP, in addition to the
// per-account lock stored in the database)
// ==========================================

const recoveryVerifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message:
    "Too many recovery attempts. Please try again in a few minutes.",
});

const recoveryResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message:
    "Too many attempts. Please try again in a few minutes.",
});

const recoveryIssueLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message:
    "Too many attempts. Please try again in a few minutes.",
});

// ==========================================
// CREATE ACCOUNT
// ==========================================

router.post("/register", registerUser);

// ==========================================
// SIGN IN
// ==========================================

router.post("/login", loginUser);

// ==========================================
// FORGOT PASSWORD (public, no OTP)
// Step 1: username + recovery code → reset token
// Step 2: reset token + new password
// ==========================================

router.post(
  "/forgot-password/verify",
  recoveryVerifyLimiter,
  verifyRecoveryCode
);

router.post(
  "/forgot-password/reset",
  recoveryResetLimiter,
  resetPasswordWithToken
);

// ==========================================
// CREATE / REPLACE RECOVERY CODE (logged in)
// ==========================================

router.post(
  "/recovery-code",
  authMiddleware,
  recoveryIssueLimiter,
  issueRecoveryCode
);

// ==========================================
// PROTECTED TEST ROUTE
// ==========================================

router.get("/me", authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: "Authentication is working 🔐",
    user: req.user,
  });
});

// ==========================================
// ACCOUNT SETTINGS
// ==========================================

// Get logged-in user's account/settings
router.get(
  "/settings",
  authMiddleware,
  getAccountSettings
);

// Update privacy + notification settings
router.put(
  "/settings",
  authMiddleware,
  updateAccountSettings
);

// ==========================================
// CHANGE PASSWORD
// ==========================================

router.post(
  "/change-password",
  authMiddleware,
  changePassword
);

// ==========================================
// DELETE ACCOUNT PERMANENTLY
// ==========================================

router.delete(
  "/delete-account",
  authMiddleware,
  deleteAccount
);

module.exports = router;