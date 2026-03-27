const express = require('express');
const { uploadProfileImage, uploadRequestImages } = require('../controllers/uploadController');
const { uploadProfileImage: uploadProfileMiddleware, uploadRequestImages: uploadRequestMiddleware, handleUploadError } = require('../services/uploadService');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/profile', handleUploadError(uploadProfileMiddleware), uploadProfileImage);
router.post('/request', handleUploadError(uploadRequestMiddleware), uploadRequestImages);

module.exports = router;
