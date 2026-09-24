const express = require("express");

const {
  getPulse,
  createPulse,
  deletePulse,
  impressPulse,
} = require("../controllers/pulseController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ==========================================
// GET PULSE
// ==========================================

router.get(
  "/",
  authMiddleware,
  getPulse
);

// ==========================================
// CREATE PULSE
// ==========================================

router.post(
  "/",
  authMiddleware,
  createPulse
);

// ==========================================
// DELETE MY PULSE
// ==========================================

router.delete(
  "/:pulseId",
  authMiddleware,
  deletePulse
);

// ==========================================
// IMPRESS PULSE
// ==========================================

router.post(
  "/:pulseId/impress",
  authMiddleware,
  impressPulse
);

// ==========================================
// EXPORT
// ==========================================

module.exports = router;