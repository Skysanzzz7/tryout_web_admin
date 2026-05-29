const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const verifyToken = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Routes
router.get('/', questionController.getQuestionsByPackage);
router.get('/:id', questionController.getQuestionById);
router.post('/', questionController.createQuestion);
router.put('/:id', questionController.updateQuestion);
router.delete('/:id', questionController.deleteQuestion);

module.exports = router;