const express = require('express');
const router = express.Router();
const purchaseBillController = require('../controllers/purchaseBillController');
const { requirePermission } = require('../middleware/auth');

router.get('/stats', requirePermission('billing', 'view'), purchaseBillController.getPurchaseStats);
router.get('/', requirePermission('billing', 'view'), purchaseBillController.getAllBills);
router.get('/:id', requirePermission('billing', 'view'), purchaseBillController.getBillById);
router.post('/', requirePermission('billing', 'create'), purchaseBillController.createBill);
router.get('/:id/pdf', requirePermission('billing', 'view'), purchaseBillController.generateBillPDF);

module.exports = router;
