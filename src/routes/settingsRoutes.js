const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/company', requireAuth, settingsController.getCompanySettings);
router.put('/company', requireAdmin, settingsController.updateCompanySettings);

module.exports = router;
