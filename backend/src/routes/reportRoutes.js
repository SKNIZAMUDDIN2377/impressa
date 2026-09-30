const express = require("express");

const { reportUser, reportPost } = require("../controllers/reportController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/user/:username", authMiddleware, reportUser);

router.post("/post/:postId", authMiddleware, reportPost);

module.exports = router;