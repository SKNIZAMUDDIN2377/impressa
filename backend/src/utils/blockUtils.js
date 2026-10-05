const Block = require("../models/Block");

/**
 * Returns an array of user ObjectIds that have a block relationship
 * with `userId` IN EITHER DIRECTION:
 *   - users that userId has blocked
 *   - users that have blocked userId
 *
 * Usage in queries:
 *   const hidden = await getBlockedUserIds(req.user.userId);
 *   Post.find({ author: { $nin: hidden } })
 */
const getBlockedUserIds = async (userId) => {
  const blocks = await Block.find({
    $or: [{ blocker: userId }, { blocked: userId }],
  })
    .select("blocker blocked")
    .lean();

  const ids = new Map();

  for (const b of blocks) {
    const other = String(b.blocker) === String(userId) ? b.blocked : b.blocker;
    ids.set(String(other), other);
  }

  return Array.from(ids.values());
};

/**
 * True if a block exists between the two users in either direction.
 */
const isBlockedBetween = async (userA, userB) => {
  if (!userA || !userB) return false;

  const found = await Block.exists({
    $or: [
      { blocker: userA, blocked: userB },
      { blocker: userB, blocked: userA },
    ],
  });

  return Boolean(found);
};

module.exports = { getBlockedUserIds, isBlockedBetween };