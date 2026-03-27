const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const uploadDir = path.join(process.cwd(), 'uploads');
ensureDir(path.join(uploadDir, 'profiles'));
ensureDir(path.join(uploadDir, 'requests'));

// Filter only image files
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const isValidMime = allowedTypes.test(file.mimetype);
  const isValidExt = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (isValidMime && isValidExt) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'), false);
  }
};

// Storage strategies
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(uploadDir, 'profiles')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `profile-${req.user.id}-${Date.now()}${ext}`);
  }
});

const requestStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(uploadDir, 'requests')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `req-${req.user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`);
  }
});

exports.uploadProfileImage = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFileFilter
}).single('image');

exports.uploadRequestImages = multer({
  storage: requestStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5MB per file, max 5 files
  fileFilter: imageFileFilter
}).array('images', 5);

/**
 * Middleware that handles multer errors gracefully
 */
exports.handleUploadError = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: err.message }
      });
    }
    if (err) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILE', message: err.message }
      });
    }
    next();
  });
};
