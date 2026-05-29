const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const verifyToken = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Routes
router.get('/stats', dashboardController.getStats);

module.exports = router;