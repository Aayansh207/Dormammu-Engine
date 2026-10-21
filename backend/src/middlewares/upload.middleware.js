const multer = require("multer");

// Use memory storage so we can stream directly to Cloudinary without writing temporary files to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow common image mime types
  if (
    file.mimetype.startsWith("image/") ||
    ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"].includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    const error = new Error("Only image files (JPEG, PNG, WebP, GIF, SVG) are allowed");
    error.statusCode = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter,
});

module.exports = upload;
