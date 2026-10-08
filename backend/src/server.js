const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const cors = require("cors");

let compression = null;

try {
  compression = require("compression");
} catch (error) {
  console.warn(
    "⚠️  'compression' is not installed. Run: npm install compression"
  );
}

const connectDB = require("./config/database");

const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const postRoutes = require("./routes/postRoutes");
const followRoutes = require("./routes/followRoutes");
const pulseRoutes = require("./routes/pulseRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const noteRoutes = require("./routes/noteRoutes");
const commentRoutes = require("./routes/commentRoutes");
const blockRoutes = require("./routes/blockRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

// Correct client IPs / protocol when running behind a host's proxy
app.set("trust proxy", 1);

// ==========================================
// MIDDLEWARE
// ==========================================

if (compression) {
  app.use(compression());
}

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(cors());

// ==========================================
// ROUTES
// ==========================================

app.use("/api/auth", authRoutes);

app.use("/api/profile", profileRoutes);

app.use("/api/posts", postRoutes);

// Comments live under a post: /api/posts/:postId/comments
// (mounted after postRoutes; none of the paths overlap)
app.use("/api/posts", commentRoutes);

app.use("/api/follow", followRoutes);

app.use("/api/pulse", pulseRoutes);

app.use(
  "/api/notifications",
  notificationRoutes
);
app.use(
  "/api/notes",
  noteRoutes
);

// Kept for backward compatibility: /api/comments/:postId/comments
app.use(
  "/api/comments",
  commentRoutes
);
app.use("/api/blocks", blockRoutes);

app.use("/api/reports", reportRoutes);


// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Impressa backend is running 🚀",
  });
});

// ==========================================
// UNKNOWN API ROUTES (JSON instead of an HTML page)
// ==========================================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// Always answers with JSON so the app can show a message
// instead of failing on an HTML error page.
// ==========================================

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid request data",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "That request is too large",
    });
  }

  console.error("Unhandled server error ❌", error);

  res.status(500).json({
    success: false,
    message: "Something went wrong on our side. Please try again.",
  });
});

// ==========================================
// START SERVER
// ==========================================

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `Impressa backend running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start Impressa backend ❌");
    console.error(error.message);
  }
};

startServer();