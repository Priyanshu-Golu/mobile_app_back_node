const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createOrder, verifyPayment, getHistory, getRate } = require('../controllers/paymentController');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing — Razorpay orders & credit transactions
 */

// Public
router.get('/rate', getRate);

// Protected
router.use(protect);
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.get('/history', getHistory);

module.exports = router;
