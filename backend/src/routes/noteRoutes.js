const express = require("express");

const {
  createNote,
  getMyNotes,
  getUserNotes,
  deleteNote,
} = require("../controllers/noteController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ==========================================
// CREATE NOTE
// ==========================================

router.post(
  "/",
  authMiddleware,
  createNote
);

// ==========================================
// GET MY NOTES
// ==========================================

router.get(
  "/",
  authMiddleware,
  getMyNotes
);

// ==========================================
// GET USER NOTES
// ==========================================

router.get(
  "/user/:username",
  authMiddleware,
  getUserNotes
);

// ==========================================
// DELETE NOTE
// ==========================================

router.delete(
  "/:noteId",
  authMiddleware,
  deleteNote
);

module.exports = router;