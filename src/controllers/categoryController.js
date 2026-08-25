const db = require('../db/database');

exports.getAllCategories = async (req, res) => {
    try {
        const [categories] = await db.query(`
            SELECT c.*, COUNT(p.id) AS parts_count
            FROM categories c
            LEFT JOIN parts p ON p.category_id = c.id
            GROUP BY c.id, c.name, c.description, c.created_at
            ORDER BY c.name ASC
        `);

        res.json({ success: true, data: categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }

        const [result] = await db.query('INSERT INTO categories (name, description) VALUES (?, ?)', [name.trim(), description || '']);
        const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);

        res.status(201).json({ success: true, data: rows[0], message: 'Category created successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Category name already exists' });
        }
        console.error('Error creating category:', error);
        res.status(500).json({ success: false, message: 'Failed to create category' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }

        const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
        const existing = rows[0];
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        await db.query(
            'UPDATE categories SET name = ?, description = ? WHERE id = ?',
            [name.trim(), description !== undefined ? description : existing.description, id]
        );

        const [updatedRows] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
        res.json({ success: true, data: updatedRows[0], message: 'Category updated successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'A category with this name already exists' });
        }
        console.error('Error updating category:', error);
        res.status(500).json({ success: false, message: 'Failed to update category' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
        const existing = rows[0];
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        // Check if parts are assigned to this category
        const [partsCountRows] = await db.query('SELECT COUNT(*) AS count FROM parts WHERE category_id = ?', [id]);
        const partsAssigned = partsCountRows[0].count;
        if (partsAssigned > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category "${existing.name}" because it is currently assigned to ${partsAssigned} part(s). Please reassign or delete the parts first.`
            });
        }

        await db.query('DELETE FROM categories WHERE id = ?', [id]);
        res.json({ success: true, message: `Category "${existing.name}" deleted successfully` });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
};
