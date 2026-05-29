const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const verifyToken = require('../middleware/auth');

router.use(verifyToken);

// Export routes
router.get('/results/csv', exportController.exportResultsToCSV);
router.get('/questions/:package_id/csv', exportController.exportQuestionsToCSV);

// Import route
router.post('/questions/import', exportController.upload.single('file'), exportController.importQuestionsFromCSV);

// Get template
router.get('/questions/template', exportController.getCSVTemplate);

module.exports = router;