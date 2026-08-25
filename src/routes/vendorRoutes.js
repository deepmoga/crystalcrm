const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('vendors', 'view'), vendorController.getAllVendors);
router.get('/:id', requirePermission('vendors', 'view'), vendorController.getVendorById);
router.post('/', requirePermission('vendors', 'create'), vendorController.createVendor);
router.put('/:id', requirePermission('vendors', 'edit'), vendorController.updateVendor);
router.delete('/:id', requirePermission('vendors', 'delete'), vendorController.deleteVendor);
router.post('/:id/parts', requirePermission('vendors', 'edit'), vendorController.assignVendorPart);

module.exports = router;
