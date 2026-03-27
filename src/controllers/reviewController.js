const Review = require('../models/Review');
const Task = require('../models/Task');
const User = require('../models/User');
const creditService = require('../services/creditService');

exports.createReview = async (req, res, next) => {
  try {
    req.body.reviewerId = req.user.id;
    
    const task = await Task.findById(req.body.taskId);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    if (task.status !== 'Completed') return res.status(400).json({ success: false, error: 'Can only review completed tasks' });
    
    // Determine reviewee
    if (task.requesterId.toString() === req.user.id) {
      req.body.revieweeId = task.helperId;
    } else if (task.helperId.toString() === req.user.id) {
      req.body.revieweeId = task.requesterId;
    } else {
      return res.status(401).json({ success: false, error: 'Not authorized to review this task' });
    }

    const review = await Review.create(req.body);

    // Update user average rating
    const reviews = await Review.find({ revieweeId: req.body.revieweeId });
    const totalRating = reviews.reduce((sum, item) => sum + item.rating, 0);
    const averageRating = totalRating / reviews.length;

    await User.findByIdAndUpdate(req.body.revieweeId, {
      averageRating: averageRating.toFixed(1),
      totalReviews: reviews.length
    });

    // Bonus for 5-star review
    if (req.body.rating === 5) {
      try {
        await creditService.processTransaction(req.body.revieweeId, 5, 'Bonus', '5-Star Review Received', task._id);
      } catch (e) {
        console.error('Failed to disburse bonus credits for review', e);
      }
    }

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'You have already reviewed this task' });
    }
    next(error);
  }
};

exports.getTaskReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ taskId: req.params.taskId }).populate('reviewerId', 'name profileImage');
    res.status(200).json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    next(error);
  }
};

exports.getUserReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ revieweeId: req.params.userId }).populate('reviewerId', 'name profileImage');
    res.status(200).json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    next(error);
  }
};

exports.updateReview = async (req, res, next) => {
  try {
    let review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });
    if (review.reviewerId.toString() !== req.user.id) return res.status(401).json({ success: false, error: 'Not authorized' });

    review = await Review.findByIdAndUpdate(req.params.reviewId, req.body, { new: true, runValidators: true });

    // Recalculate average rating
    const reviews = await Review.find({ revieweeId: review.revieweeId });
    const totalRating = reviews.reduce((sum, item) => sum + item.rating, 0);
    const averageRating = totalRating / reviews.length;
    await User.findByIdAndUpdate(review.revieweeId, { averageRating: averageRating.toFixed(1) });

    res.status(200).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });
    if (review.reviewerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const revieweeId = review.revieweeId;
    await review.deleteOne();

    // Recalculate average rating
    const reviews = await Review.find({ revieweeId });
    const averageRating = reviews.length > 0 ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : 0;
    await User.findByIdAndUpdate(revieweeId, { averageRating, totalReviews: reviews.length });

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
