const Block = require("../models/Block");
const Follow = require("../models/Follow");
const User = require("../models/User");

const getMyId = (req) => req.user && req.user.userId;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findTargetByUsername = async (username) => {
  if (!username) return null;

  return User.findOne({
    username: String(username).trim().toLowerCase(),
  }).select("_id username");
};

// ==========================================
// BLOCK USER
// POST /api/blocks/:username
// ==========================================

const blockUser = async (req, res) => {
  try {
    const me = getMyId(req);

    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const target = await findTargetByUsername(req.params.username);

    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (String(target._id) === String(me)) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot block yourself" });
    }

    // Idempotent: duplicate requests / double taps are safe
    try {
      await Block.create({ blocker: me, blocked: target._id });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }

    // Blocking ends any follow relationship in both directions,
    // in the Follow collection AND in the User arrays.
    await Promise.all([
      Follow.deleteMany({
        $or: [
          { follower: me, following: target._id },
          { follower: target._id, following: me },
        ],
      }),
      User.updateOne(
        { _id: me },
        { $pull: { following: target._id, followers: target._id } }
      ),
      User.updateOne(
        { _id: target._id },
        { $pull: { following: me, followers: me } }
      ),
    ]);

    return res.json({
      success: true,
      message: `Blocked @${target.username}`,
    });
  } catch (error) {
    console.error("blockUser error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to block user" });
  }
};

// ==========================================
// UNBLOCK USER
// DELETE /api/blocks/:username
// Only removes the block created by the logged-in user.
// ==========================================

const unblockUser = async (req, res) => {
  try {
    const me = getMyId(req);

    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const target = await findTargetByUsername(req.params.username);

    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await Block.deleteOne({ blocker: me, blocked: target._id });

    return res.json({
      success: true,
      message: `Unblocked @${target.username}`,
    });
  } catch (error) {
    console.error("unblockUser error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to unblock user" });
  }
};

// ==========================================
// MY BLOCKED ACCOUNTS (with optional search)
// GET /api/blocks?search=abc
// Returns ONLY accounts the logged-in user blocked.
// ==========================================

const getBlockedUsers = async (req, res) => {
  try {
    const me = getMyId(req);

    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const blocks = await Block.find({ blocker: me })
      .sort({ createdAt: -1 })
      .select("blocked")
      .lean();

    const filter = { _id: { $in: blocks.map((b) => b.blocked) } };

    const search = String(req.query.search || "").trim().slice(0, 50);

    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ username: rx }, { name: rx }];
    }

    const users = await User.find(filter)
      .select("username name profilePicture")
      .lean();

    const byId = new Map(users.map((u) => [String(u._id), u]));

    // Keeps newest-blocked-first order; drops deleted or non-matching users
    const result = blocks
      .map((b) => byId.get(String(b.blocked)))
      .filter(Boolean);

    return res.json({ success: true, count: result.length, users: result });
  } catch (error) {
    console.error("getBlockedUsers error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load blocked accounts" });
  }
};

// ==========================================
// DID I BLOCK THIS USER?
// GET /api/blocks/status/:username
// Deliberately does NOT reveal whether they blocked me.
// ==========================================

const getBlockStatus = async (req, res) => {
  try {
    const me = getMyId(req);
    const target = await findTargetByUsername(req.params.username);

    if (!me || !target) {
      return res.json({ success: true, blockedByMe: false });
    }

    const found = await Block.exists({ blocker: me, blocked: target._id });

    return res.json({ success: true, blockedByMe: Boolean(found) });
  } catch (error) {
    console.error("getBlockStatus error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to check block status" });
  }
};

module.exports = { blockUser, unblockUser, getBlockedUsers, getBlockStatus };