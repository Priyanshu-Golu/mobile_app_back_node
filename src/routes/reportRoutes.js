const express = require('express');
const { createReport, getMyReports } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { validateReport } = require('../middleware/validation');

const router = express.Router();

router.use(protect);

router.post('/', validateReport, createReport);
router.get('/my-reports', getMyReports);

module.exports = router;
