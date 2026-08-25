const db = require('../db/database');

// Get all vendors with total purchase bills count & total spent
exports.getAllVendors = async (req, res) => {
    try {
        const { search } = req.query;

        let query = `
            SELECT v.*,
                   COUNT(DISTINCT pb.id) AS total_bills,
                   COALESCE(SUM(pb.total_amount), 0.0) AS total_spent
            FROM vendors v
            LEFT JOIN purchase_bills pb ON pb.vendor_id = v.id
            WHERE 1=1
        `;

        const params = [];

        if (search && search.trim() !== '') {
            query += ` AND (v.company_name LIKE ? OR v.contact_person LIKE ? OR v.email LIKE ? OR v.gstin LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }

        query += ` GROUP BY v.id, v.company_name, v.contact_person, v.email, v.phone, v.address, v.gstin, v.payment_terms, v.created_at ORDER BY v.company_name ASC`;

        const [vendors] = await db.query(query, params);

        res.json({ success: true, count: vendors.length, data: vendors });
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch vendors list' });
    }
};

// Get single vendor details with assigned parts and purchase history
exports.getVendorById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
            SELECT v.*,
                   COUNT(DISTINCT pb.id) AS total_bills,
                   COALESCE(SUM(pb.total_amount), 0.0) AS total_spent
            FROM vendors v
            LEFT JOIN purchase_bills pb ON pb.vendor_id = v.id
            WHERE v.id = ?
            GROUP BY v.id, v.company_name, v.contact_person, v.email, v.phone, v.address, v.gstin, v.payment_terms, v.created_at
        `, [id]);

        const vendor = rows[0];

        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        // Fetch assigned parts with supply rates
        const [assignedParts] = await db.query(`
            SELECT vp.*, p.part_code, p.part_name, p.unit_of_measure, p.unit_price AS master_price, c.name AS category_name
            FROM vendor_parts vp
            JOIN parts p ON vp.part_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE vp.vendor_id = ?
            ORDER BY p.part_name ASC
        `, [id]);

        // Fetch vendor purchase bills history
        const [purchaseBills] = await db.query(`
            SELECT * FROM purchase_bills
            WHERE vendor_id = ?
            ORDER BY bill_date DESC, id DESC
            LIMIT 20
        `, [id]);

        res.json({
            success: true,
            data: {
                ...vendor,
                assignedParts,
                purchaseBills
            }
        });
    } catch (error) {
        console.error('Error fetching vendor details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch vendor details' });
    }
};

// Create new Vendor
exports.createVendor = async (req, res) => {
    try {
        const { company_name, contact_person, email, phone, address, gstin, payment_terms } = req.body;

        if (!company_name || company_name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Vendor Company Name is required' });
        }

        const [result] = await db.query(`
            INSERT INTO vendors (company_name, contact_person, email, phone, address, gstin, payment_terms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            company_name.trim(),
            contact_person || '',
            email || '',
            phone || '',
            address || '',
            gstin ? gstin.trim().toUpperCase() : '',
            payment_terms || '30 Days'
        ]);

        const [rows] = await db.query('SELECT * FROM vendors WHERE id = ?', [result.insertId]);
        const newVendor = rows[0];

        res.status(201).json({
            success: true,
            data: newVendor,
            message: `Vendor '${newVendor.company_name}' created successfully`
        });
    } catch (error) {
        console.error('Error creating vendor:', error);
        res.status(500).json({ success: false, message: 'Failed to create vendor' });
    }
};

// Update Vendor Profile
exports.updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM vendors WHERE id = ?', [id]);
        const vendor = rows[0];
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        const { company_name, contact_person, email, phone, address, gstin, payment_terms } = req.body;

        await db.query(`
            UPDATE vendors SET
                company_name = ?,
                contact_person = ?,
                email = ?,
                phone = ?,
                address = ?,
                gstin = ?,
                payment_terms = ?
            WHERE id = ?
        `, [
            company_name ? company_name.trim() : vendor.company_name,
            contact_person !== undefined ? contact_person : vendor.contact_person,
            email !== undefined ? email : vendor.email,
            phone !== undefined ? phone : vendor.phone,
            address !== undefined ? address : vendor.address,
            gstin !== undefined ? gstin.trim().toUpperCase() : vendor.gstin,
            payment_terms || vendor.payment_terms,
            id
        ]);

        const [updatedRows] = await db.query('SELECT * FROM vendors WHERE id = ?', [id]);
        res.json({ success: true, data: updatedRows[0], message: 'Vendor updated successfully' });
    } catch (error) {
        console.error('Error updating vendor:', error);
        res.status(500).json({ success: false, message: 'Failed to update vendor' });
    }
};

// Delete Vendor
exports.deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM vendors WHERE id = ?', [id]);
        const vendor = rows[0];
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        // Check if vendor has purchase bills
        const [billRows] = await db.query('SELECT COUNT(*) AS count FROM purchase_bills WHERE vendor_id = ?', [id]);
        const billCount = billRows[0].count;
        if (billCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete vendor '${vendor.company_name}' because they have ${billCount} linked purchase bills. Please delete the bills first.`
            });
        }

        await db.query('DELETE FROM vendors WHERE id = ?', [id]);
        res.json({ success: true, message: `Vendor '${vendor.company_name}' deleted successfully` });
    } catch (error) {
        console.error('Error deleting vendor:', error);
        res.status(500).json({ success: false, message: 'Failed to delete vendor' });
    }
};

// Assign or update supply rate for part to vendor
exports.assignVendorPart = async (req, res) => {
    try {
        const { id } = req.params;
        const { part_id, supply_rate, lead_time_days } = req.body;

        if (!part_id || supply_rate === undefined) {
            return res.status(400).json({ success: false, message: 'Part ID and Supply Rate are required' });
        }

        await db.query(`
            INSERT INTO vendor_parts (vendor_id, part_id, supply_rate, lead_time_days)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                supply_rate = VALUES(supply_rate),
                lead_time_days = VALUES(lead_time_days)
        `, [id, part_id, parseFloat(supply_rate), parseInt(lead_time_days) || 7]);

        res.json({ success: true, message: 'Vendor part rate updated successfully' });
    } catch (error) {
        console.error('Error assigning vendor part:', error);
        res.status(500).json({ success: false, message: 'Failed to assign part to vendor' });
    }
};
