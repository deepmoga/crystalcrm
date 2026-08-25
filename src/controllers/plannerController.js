const db = require('../db/database');

exports.getHistory = async (req, res) => {
    try {
        let query = `
            SELECT pc.id, pc.target_quantity, pc.total_length_mm, pc.estimated_weight_kg,
                   pc.created_at, p.part_name, p.part_code, p.drawing_number,
                   p.material_grade, p.diameter_mm AS diameter, p.length_mm AS length, u.full_name AS created_by,
                   u.username AS created_by_username
            FROM planner_calculations pc
            JOIN parts p ON p.id = pc.part_id
            JOIN users u ON u.id = pc.created_by_user_id
        `;
        const params = [];
        if (req.user.role !== 'admin') {
            query += ' WHERE pc.created_by_user_id = ?';
            params.push(req.user.id);
        }
        query += ' ORDER BY pc.created_at DESC, pc.id DESC LIMIT 500';
        const [records] = await db.query(query, params);
        res.json({ success: true, count: records.length, data: records });
    } catch (error) {
        console.error('Error fetching planner history:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch calculation history' });
    }
};

exports.createCalculation = async (req, res) => {
    try {
        const partId = parseInt(req.body.part_id);
        const quantity = parseInt(req.body.target_quantity);
        if (!partId || !quantity || quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Valid part and target quantity are required' });
        }
        const [rows] = await db.query('SELECT * FROM parts WHERE id = ?', [partId]);
        const part = rows[0];
        if (!part) return res.status(404).json({ success: false, message: 'Part not found' });

        const totalLengthMm = (parseFloat(part.length_mm) || 0) * quantity;
        const radius = (parseFloat(part.diameter_mm) || 0) / 2;
        const estimatedWeightKg = Math.PI * radius * radius * totalLengthMm * 0.00000785;
        
        const [result] = await db.query(`
            INSERT INTO planner_calculations
                (part_id, target_quantity, total_length_mm, estimated_weight_kg, created_by_user_id)
            VALUES (?, ?, ?, ?, ?)
        `, [partId, quantity, totalLengthMm, estimatedWeightKg, req.user.id]);

        const [createdRows] = await db.query(`
            SELECT pc.*, p.part_name, p.part_code, p.drawing_number, u.full_name AS created_by
            FROM planner_calculations pc
            JOIN parts p ON p.id = pc.part_id
            JOIN users u ON u.id = pc.created_by_user_id
            WHERE pc.id = ?
        `, [result.insertId]);

        res.status(201).json({ success: true, data: createdRows[0], message: 'Calculation saved to history' });
    } catch (error) {
        console.error('Error saving planner calculation:', error);
        res.status(500).json({ success: false, message: 'Failed to save calculation' });
    }
};
