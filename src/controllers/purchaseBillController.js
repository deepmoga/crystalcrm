const db = require('../db/database');
const PDFDocument = require('pdfkit');

// Get Summary Statistics for Sales & Billing KPI Cards
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
        console.error('Error fetching billing stats:', error);
        res.status(500).json({ success: false, message: 'Server error fetching billing stats' });
    }
};

// Get All Sales / Purchase Bills
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
        console.error('Error fetching sales bills:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch sales bills' });
    }
};

// Get Single Bill with Line Items
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
            return res.status(404).json({ success: false, message: 'Sales bill not found' });
        }

        // Fetch line items
        const [items] = await db.query(`
            SELECT pbi.*, p.part_code, p.part_name, p.unit_of_measure, p.drawing_number, p.material_grade, p.current_stock
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

// Helper function to auto-generate unique Invoice Number
async function generateBillNumber() {
    const [rows] = await db.query('SELECT id FROM purchase_bills ORDER BY id DESC LIMIT 1');
    const last = rows[0];
    const nextId = last ? last.id + 1001 : 1001;
    const year = new Date().getFullYear();
    return `INV-${year}-${nextId}`;
}

// Create Sales Invoice (Atomic MySQL Transaction + Auto Stock OUT Deduction)
exports.createBill = async (req, res) => {
    const pool = await db.getPool();
    const conn = await pool.getConnection();

    try {
        const {
            bill_number, vendor_id, bill_date, due_date,
            items, tax_rate, discount, additional_charges, notes, bill_type = 'SALE'
        } = req.body;

        if (!vendor_id || !items || !Array.isArray(items) || items.length === 0) {
            conn.release();
            return res.status(400).json({
                success: false,
                message: 'Vendor / Client and at least one line item are required'
            });
        }

        const bNum = (bill_number && bill_number.trim() !== '') ? bill_number.trim().toUpperCase() : await generateBillNumber();
        const bDate = bill_date || new Date().toISOString().split('T')[0];
        const taxPercent = tax_rate !== undefined ? parseFloat(tax_rate) : 18.0;
        const discountVal = discount ? parseFloat(discount) : 0.0;
        const addCharges = additional_charges ? parseFloat(additional_charges) : 0.0;

        await conn.beginTransaction();

        // 1. Validate Stock Balance & Calculate Line Items Subtotal
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

            const prevStock = parseFloat(part.current_stock) || 0;

            // Strict Stock Validation for Sales (Manufacturing Dispatch)
            if (bill_type === 'SALE' && qty > prevStock) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for "${part.part_name}" (${part.part_code}). Available Stock: ${prevStock} ${part.unit_of_measure}, but requested to sell ${qty}!`
                });
            }

            const lineTotal = qty * price;
            subtotal += lineTotal;

            processedItems.push({
                part_id: item.part_id,
                part_name: part.part_name,
                part_code: part.part_code,
                unit_of_measure: part.unit_of_measure || 'Nos',
                quantity: qty,
                unit_price: price,
                total_price: lineTotal,
                prev_stock: prevStock
            });
        }

        const taxAmount = (subtotal - discountVal) * (taxPercent / 100.0);
        const totalAmount = (subtotal - discountVal) + taxAmount + addCharges;

        // 2. Insert Invoice Header
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

        // 3. Insert Line Items AND Deduct Inventory Stock OUT
        for (const pi of processedItems) {
            // Insert bill line item
            await conn.query(`
                INSERT INTO purchase_bill_items (bill_id, part_id, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?)
            `, [billId, pi.part_id, pi.quantity, pi.unit_price, pi.total_price]);

            // Deduct Stock OUT for Sales Invoice
            const newStock = pi.prev_stock - pi.quantity;
            await conn.query(`
                UPDATE parts SET current_stock = ?, in_inventory = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `, [newStock, pi.part_id]);

            // Log Stock OUT Transaction Audit Trail
            await conn.query(`
                INSERT INTO stock_transactions (part_id, transaction_type, quantity, previous_stock, new_stock, reference_number, notes)
                VALUES (?, 'OUT', ?, ?, ?, ?, ?)
            `, [
                pi.part_id,
                pi.quantity,
                pi.prev_stock,
                newStock,
                bNum,
                `Sales Invoice Dispatch: ${bNum}`
            ]);
        }

        await conn.commit();
        conn.release();

        res.status(201).json({
            success: true,
            data: { billId, billNumber: bNum, totalAmount },
            message: `Sales Invoice '${bNum}' created successfully! Stock OUT deducted for all items.`
        });

    } catch (error) {
        try { await conn.rollback(); } catch (e) {}
        conn.release();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Invoice Number already exists in database' });
        }
        console.error('Error creating sales bill:', error);
        res.status(500).json({ success: false, message: 'Server error creating sales invoice' });
    }
};

// Generate & Stream PDF Sales Invoice / Tax Invoice
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
            return res.status(404).send('Invoice not found');
        }

        const [items] = await db.query(`
            SELECT pbi.*, p.part_code, p.part_name, p.unit_of_measure, p.drawing_number
            FROM purchase_bill_items pbi
            JOIN parts p ON pbi.part_id = p.id
            WHERE pbi.bill_id = ?
            ORDER BY pbi.id ASC
        `, [id]);

        // Create PDF Document stream
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Tax_Invoice_${bill.bill_number}.pdf"`);

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

        // Company Header (Seller)
        doc.fillColor('#1e293b').fontSize(20).font('Helvetica-Bold').text((comp.company_name || 'CRYSTAL AGRO').toUpperCase(), 40, 40);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(comp.tagline || 'Industrial Agro Machinery & Precision Parts Manufacturer', 40, 64);
        doc.text(`GSTIN: ${comp.gst_number || 'N/A'} | Phone: ${comp.phone || 'N/A'} | ${comp.email || ''}`, 40, 76);
        if (comp.address) doc.fontSize(8).text(`Factory / Office: ${comp.address}`, 40, 88);

        doc.moveTo(40, 102).lineTo(555, 102).strokeColor('#cbd5e1').lineWidth(1).stroke();

        // Invoice Meta Box
        doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('TAX INVOICE / SALES BILL', 320, 40, { align: 'right' });
        doc.fontSize(10).font('Helvetica').fillColor('#334155');
        doc.text(`Invoice Ref #: ${bill.bill_number}`, 320, 62, { align: 'right' });
        doc.text(`Invoice Date: ${bill.bill_date}`, 320, 76, { align: 'right' });

        // Buyer / Consignee Details
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('BILLED TO / BUYER DETAILS:', 40, 115);
        doc.fontSize(10).font('Helvetica').fillColor('#334155');
        doc.text(`Customer / Vendor: ${bill.vendor_name}`, 40, 130);
        doc.text(`Contact: ${bill.contact_person || 'N/A'} (${bill.phone || 'N/A'})`, 40, 144);
        doc.text(`GSTIN: ${bill.vendor_gstin || 'N/A'}`, 40, 158);
        doc.text(`Delivery Address: ${bill.address || 'N/A'}`, 40, 172);

        // Line Items Table Header
        let y = 205;
        doc.rect(40, y, 515, 24).fill('#f1f5f9');
        doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
        doc.text('DESCRIPTION OF GOODS / PART', 45, y + 7);
        doc.text('QTY DISPATCHED', 250, y + 7, { width: 70, align: 'right' });
        doc.text('RATE (₹)', 330, y + 7, { width: 70, align: 'right' });
        doc.text('AMOUNT (₹)', 430, y + 7, { width: 115, align: 'right' });

        y += 28;
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a');

        for (const item of items) {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unit_price) || 0;
            const total = parseFloat(item.total_price) || 0;

            doc.text(`${item.part_code} - ${item.part_name}`, 45, y);
            doc.text(`${qty} ${item.unit_of_measure}`, 250, y, { width: 70, align: 'right' });
            doc.text(`₹${price.toFixed(2)}`, 330, y, { width: 70, align: 'right' });
            doc.text(`₹${total.toFixed(2)}`, 430, y, { width: 115, align: 'right' });
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

        // Terms & Footer Note
        doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('1. Goods once sold will not be taken back or exchanged. 2. Subject to Ludhiana Jurisdiction.', 40, 755);
        doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('Computer generated Tax Invoice. No signature required.', 40, 780, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Server error generating Tax Invoice PDF');
    }
};
