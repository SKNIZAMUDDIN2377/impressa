const jwt = require("jsonwebtoken");

const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  let decoded;

  // 1. Verify the JWT itself
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.userId) {
      throw new Error("Malformed token");
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  // 2. Make sure the account still exists and the token is not
  //    from before a password reset (tokenVersion changed).
  //    Old tokens have no tokenVersion → treated as version 0.
  try {
    const user = await User.findById(decoded.userId)
      .select("tokenVersion")
      .lean();

    if (
      !user ||
      (user.tokenVersion || 0) !== (decoded.tokenVersion || 0)
    ) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please sign in again.",
      });
    }

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error ❌", error);

    return res.status(500).json({
      success: false,
      message: "Server error while checking your session",
    });
  }
};

module.exports = authMiddleware;