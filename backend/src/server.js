const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/database");

const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const postRoutes = require("./routes/postRoutes");
const followRoutes = require("./routes/followRoutes");
const pulseRoutes = require("./routes/pulseRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const noteRoutes = require("./routes/noteRoutes");
const commentRoutes = require("./routes/commentRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

// ==========================================
// MIDDLEWARE
// ==========================================

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

app.use(
  "/api/comments",
  commentRoutes
);
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