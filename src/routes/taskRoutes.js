const express = require('express');
const {
  acceptRequest, startTask, completeTask, confirmCompletion,
  cancelTask, raiseDispute, getMyTasks, getRequestedTasks, getTask
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/my-tasks', getMyTasks);
router.get('/requested', getRequestedTasks);
router.get('/:taskId', getTask);

router.post('/accept/:requestId', acceptRequest);
router.put('/:taskId/start', startTask);
router.put('/:taskId/complete', completeTask);
router.put('/:taskId/confirm', confirmCompletion);
router.patch('/:taskId/confirm-completion', confirmCompletion); // alias for mobile MarkCompleteScreen
router.put('/:taskId/cancel', cancelTask);
router.put('/:taskId/dispute', raiseDispute);

module.exports = router;
