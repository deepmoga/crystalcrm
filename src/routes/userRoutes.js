const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('users', 'view'), userController.getAllUsers);
router.get('/:id', requirePermission('users', 'view'), userController.getUserById);
router.post('/', requirePermission('users', 'create'), userController.createUser);
router.put('/:id', requirePermission('users', 'edit'), userController.updateUser);
router.delete('/:id', requirePermission('users', 'delete'), userController.deleteUser);

module.exports = router;
