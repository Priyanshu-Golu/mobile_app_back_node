const express = require('express');
const {
  getProfile, updateProfile, updateSkills, updateLocation,
  toggleAvailability, getNearbyHelpers, getUser, getUserReviews, deactivateAccount
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/skills', updateSkills);
router.put('/location', updateLocation);
router.put('/availability', toggleAvailability);
router.get('/nearby-helpers', getNearbyHelpers);
router.delete('/account', deactivateAccount);

router.get('/:userId', getUser);
router.get('/:userId/reviews', getUserReviews);

module.exports = router;
