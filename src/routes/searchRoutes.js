const express = require('express');
const router = express.Router();
const { search, searchRequests, searchProfessionals } = require('../controllers/searchController');

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Full-text and geo search for requests and professionals
 */

router.get('/', search);
router.get('/requests', searchRequests);
router.get('/professionals', searchProfessionals);

module.exports = router;
