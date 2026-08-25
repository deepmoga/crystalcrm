const db = require('../db/database');

// Get overall Inventory statistics for KPI Dashboard cards
exports.getInventoryStats = async (req, res) => {
    try {
        const [totalMasterPartsRows] = await db.query('SELECT COUNT(*) AS count FROM parts');
        const totalMasterParts = totalMasterPartsRows[0].count;

        const [totalPartsRows] = await db.query('SELECT COUNT(*) AS count FROM parts WHERE in_inventory = 1');
        const totalParts = totalPartsRows[0].count;
        
        const [totalValueRows] = await db.query('SELECT SUM(current_stock * unit_price) AS total_val FROM parts WHERE in_inventory = 1');
        const totalStockValue = totalValueRows[0].total_val || 0.0;

        const [lowStockRows] = await db.query('SELECT COUNT(*) AS count FROM parts WHERE in_inventory = 1 AND current_stock <= min_stock_level');
        const lowStockCount = lowStockRows[0].count;
        
        const [totalTxRows] = await db.query('SELECT COUNT(*) AS count FROM stock_transactions');
        const totalTransactions = totalTxRows[0].count;

        res.json({
            success: true,
            data: {
                totalMasterParts,
                totalParts,
                totalStockValue,
                lowStockCount,
                totalTransactions
            }
        });
    } catch (error) {
        console.error('Error fetching inventory stats:', error);
        res.status(500).json({ success: false, message: 'Server error fetching inventory stats' });
    }
};

// Get Parts list with search, category filtering, low stock filtering, and in_inventory filtering
exports.getAllParts = async (req, res) => {
    try {
        const { search, category_id, low_stock, in_inventory, sort_by, order } = req.query;

        let query = `
            SELECT p.*, c.name AS category_name,
                   (p.current_stock * p.unit_price) AS stock_value,
                   CASE 
                     WHEN p.current_stock <= 0 THEN 'OUT_OF_STOCK'
                     WHEN p.current_stock <= p.min_stock_level THEN 'LOW_STOCK'
                     ELSE 'IN_STOCK'
                   END AS stock_status
            FROM parts p
            JOIN categories c ON p.category_id = c.id
            WHERE 1=1
        `;

        const params = [];

        if (search && search.trim() !== '') {
            query += ` AND (p.part_name LIKE ? OR p.part_code LIKE ? OR p.drawing_number LIKE ? OR p.material_grade LIKE ? OR p.description LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term, term);
        }

        if (category_id && category_id !== 'all') {
            query += ` AND p.category_id = ?`;
            params.push(category_id);
        }

        if (in_inventory === '1' || in_inventory === 'true') {
            query += ` AND p.in_inventory = 1`;
        } else if (in_inventory === '0' || in_inventory === 'false') {
            query += ` AND p.in_inventory = 0`;
        }

        if (low_stock === 'true') {
            query += ` AND p.in_inventory = 1 AND p.current_stock <= p.min_stock_level`;
        }

        // Sorting
        const validSortFields = ['part_code', 'part_name', 'current_stock', 'unit_price', 'created_at', 'category_name'];
        const sortField = validSortFields.includes(sort_by) ? sort_by : 'part_name';
        const sortOrder = (order && order.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

        query += ` ORDER BY ${sortField} ${sortOrder}`;

        const [parts] = await db.query(query, params);

        res.json({
            success: true,
            count: parts.length,
            data: parts
        });
    } catch (error) {
        console.error('Error fetching parts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch inventory parts' });
    }
};

// Get Single Part Details by ID
exports.getPartById = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, c.name AS category_name,
                   (p.current_stock * p.unit_price) AS stock_value
            FROM parts p
            JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
        `, [req.params.id]);

        const part = rows[0];

        if (!part) {
            return res.status(404).json({ success: false, message: 'Part not found' });
        }

        // Fetch recent transactions for this part
        const [transactions] = await db.query(`
            SELECT * FROM stock_transactions 
            WHERE part_id = ? 
            ORDER BY created_at DESC 
            LIMIT 20
        `, [req.params.id]);

        res.json({
            success: true,
            data: {
                ...part,
                transactions
            }
        });
    } catch (error) {
        console.error('Error fetching part details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch part details' });
    }
};

// Helper function to auto-generate unique Part Code if not supplied
async function generatePartCode() {
    const [rows] = await db.query('SELECT id FROM parts ORDER BY id DESC LIMIT 1');
    const lastPart = rows[0];
    const nextId = lastPart ? lastPart.id + 1001 : 1001;
    return `PRT-${nextId}`;
}

// Create New Master Part
exports.createPart = async (req, res) => {
    try {
        const {
            part_code, part_name, category_id, drawing_number, material_grade,
            diameter, length, specifications, unit_of_measure, unit_price,
            current_stock, min_stock_level, location, in_inventory
        } = req.body;

        if (!part_name || !category_id) {
            return res.status(400).json({ success: false, message: 'Part Name and Category are required' });
        }

        const [duplicateRows] = await db.query(`
            SELECT id FROM parts
            WHERE LOWER(TRIM(part_name)) = LOWER(TRIM(?))
              AND LOWER(TRIM(COALESCE(drawing_number, ''))) = LOWER(TRIM(?))
              AND category_id = ?
            LIMIT 1
        `, [part_name, drawing_number || '', category_id]);

        if (duplicateRows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'This Master Part already exists with the same name, drawing number and category'
            });
        }

        const code = (part_code && part_code.trim() !== '') ? part_code.trim().toUpperCase() : await generatePartCode();
        const stockVal = parseFloat(current_stock) || 0.0;
        const priceVal = parseFloat(unit_price) || 0.0;
        const minStockVal = parseFloat(min_stock_level) || 5.0;
        const inInventoryFlag = in_inventory ? 1 : 0;

        const [result] = await db.query(`
            INSERT INTO parts (
                part_code, part_name, category_id, drawing_number, material_grade,
                diameter_mm, length_mm, description, unit_of_measure, unit_price,
                current_stock, min_stock_level, location, in_inventory
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            code,
            part_name.trim(),
            category_id,
            drawing_number || '',
            material_grade || '',
            parseFloat(diameter) || 0,
            parseFloat(length) || 0,
            specifications || '',
            unit_of_measure || 'Pcs',
            priceVal,
            stockVal,
            minStockVal,
            location || '',
            inInventoryFlag
        ]);

        const partId = result.insertId;

        // Log Initial Stock transaction if initial stock > 0 and in inventory
        if (stockVal > 0 && inInventoryFlag === 1) {
            await db.query(`
                INSERT INTO stock_transactions (part_id, transaction_type, quantity, previous_stock, new_stock, reference_number, notes)
                VALUES (?, 'IN', ?, 0, ?, 'INIT-CREATE', 'Opening stock on item creation')
            `, [partId, stockVal, stockVal]);
        }

        const [rows] = await db.query('SELECT * FROM parts WHERE id = ?', [partId]);
        const createdPart = rows[0];

        res.status(201).json({
            success: true,
            data: createdPart,
            message: `Part '${createdPart.part_name}' (${createdPart.part_code}) created successfully`
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Part Code already exists in database' });
        }
        console.error('Error creating part:', error);
        res.status(500).json({ success: false, message: 'Failed to create new part' });
    }
};

// Add / Assign Master Part to Physical Inventory Stock
exports.addToInventory = async (req, res) => {
    try {
        const { part_id, unit_price, current_stock, min_stock_level, note } = req.body;
        if (!part_id) {
            return res.status(400).json({ success: false, message: 'Part ID is required' });
        }

        const [rows] = await db.query('SELECT * FROM parts WHERE id = ?', [part_id]);
        const part = rows[0];
        if (!part) {
            return res.status(404).json({ success: false, message: 'Part not found' });
        }

        const priceVal = parseFloat(unit_price) >= 0 ? parseFloat(unit_price) : (part.unit_price || 0);
        const stockVal = parseFloat(current_stock) >= 0 ? parseFloat(current_stock) : 0;
        const minStockVal = parseFloat(min_stock_level) >= 0 ? parseFloat(min_stock_level) : (part.min_stock_level || 5);
        const noteVal = note !== undefined ? String(note).trim() : (part.description || '');

        await db.query(`
            UPDATE parts
            SET in_inventory = 1,
                unit_price = ?,
                current_stock = ?,
                min_stock_level = ?,
                description = ?
            WHERE id = ?
        `, [priceVal, stockVal, minStockVal, noteVal, part_id]);

        // Record initial stock transaction if positive stock added
        if (stockVal > 0) {
            await db.query(`
                INSERT INTO stock_transactions (part_id, transaction_type, quantity, previous_stock, new_stock, reference_number, notes)
                VALUES (?, 'IN', ?, 0, ?, 'INIT-INV', 'Opening stock on inventory assignment')
            `, [part_id, stockVal, stockVal]);
        }

        const [updatedRows] = await db.query('SELECT p.*, c.name as category_name FROM parts p JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [part_id]);
        res.json({ success: true, data: updatedRows[0], message: `Part '${part.part_name}' added to inventory stock successfully` });
    } catch (error) {
        console.error('Error adding to inventory:', error);
        res.status(500).json({ success: false, message: 'Failed to add part to inventory' });
    }
};

// Update the inventory-only fields without changing the Master Part definition.
exports.updateInventoryDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { unit_price, current_stock, min_stock_level, note } = req.body;
        const [rows] = await db.query('SELECT * FROM parts WHERE id = ?', [id]);
        const part = rows[0];
        if (!part) return res.status(404).json({ success: false, message: 'Part not found' });

        const priceVal = parseFloat(unit_price) >= 0 ? parseFloat(unit_price) : 0;
        const stockVal = parseFloat(current_stock) >= 0 ? parseFloat(current_stock) : 0;
        const minStockVal = parseFloat(min_stock_level) >= 0 ? parseFloat(min_stock_level) : 0;
        const noteVal = note !== undefined ? String(note).trim() : '';

        await db.query(`
            UPDATE parts 
            SET unit_price = ?, current_stock = ?, min_stock_level = ?, description = ?, in_inventory = 1 
            WHERE id = ?
        `, [priceVal, stockVal, minStockVal, noteVal, id]);

        res.json({ success: true, message: 'Inventory item updated successfully' });
    } catch (error) {
        console.error('Error updating inventory details:', error);
        res.status(500).json({ success: false, message: 'Failed to update inventory item' });
    }
};

// Remove Part from Inventory Tracking (keeps master part)
exports.removeFromInventory = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE parts SET in_inventory = 0 WHERE id = ?', [id]);
        res.json({ success: true, message: 'Part removed from inventory stock tracking' });
    } catch (error) {
        console.error('Error removing from inventory:', error);
        res.status(500).json({ success: false, message: 'Failed to remove part from inventory' });
    }
};

// Update Master Part
exports.updatePart = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM parts WHERE id = ?', [id]);
        const existing = rows[0];
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Part not found' });
        }

        const {
            part_name, category_id, drawing_number, material_grade,
            diameter, length, specifications, unit_of_measure, unit_price,
            min_stock_level, location, in_inventory
        } = req.body;

        await db.query(`
            UPDATE parts
            SET part_name = ?,
                category_id = ?,
                drawing_number = ?,
                material_grade = ?,
                diameter_mm = ?,
                length_mm = ?,
                description = ?,
                unit_of_measure = ?,
                unit_price = ?,
                min_stock_level = ?,
                location = ?,
                in_inventory = ?
            WHERE id = ?
        `, [
            part_name ? part_name.trim() : existing.part_name,
            category_id || existing.category_id,
            drawing_number !== undefined ? drawing_number : existing.drawing_number,
            material_grade !== undefined ? material_grade : existing.material_grade,
            diameter !== undefined ? parseFloat(diameter) : existing.diameter_mm,
            length !== undefined ? parseFloat(length) : existing.length_mm,
            specifications !== undefined ? specifications : existing.description,
            unit_of_measure || existing.unit_of_measure,
            unit_price !== undefined ? parseFloat(unit_price) : existing.unit_price,
            min_stock_level !== undefined ? parseFloat(min_stock_level) : existing.min_stock_level,
            location !== undefined ? location : existing.location,
            in_inventory !== undefined ? (in_inventory ? 1 : 0) : existing.in_inventory,
            id
        ]);

        const [updatedRows] = await db.query('SELECT * FROM parts WHERE id = ?', [id]);
        res.json({ success: true, data: updatedRows[0], message: 'Part updated successfully' });
    } catch (error) {
        console.error('Error updating part:', error);
        res.status(500).json({ success: false, message: 'Failed to update part' });
    }
};

// Delete Master Part
exports.deletePart = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM parts WHERE id = ?', [id]);
        const part = rows[0];
        if (!part) {
            return res.status(404).json({ success: false, message: 'Part not found' });
        }

        await db.query('DELETE FROM parts WHERE id = ?', [id]);
        res.json({ success: true, message: `Part '${part.part_name}' deleted successfully` });
    } catch (error) {
        console.error('Error deleting part:', error);
        res.status(500).json({ success: false, message: 'Failed to delete part. It may be linked to transaction or bill history.' });
    }
};
