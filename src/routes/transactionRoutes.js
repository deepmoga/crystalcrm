const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { requirePermission, requireAnyPermission } = require('../middleware/auth');

router.get('/', requireAnyPermission(['dashboard', 'transactions']), transactionController.getAllTransactions);
router.post('/', requirePermission('inventory', 'create'), transactionController.createTransaction);

module.exports = router;
