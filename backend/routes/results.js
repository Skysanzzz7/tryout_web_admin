const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const verifyToken = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Routes
router.get('/', resultController.getAllResults);
router.get('/package/:package_id', resultController.getResultsByPackage);
router.get('/:id', resultController.getResultDetail);
router.post('/sync', resultController.syncResultFromFirebase);
router.post('/sync-latest', resultController.syncLatestResults);
router.delete('/:id', resultController.deleteResult);

module.exports = router;