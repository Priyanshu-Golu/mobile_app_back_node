const express = require('express');
const {
  createProfile, getMyProfile, updateProfile,
  getProfile, getNearbyProfessionals, requestVerification
} = require('../controllers/professionalController');
const { protect } = require('../middleware/auth');
const { validateProfessionalProfile } = require('../middleware/validation');

const router = express.Router();

// Public routes
router.get('/nearby', getNearbyProfessionals);
router.get('/:userId', getProfile);

// Protected routes
router.use(protect);
router.get('/me/profile', getMyProfile);
router.post('/profile', validateProfessionalProfile, createProfile);
router.put('/profile', updateProfile);
router.post('/verify', requestVerification);

module.exports = router;
