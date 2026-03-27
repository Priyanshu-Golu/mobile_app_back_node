const express = require('express');
const { getBalance, getTransactions, getLeaderboard } = require('../controllers/creditController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/balance', protect, getBalance);
router.get('/transactions', protect, getTransactions);
router.get('/leaderboard', getLeaderboard);

module.exports = router;
