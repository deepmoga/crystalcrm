const db = require('../db/database');

// GET /api/settings/company
exports.getCompanySettings = async (req, res) => {
    try {
        let [rows] = await db.query('SELECT * FROM company_settings WHERE id = 1');
        let settings = rows[0];

        if (!settings) {
            await db.query(`
                INSERT INTO company_settings (id, company_name, tagline, logo_data, gst_number, address, phone, email, website)
                VALUES (1, 'Crystal Agro Industries', 'Agricultural Machinery & Precision Parts Manufacturer', '', '03AAAAA0000A1Z5', 'Plot No. 128, Industrial Area Phase-II, Focal Point, Ludhiana, Punjab - 141010', '+91 98765 43210', 'contact@crystalagro.com', 'www.crystalagro.com')
            `);
            const [newRows] = await db.query('SELECT * FROM company_settings WHERE id = 1');
            settings = newRows[0];
        }

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Error fetching company settings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch company settings' });
    }
};

// PUT /api/settings/company
exports.updateCompanySettings = async (req, res) => {
    try {
        const {
            company_name,
            tagline,
            logo_data,
            gst_number,
            address,
            phone,
            email,
            website
        } = req.body;

        if (!company_name || !company_name.trim()) {
            return res.status(400).json({ success: false, message: 'Company Name is required' });
        }

        const [rows] = await db.query('SELECT * FROM company_settings WHERE id = 1');
        const existing = rows[0];

        const nameVal = company_name.trim();
        const tagVal = tagline !== undefined ? tagline.trim() : (existing ? existing.tagline : '');
        const logoVal = logo_data !== undefined ? logo_data : (existing ? existing.logo_data : '');
        const gstVal = gst_number !== undefined ? gst_number.trim().toUpperCase() : (existing ? existing.gst_number : '');
        const addrVal = address !== undefined ? address.trim() : (existing ? existing.address : '');
        const phoneVal = phone !== undefined ? phone.trim() : (existing ? existing.phone : '');
        const emailVal = email !== undefined ? email.trim() : (existing ? existing.email : '');
        const webVal = website !== undefined ? website.trim() : (existing ? existing.website : '');

        await db.query(`
            UPDATE company_settings
            SET company_name = ?,
                tagline = ?,
                logo_data = ?,
                gst_number = ?,
                address = ?,
                phone = ?,
                email = ?,
                website = ?
            WHERE id = 1
        `, [nameVal, tagVal, logoVal, gstVal, addrVal, phoneVal, emailVal, webVal]);

        const [updatedRows] = await db.query('SELECT * FROM company_settings WHERE id = 1');

        res.json({
            success: true,
            data: updatedRows[0],
            message: 'Company business details updated successfully'
        });
    } catch (error) {
        console.error('Error updating company settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update company settings' });
    }
};
