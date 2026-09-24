const multer = require("multer");

// Store uploaded files temporarily in memory.
// The file will NOT be saved to the backend folder.
const storage = multer.memoryStorage();

// Allowed file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only JPG, PNG, WEBP, MP4, WEBM and MOV files are allowed"
      ),
      false
    );
  }
};

// Multer configuration
const upload = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },

  fileFilter,
});

module.exports = upload;