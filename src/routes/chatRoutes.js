const express = require('express');
const { getTaskMessages, sendMessage, markAsRead } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/task/:taskId', getTaskMessages);
router.post('/', sendMessage);
router.put('/:messageId/read', markAsRead);

module.exports = router;
