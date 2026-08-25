const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { requirePermission } = require('../middleware/auth');

router.get('/', categoryController.getAllCategories);
router.post('/', requirePermission('categories', 'create'), categoryController.createCategory);
router.put('/:id', requirePermission('categories', 'edit'), categoryController.updateCategory);
router.delete('/:id', requirePermission('categories', 'delete'), categoryController.deleteCategory);

module.exports = router;
