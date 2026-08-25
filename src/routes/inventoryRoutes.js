const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { requirePermission, requireAnyPermission } = require('../middleware/auth');

router.get('/stats', requireAnyPermission(['dashboard', 'inventory']), inventoryController.getInventoryStats);
router.get('/', requireAnyPermission(['dashboard', 'master_parts', 'planner', 'inventory', 'billing']), inventoryController.getAllParts);
router.get('/:id', requireAnyPermission(['master_parts', 'planner', 'inventory', 'billing']), inventoryController.getPartById);
router.post('/', requirePermission('master_parts', 'create'), inventoryController.createPart);
router.post('/add-to-inventory', requirePermission('inventory', 'create'), inventoryController.addToInventory);
router.put('/:id/inventory-details', requirePermission('inventory', 'edit'), inventoryController.updateInventoryDetails);
router.put('/:id/remove-from-inventory', requirePermission('inventory', 'delete'), inventoryController.removeFromInventory);
router.put('/:id', requirePermission('master_parts', 'edit'), inventoryController.updatePart);
router.delete('/:id', requirePermission('master_parts', 'delete'), inventoryController.deletePart);

module.exports = router;
