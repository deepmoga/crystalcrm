const db = require('../db/database');

// Get all inventory stock transactions (global audit log)
exports.getAllTransactions = async (req, res) => {
    try {
        const { part_id, type, search, start_date, end_date, limit } = req.query;

        let query = `
            SELECT t.*, p.part_code, p.part_name, p.unit_of_measure, c.name AS category_name
            FROM stock_transactions t
            JOIN parts p ON t.part_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE 1=1
        `;

        const params = [];

        if (part_id) {
            query += ` AND t.part_id = ?`;
            params.push(part_id);
        }

        if (type && (type === 'IN' || type === 'OUT' || type === 'ADJUSTMENT')) {
            query += ` AND t.transaction_type = ?`;
            params.push(type);
        }

        if (search && search.trim() !== '') {
            query += ` AND (p.part_name LIKE ? OR p.part_code LIKE ? OR t.reference_number LIKE ? OR t.notes LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }

        if (start_date) {
            query += ` AND DATE(t.created_at) >= DATE(?)`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND DATE(t.created_at) <= DATE(?)`;
            params.push(end_date);
        }

        const maxLimit = parseInt(limit) || 100;
        query += ` ORDER BY t.created_at DESC LIMIT ${maxLimit}`;

        const [transactions] = await db.query(query, params);

        res.json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch transaction log' });
    }
};

// Create Stock IN or Stock OUT Transaction (Atomic MySQL Transaction)
exports.createTransaction = async (req, res) => {
    const pool = await db.getPool();
    const conn = await pool.getConnection();

    try {
        const { part_id, type, quantity, reference_number, reason, notes } = req.body;

        if (!part_id || !type || !quantity || parseFloat(quantity) <= 0) {
            conn.release();
            return res.status(400).json({
                success: false,
                message: 'Part ID, valid transaction Type (IN/OUT), and Quantity (> 0) are required'
            });
        }

        if (type !== 'IN' && type !== 'OUT' && type !== 'ADJUSTMENT') {
            conn.release();
            return res.status(400).json({ success: false, message: 'Transaction Type must be either IN, OUT, or ADJUSTMENT' });
        }

        const qty = parseFloat(quantity);

        await conn.beginTransaction();

        // 1. Fetch current part state
        const [rows] = await conn.query('SELECT * FROM parts WHERE id = ? FOR UPDATE', [part_id]);
        const part = rows[0];
        if (!part) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ success: false, message: 'Part not found in inventory' });
        }

        const prevStock = parseFloat(part.current_stock) || 0;
        let newStock = prevStock;

        if (type === 'IN') {
            newStock = prevStock + qty;
        } else if (type === 'OUT') {
            if (qty > prevStock) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock! Current stock is ${prevStock}, but requested ${qty}`
                });
            }
            newStock = prevStock - qty;
        } else if (type === 'ADJUSTMENT') {
            newStock = qty;
        }

        // 2. Update Parts table current_stock
        await conn.query('UPDATE parts SET current_stock = ?, in_inventory = 1 WHERE id = ?', [newStock, part_id]);

        // 3. Insert Stock Transaction log
        const combinedNotes = reason ? (notes ? `${reason} - ${notes}` : reason) : (notes || '');
        const [txResult] = await conn.query(`
            INSERT INTO stock_transactions (
                part_id, transaction_type, quantity, previous_stock, new_stock,
                reference_number, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            part_id,
            type,
            qty,
            prevStock,
            newStock,
            reference_number || (type === 'IN' ? 'STK-IN' : 'STK-OUT'),
            combinedNotes
        ]);

        await conn.commit();
        conn.release();

        res.status(201).json({
            success: true,
            data: {
                txId: txResult.insertId,
                part_name: part.part_name,
                part_code: part.part_code,
                previous_stock: prevStock,
                new_stock: newStock,
                type,
                quantity: qty
            },
            message: `Stock ${type} processed successfully for '${part.part_name}'. New Stock Balance: ${newStock}`
        });

    } catch (error) {
        try { await conn.rollback(); } catch (e) {}
        conn.release();
        console.error('Error creating transaction:', error);
        res.status(500).json({ success: false, message: 'Server error processing transaction' });
    }
};
