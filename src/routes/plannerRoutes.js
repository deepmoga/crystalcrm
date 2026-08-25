const express = require('express');
const router = express.Router();
const plannerController = require('../controllers/plannerController');
const { requirePermission } = require('../middleware/auth');

router.get('/history', requirePermission('planner', 'view'), plannerController.getHistory);
router.post('/calculations', requirePermission('planner', 'create'), plannerController.createCalculation);

module.exports = router;
