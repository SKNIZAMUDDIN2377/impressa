const express = require("express");

const {
  registerUser,
  loginUser,
  getAccountSettings,
  updateAccountSettings,
  changePassword,
  deleteAccount,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ==========================================
// CREATE ACCOUNT
// ==========================================

router.post("/register", registerUser);

// ==========================================
// SIGN IN
// ==========================================

router.post("/login", loginUser);

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