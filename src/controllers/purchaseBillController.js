const db = require('../db/database');
const PDFDocument = require('pdfkit');

// Get Summary Statistics for Purchase & Billing KPI Cards
exports.getPurchaseStats = async (req, res) => {
    try {
        const [totalBillsRows] = await db.query('SELECT COUNT(*) AS count FROM purchase_bills');
        const totalBills = totalBillsRows[0].count;
        
        const [totalSpendRows] = await db.query('SELECT SUM(total_amount) AS total_val FROM purchase_bills WHERE status != "CANCELLED"');
        const totalSpend = totalSpendRows[0].total_val || 0.0;

        const [totalVendorsRows] = await db.query('SELECT COUNT(*) AS count FROM vendors');
        const totalVendors = totalVendorsRows[0].count;

        res.json({
            success: true,
            data: {
                totalBills,
                totalSpend,
                totalVendors
            }
        });
    } catch (error) {
        console.error('Error fetching purchase stats:', error);
        res.status(500).json({ success: false, message: 'Server error fetching purchase stats' });
    }
};

// Get All Purchase Bills
exports.getAllBills = async (req, res) => {
    try {
        const { search, vendor_id, start_date, end_date } = req.query;

        let query = `
            SELECT pb.*, v.company_name AS vendor_name, v.gstin AS vendor_gstin,
                   (SELECT COUNT(*) FROM purchase_bill_items WHERE bill_id = pb.id) AS item_count
            FROM purchase_bills pb
            JOIN vendors v ON pb.vendor_id = v.id
            WHERE 1=1
        `;

        const params = [];

        if (search && search.trim() !== '') {
            query += ` AND (pb.bill_number LIKE ? OR v.company_name LIKE ? OR pb.notes LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        if (vendor_id && vendor_id !== 'all') {
            query += ` AND pb.vendor_id = ?`;
            params.push(vendor_id);
        }

        if (start_date) {
            query += ` AND DATE(pb.bill_date) >= DATE(?)`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND DATE(pb.bill_date) <= DATE(?)`;
            params.push(end_date);
        }

        query += ` ORDER BY pb.bill_date DESC, pb.id DESC`;

        const [bills] = await db.query(query, params);

        res.json({ success: true, count: bills.length, data: bills });
    } catch (error) {
        console.error('Error fetching purchase bills:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch purchase bills' });
    }
};

// Get Single Purchase Bill with Line Items
exports.getBillById = async (req, res) => {
    try {
        const { id } = req.params;
        const [billRows] = await db.query(`
            SELECT pb.*, v.company_name AS vendor_name, v.contact_person, v.email, v.phone, v.address, v.gstin AS vendor_gstin
            FROM purchase_bills pb
            JOIN vendors v ON pb.vendor_id = v.id
            WHERE pb.id = ?
        `, [id]);

        const bill = billRows[0];

        if (!bill) {
            return res.status(404).json({ success: false, message: 'Purchase bill not found' });
        }

        // Fetch line items
        const [items] = await db.query(`
            SELECT pbi.*, p.part_code, p.part_name, p.unit_of_measure, p.drawing_number, p.material_grade
            FROM purchase_bill_items pbi
            JOIN parts p ON pbi.part_id = p.id
            WHERE pbi.bill_id = ?
            ORDER BY pbi.id ASC
        `, [id]);

        res.json({
            success: true,
            data: {
                ...bill,
                items
            }
        });
    } catch (error) {
        console.error('Error fetching bill details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bill details' });
    }
};

// Helper function to auto-generate unique Purchase Bill Ref Number
async function generateBillNumber() {
    const [rows] = await db.query('SELECT id FROM purchase_bills ORDER BY id DESC LIMIT 1');
    const last = rows[0];
    const nextId = last ? last.id + 1001 : 1001;
    const year = new Date().getFullYear();
    return `INV-${year}-${nextId}`;
}

// Create Purchase Bill (Atomic MySQL Transaction + Auto Inventory Stock IN)
exports.createBill = async (req, res) => {
    const pool = await db.getPool();
    const conn = await pool.getConnection();

    try {
        const {
            bill_number, vendor_id, bill_date, due_date,
            items, tax_rate, discount, additional_charges, notes
        } = req.body;

        if (!vendor_id || !items || !Array.isArray(items) || items.length === 0) {
            conn.release();
            return res.status(400).json({
                success: false,
                message: 'Vendor and at least one line item are required'
            });
        }

        const bNum = (bill_number && bill_number.trim() !== '') ? bill_number.trim().toUpperCase() : await generateBillNumber();
        const bDate = bill_date || new Date().toISOString().split('T')[0];
        const taxPercent = tax_rate !== undefined ? parseFloat(tax_rate) : 18.0;
        const discountVal = discount ? parseFloat(discount) : 0.0;
        const addCharges = additional_charges ? parseFloat(additional_charges) : 0.0;

        await conn.beginTransaction();

        // 1. Calculate Line Items Subtotal
        let subtotal = 0.0;
        const processedItems = [];

        for (const item of items) {
            const [partRows] = await conn.query('SELECT * FROM parts WHERE id = ? FOR UPDATE', [item.part_id]);
            const part = partRows[0];
            if (!part) {
                await conn.rollback();
                conn.release();
                return res.status(404).json({ success: false, message: `Part with ID ${item.part_id} not found` });
            }

            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unit_price) || 0;
            if (qty <= 0) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({ success: false, message: `Invalid Quantity for ${part.part_name}` });
            }

            const lineTotal = qty * price;
            subtotal += lineTotal;

            processedItems.push({
                part_id: item.part_id,
                part_name: part.part_name,
                part_code: part.part_code,
                quantity: qty,
                unit_price: price,
                total_price: lineTotal,
                prev_stock: parseFloat(part.current_stock) || 0
            });
        }

        const taxAmount = (subtotal - discountVal) * (taxPercent / 100.0);
        const totalAmount = (subtotal - discountVal) + taxAmount + addCharges;

        // 2. Insert Purchase Bill Header
        const [billResult] = await conn.query(`
            INSERT INTO purchase_bills (
                bill_number, vendor_id, bill_date, due_date,
                subtotal, tax_rate, tax_amount, discount, additional_charges,
                total_amount, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
        `, [
            bNum, vendor_id, bDate, due_date || null,
            subtotal, taxPercent, taxAmount, discountVal, addCharges,
            totalAmount, notes || ''
        ]);

        const billId = billResult.insertId;

        // 3. Insert Line Items AND Update Inventory Stock IN
        for (const pi of processedItems) {
            // Insert bill line item
            await conn.query(`
                INSERT INTO purchase_bill_items (bill_id, part_id, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?)
            `, [billId, pi.part_id, pi.quantity, pi.unit_price, pi.total_price]);

            // Update Master Stock
            const newStock = pi.prev_stock + pi.quantity;
            await conn.query(`
                UPDATE parts SET current_stock = current_stock + ?, in_inventory = 1 WHERE id = ?
            `, [pi.quantity, pi.part_id]);

            // Log Stock Transaction Audit Trail
            await conn.query(`
                INSERT INTO stock_transactions (part_id, transaction_type, quantity, previous_stock, new_stock, reference_number, notes)
                VALUES (?, 'IN', ?, ?, ?, ?, ?)
            `, [
                pi.part_id,
                pi.quantity,
                pi.prev_stock,
                newStock,
                bNum,
                `Purchase Bill: ${bNum}`
            ]);
        }

        await conn.commit();
        conn.release();

        res.status(201).json({
            success: true,
            data: { billId, billNumber: bNum, totalAmount },
            message: `Purchase Bill '${bNum}' created successfully! Stock IN updated for all items.`
        });

    } catch (error) {
        try { await conn.rollback(); } catch (e) {}
        conn.release();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Bill Invoice Number already exists in database' });
        }
        console.error('Error creating purchase bill:', error);
        res.status(500).json({ success: false, message: 'Server error creating purchase bill' });
    }
};

// Generate & Stream PDF Purchase Bill / Invoice
exports.generateBillPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const [billRows] = await db.query(`
            SELECT pb.*, v.company_name AS vendor_name, v.contact_person, v.email, v.phone, v.address, v.gstin AS vendor_gstin
            FROM purchase_bills pb
            JOIN vendors v ON pb.vendor_id = v.id
            WHERE pb.id = ?
        `, [id]);

        const bill = billRows[0];

        if (!bill) {
            return res.status(404).send('Bill not found');
        }

        const [items] = await db.query(`
            SELECT pbi.*, p.part_code, p.part_name, p.unit_of_measure, p.drawing_number
            FROM purchase_bill_items pbi
            JOIN parts p ON pbi.part_id = p.id
            WHERE pbi.bill_id = ?
        `, [id]);

        // Create PDF Document stream
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Purchase_Bill_${bill.bill_number}.pdf"`);

        doc.pipe(res);

        // Fetch dynamic Company Settings
        const [compRows] = await db.query('SELECT * FROM company_settings WHERE id = 1');
        const comp = compRows[0] || {
            company_name: 'CRYSTAL AGRO INDUSTRIES',
            tagline: 'Industrial Agro Machinery & Precision Parts Manufacturer',
            gst_number: '03AAAAA0000A1Z5',
            phone: '+91 98765 43210',
            email: 'contact@crystalagro.com',
            address: 'Plot No. 128, Industrial Area Phase-II, Focal Point, Ludhiana, Punjab'
        };

        // Company Header
        doc.fillColor('#1e293b').fontSize(20).font('Helvetica-Bold').text((comp.company_name || 'CRYSTAL AGRO').toUpperCase(), 40, 40);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(comp.tagline || 'Industrial Agro Machinery & Parts Manufacturer', 40, 64);
        doc.text(`GSTIN: ${comp.gst_number || 'N/A'} | Phone: ${comp.phone || 'N/A'} | ${comp.email || ''}`, 40, 76);
        if (comp.address) doc.fontSize(8).text(`Address: ${comp.address}`, 40, 88);

        doc.moveTo(40, 102).lineTo(555, 102).strokeColor('#cbd5e1').lineWidth(1).stroke();

        // Invoice Meta Box
        doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('PURCHASE INVOICE', 380, 40, { align: 'right' });
        doc.fontSize(10).font('Helvetica').fillColor('#334155');
        doc.text(`Bill Ref #: ${bill.bill_number}`, 380, 62, { align: 'right' });
        doc.text(`Bill Date: ${bill.bill_date}`, 380, 76, { align: 'right' });

        // Vendor Info Box
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('VENDOR DETAILS:', 40, 115);
        doc.fontSize(10).font('Helvetica').fillColor('#334155');
        doc.text(`Company: ${bill.vendor_name}`, 40, 130);
        doc.text(`Contact: ${bill.contact_person || 'N/A'} (${bill.phone || 'N/A'})`, 40, 144);
        doc.text(`GSTIN: ${bill.vendor_gstin || 'N/A'}`, 40, 158);
        doc.text(`Address: ${bill.address || 'N/A'}`, 40, 172);

        // Line Items Table Header
        let y = 205;
        doc.rect(40, y, 515, 24).fill('#f1f5f9');
        doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
        doc.text('PART CODE & NAME', 45, y + 7);
        doc.text('QTY', 260, y + 7, { width: 50, align: 'right' });
        doc.text('UNIT PRICE', 320, y + 7, { width: 80, align: 'right' });
        doc.text('TOTAL (₹)', 440, y + 7, { width: 105, align: 'right' });

        y += 28;
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a');

        for (const item of items) {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unit_price) || 0;
            const total = parseFloat(item.total_price) || 0;

            doc.text(`${item.part_code} - ${item.part_name}`, 45, y);
            doc.text(`${qty} ${item.unit_of_measure}`, 260, y, { width: 50, align: 'right' });
            doc.text(`₹${price.toFixed(2)}`, 320, y, { width: 80, align: 'right' });
            doc.text(`₹${total.toFixed(2)}`, 440, y, { width: 105, align: 'right' });
            y += 20;
        }

        doc.moveTo(40, y + 5).lineTo(555, y + 5).strokeColor('#e2e8f0').stroke();
        y += 15;

        // Totals Calculation Summary
        const subtotal = parseFloat(bill.subtotal) || 0;
        const discount = parseFloat(bill.discount) || 0;
        const taxAmount = parseFloat(bill.tax_amount) || 0;
        const additionalCharges = parseFloat(bill.additional_charges) || 0;
        const grandTotal = parseFloat(bill.total_amount) || 0;

        doc.fontSize(10).font('Helvetica');
        doc.text('Subtotal:', 340, y, { width: 100, align: 'right' });
        doc.text(`₹${subtotal.toFixed(2)}`, 440, y, { width: 105, align: 'right' });
        y += 16;

        if (discount > 0) {
            doc.text('Discount:', 340, y, { width: 100, align: 'right' });
            doc.text(`- ₹${discount.toFixed(2)}`, 440, y, { width: 105, align: 'right' });
            y += 16;
        }

        doc.text(`GST / Tax (${bill.tax_rate}%):`, 340, y, { width: 100, align: 'right' });
        doc.text(`₹${taxAmount.toFixed(2)}`, 440, y, { width: 105, align: 'right' });
        y += 16;

        if (additionalCharges > 0) {
            doc.text('Freight / Charges:', 340, y, { width: 100, align: 'right' });
            doc.text(`₹${additionalCharges.toFixed(2)}`, 440, y, { width: 105, align: 'right' });
            y += 16;
        }

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#10b981');
        doc.text('Grand Total:', 340, y, { width: 100, align: 'right' });
        doc.text(`₹${grandTotal.toFixed(2)}`, 440, y, { width: 105, align: 'right' });

        // Footer Note
        doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('Computer generated invoice. No signature required.', 40, 780, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Server error generating bill PDF');
    }
};
