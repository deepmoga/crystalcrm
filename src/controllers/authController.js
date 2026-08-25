const db = require('../db/database');
const bcrypt = require('bcryptjs');
const { userPayload } = require('../middleware/auth');

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const [rows] = await db.query('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: 'Account is deactivated. Please contact an administrator.' });
        }

        const isMatch = bcrypt.compareSync(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        req.session.userId = user.id;

        const payload = await userPayload(user);

        res.json({
            success: true,
            message: `Welcome back, ${user.full_name}!`,
            user: payload
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during login' });
    }
};

exports.getCurrentUser = async (req, res) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const payload = await userPayload(user);

        res.json({
            success: true,
            user: payload
        });
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user profile' });
    }
};

exports.logout = (req, res) => {
    req.session?.destroy(() => res.json({ success: true, message: 'Logged out successfully' }));
};

// PUT /api/auth/profile - Update current user profile
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { full_name, email, phone } = req.body;
        if (!full_name || !full_name.trim()) {
            return res.status(400).json({ success: false, message: 'Full name is required' });
        }

        await db.query(`
            UPDATE users
            SET full_name = ?,
                email = ?,
                phone = ?
            WHERE id = ?
        `, [full_name.trim(), (email || '').trim(), (phone || '').trim(), userId]);

        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const updatedUser = rows[0];

        const payload = await userPayload(updatedUser);

        res.json({
            success: true,
            user: payload,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
};

// POST /api/auth/change-password - Change current user password
exports.changePassword = async (req, res) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: 'Current password and new password are required' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
        }

        if (confirm_password && new_password !== confirm_password) {
            return res.status(400).json({ success: false, message: 'New passwords do not match' });
        }

        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = bcrypt.compareSync(current_password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        const newHash = bcrypt.hashSync(new_password, 10);
        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

        res.json({
            success: true,
            message: 'Password changed successfully!'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Failed to change password' });
    }
};
