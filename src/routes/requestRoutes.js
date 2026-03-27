const express = require('express');
const {
  createRequest, getRequests, getRequest,
  updateRequest, deleteRequest, getMyRequests, getNearbyRequests
} = require('../controllers/requestController');
const { protect } = require('../middleware/auth');
const { validateHelpRequest } = require('../middleware/validation');
const asyncHandler = require('../middleware/asyncHandler');
const HelpRequest = require('../models/HelpRequest');

const router = express.Router();

router.route('/')
  .get(getRequests)
  .post(protect, validateHelpRequest, createRequest);

router.get('/my-requests', protect, getMyRequests);
router.get('/nearby', protect, getNearbyRequests);

router.route('/:requestId')
  .get(getRequest)
  .put(protect, updateRequest)
  .delete(protect, deleteRequest);

// ─── Professional Path: Quotes ────────────────────────────────────────────────

// GET /api/requests/:requestId/quotes — get all quotes for a request
router.get('/:requestId/quotes', protect, asyncHandler(async (req, res) => {
  const request = await HelpRequest.findById(req.params.requestId)
    .populate('quotes.professionalId', 'name averageRating profileImage isVerified');
  if (!request) return res.status(404).json({ success: false, error: { message: 'Request not found' } });
  res.json({ success: true, data: request.quotes || [] });
}));

// POST /api/requests/:requestId/quotes — professional submits a quote
router.post('/:requestId/quotes', protect, asyncHandler(async (req, res) => {
  const { amount, message, estimatedDuration } = req.body;
  if (!amount) return res.status(400).json({ success: false, error: { message: 'Amount is required' } });

  const request = await HelpRequest.findByIdAndUpdate(
    req.params.requestId,
    {
      $push: {
        quotes: {
          professionalId: req.user._id,
          amount,
          message,
          estimatedDuration,
          submittedAt: new Date()
        }
      }
    },
    { new: true }
  );

  if (!request) return res.status(404).json({ success: false, error: { message: 'Request not found' } });
  const newQuote = request.quotes[request.quotes.length - 1];
  res.status(201).json({ success: true, data: newQuote });
}));

// POST /api/requests/:requestId/quotes/:quoteId/accept — requester accepts a quote
router.post('/:requestId/quotes/:quoteId/accept', protect, asyncHandler(async (req, res) => {
  const { requestId, quoteId } = req.params;

  const request = await HelpRequest.findById(requestId).populate('quotes.professionalId', 'name');
  if (!request) return res.status(404).json({ success: false, error: { message: 'Request not found' } });
  if (request.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, error: { message: 'Not authorized' } });
  }

  const quote = request.quotes.id(quoteId);
  if (!quote) return res.status(404).json({ success: false, error: { message: 'Quote not found' } });

  // Mark quote as accepted, others rejected
  request.quotes.forEach(q => { q.status = q._id.toString() === quoteId ? 'accepted' : 'rejected'; });
  request.selectedQuote = quoteId;
  request.status = 'Assigned';
  await request.save();

  // Create a task for this professional
  const Task = require('../models/Task');
  const task = await Task.create({
    requestId: request._id,
    requesterId: request.userId,
    helperId: quote.professionalId._id || quote.professionalId,
    paymentMethod: 'money',
    paymentAmount: quote.amount,
  });

  res.json({ success: true, data: { task: { taskId: task._id, ...task.toObject() } } });
}));

module.exports = router;

