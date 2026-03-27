const express = require('express');
const {
  getDashboardStats, getAllUsers, updateUserStatus,
  getAllReports, resolveReport, verifyProfessional, getAllTasks
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(protect, adminAuth);

router.get('/stats', getDashboardStats);

router.get('/users', getAllUsers);
router.put('/users/:userId/status', updateUserStatus);

router.get('/reports', getAllReports);
router.put('/reports/:reportId/resolve', resolveReport);

router.put('/professionals/:userId/verify', verifyProfessional);

router.get('/tasks', getAllTasks);

module.exports = router;
