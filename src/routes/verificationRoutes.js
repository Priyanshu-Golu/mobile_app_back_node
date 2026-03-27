const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { initiateAadhaar, confirmAadhaar, getStatus } = require('../controllers/verificationController');

/**
 * @swagger
 * tags:
 *   name: Verification
 *   description: Identity verification via Aadhaar / IDfy
 */

router.use(protect);

router.get('/status', getStatus);
router.post('/aadhaar/initiate', initiateAadhaar);
router.post('/aadhaar/confirm', confirmAadhaar);

module.exports = router;
