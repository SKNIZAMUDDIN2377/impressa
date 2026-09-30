const express = require("express");

const {
  blockUser,
  unblockUser,
  getBlockedUsers,
  getBlockStatus,
} = require("../controllers/blockController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/status/:username", authMiddleware, getBlockStatus);

router.get("/", authMiddleware, getBlockedUsers);

router.post("/:username", authMiddleware, blockUser);

router.delete("/:username", authMiddleware, unblockUser);

module.exports = router;
