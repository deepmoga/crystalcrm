const db = require('../db/database');
const bcrypt = require('bcryptjs');
const { MODULES, userPayload } = require('../middleware/auth');

async function savePermissions(userId, permissions = {}) {
    for (const module of MODULES) {
        const p = permissions[module] || {};
        await db.query(`
            INSERT INTO user_permissions (user_id, module, can_view, can_create, can_edit, can_delete)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                can_view = VALUES(can_view),
                can_create = VALUES(can_create),
                can_edit = VALUES(can_edit),
                can_delete = VALUES(can_delete)
        `, [userId, module, p.view ? 1 : 0, p.create ? 1 : 0, p.edit ? 1 : 0, p.delete ? 1 : 0]);
    }
}

exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query('SELECT * FROM users ORDER BY id ASC');
        const userList = [];
        for (const u of users) {
            userList.push(await userPayload(u));
        }
        res.json({ success: true, count: userList.length, data: userList });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
        const user = rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const payload = await userPayload(user);
        res.json({ success: true, data: payload });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch user' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { username, password, full_name, role = 'store', status = 'active', email = '', phone = '', permissions = {} } = req.body;
        if (!username || !password || !full_name) return res.status(400).json({ success: false, message: 'Username, password, and full name are required' });
        const cleanUsername = username.trim().toLowerCase();

        const [existingRows] = await db.query('SELECT id FROM users WHERE LOWER(username) = ?', [cleanUsername]);
        if (existingRows.length > 0) {
            return res.status(400).json({ success: false, message: `Username "${cleanUsername}" is already taken` });
        }

        const [result] = await db.query(
            'INSERT INTO users (username, password_hash, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [cleanUsername, bcrypt.hashSync(password, 10), full_name.trim(), email.trim(), phone.trim(), role, status]
        );
        const userId = result.insertId;
        await savePermissions(userId, permissions);

        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const created = await userPayload(rows[0]);

        res.status(201).json({ success: true, data: created, message: `User '${created.username}' created successfully` });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, message: 'Failed to create user' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
        const user = rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const { full_name, role, status, email, phone, password, permissions } = req.body;
        const nextRole = role || user.role;
        if (user.username === 'admin' && (nextRole !== 'admin' || status === 'inactive')) {
            return res.status(400).json({ success: false, message: 'Primary administrator must remain an active admin' });
        }

        await db.query(
            'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, status = ? WHERE id = ?',
            [
                full_name?.trim() || user.full_name,
                email !== undefined ? email.trim() : user.email,
                phone !== undefined ? phone.trim() : user.phone,
                nextRole,
                status || user.status,
                user.id
            ]
        );

        if (password?.trim()) {
            await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password.trim(), 10), user.id]);
        }

        if (permissions && nextRole !== 'admin') {
            await savePermissions(user.id, permissions);
        }

        const [updatedRows] = await db.query('SELECT * FROM users WHERE id = ?', [user.id]);
        const updated = await userPayload(updatedRows[0]);

        res.json({ success: true, data: updated, message: `User '${updated.username}' updated successfully` });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
        const user = rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.username === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete the primary administrator' });

        await db.query('DELETE FROM users WHERE id = ?', [user.id]);
        res.json({ success: true, message: `User '${user.username}' deleted successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
};
