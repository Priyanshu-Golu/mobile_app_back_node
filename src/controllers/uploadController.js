const path = require('path');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Upload profile image
 * @route   POST /api/upload/profile
 * @access  Private
 */
exports.uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'Please upload an image file' } });
  }

  const imageUrl = `/uploads/profiles/${req.file.filename}`;

  await User.findByIdAndUpdate(req.user.id, { profileImage: imageUrl });

  res.status(200).json({
    success: true,
    data: { imageUrl, filename: req.file.filename }
  });
});

/**
 * @desc    Upload request images (up to 5)
 * @route   POST /api/upload/request
 * @access  Private
 */
exports.uploadRequestImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'NO_FILES', message: 'Please upload at least one image' } });
  }

  const imageUrls = req.files.map(f => `/uploads/requests/${f.filename}`);

  res.status(200).json({
    success: true,
    count: imageUrls.length,
    data: { imageUrls }
  });
});
