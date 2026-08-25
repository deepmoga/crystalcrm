const db = require('../db/database');

const MODULES = [
    'dashboard', 'master_parts', 'planner', 'categories', 'inventory',
    'transactions', 'vendors', 'billing', 'users'
];

async function getPermissions(userId) {
    const [rows] = await db.query(`
        SELECT module, can_view, can_create, can_edit, can_delete
        FROM user_permissions WHERE user_id = ?
    `, [userId]);

    return Object.fromEntries(rows.map(row => [row.module, {
        view: Boolean(row.can_view),
        create: Boolean(row.can_create),
        edit: Boolean(row.can_edit),
        delete: Boolean(row.can_delete)
    }]));
}

async function userPayload(user) {
    const permissions = user.role === 'admin'
        ? Object.fromEntries(MODULES.map(module => [module, { view: true, create: true, edit: true, delete: true }]))
        : await getPermissions(user.id);

    return {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email || '',
        phone: user.phone || '',
        role: user.role,
        status: user.status,
        created_at: user.created_at,
        permissions
    };
}

async function requireAuth(req, res, next) {
    try {
        const userId = req.session?.userId;
        if (!userId) return res.status(401).json({ success: false, message: 'Please sign in to continue' });

        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = rows[0];
        if (!user || user.status !== 'active') {
            if (req.session) req.session.destroy(() => {});
            return res.status(401).json({ success: false, message: 'Your session is no longer active' });
        }
        req.user = user;
        next();
    } catch (err) {
        console.error('requireAuth error:', err);
        res.status(500).json({ success: false, message: 'Internal auth error' });
    }
}

function requirePermission(module, action) {
    const column = { view: 'can_view', create: 'can_create', edit: 'can_edit', delete: 'can_delete' }[action];
    if (!MODULES.includes(module) || !column) throw new Error(`Invalid permission ${module}.${action}`);

    return async (req, res, next) => {
        try {
            if (req.user.role === 'admin') return next();
            const [rows] = await db.query(`SELECT ${column} AS allowed FROM user_permissions WHERE user_id = ? AND module = ?`, [req.user.id, module]);
            const permission = rows[0];
            if (!permission?.allowed) {
                return res.status(403).json({ success: false, message: `Permission denied: ${action} access is required for ${module.replace('_', ' ')}` });
            }
            next();
        } catch (err) {
            console.error('requirePermission error:', err);
            res.status(500).json({ success: false, message: 'Permission check error' });
        }
    };
}

function requireAnyPermission(requirements) {
    return async (req, res, next) => {
        try {
            if (req.user.role === 'admin') return next();
            const [rows] = await db.query('SELECT module FROM user_permissions WHERE user_id = ? AND can_view = 1', [req.user.id]);
            const allowedModules = rows.map(r => r.module);
            if (requirements.some(module => allowedModules.includes(module))) return next();
            return res.status(403).json({ success: false, message: 'Permission denied for this data' });
        } catch (err) {
            console.error('requireAnyPermission error:', err);
            res.status(500).json({ success: false, message: 'Permission check error' });
        }
    };
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
}

module.exports = { MODULES, getPermissions, userPayload, requireAuth, requireAdmin, requirePermission, requireAnyPermission };
