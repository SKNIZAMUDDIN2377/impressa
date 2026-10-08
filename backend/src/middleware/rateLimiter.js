// ==========================================
// SIMPLE IN-MEMORY RATE LIMITER (per IP)
// No extra npm package needed.
// This is a second layer of protection: the real
// per-account lock lives in the database.
// ==========================================

const createRateLimiter = ({ windowMs, max, message }) => {
  const hits = new Map();

  // Clean up expired entries so memory never grows forever
  const cleanup = setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) {
        hits.delete(key);
      }
    }
  }, windowMs);

  if (typeof cleanup.unref === "function") {
    cleanup.unref();
  }

  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();

    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };

      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      res.set(
        "Retry-After",
        String(Math.ceil((entry.resetAt - now) / 1000))
      );

      return res.status(429).json({
        success: false,
        message:
          message ||
          "Too many attempts. Please try again in a few minutes.",
      });
    }

    next();
  };
};

module.exports = createRateLimiter;