require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crystal_agro_crm',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    decimalNumbers: true
};

let pool = null;

async function getPool() {
    if (pool) return pool;

    try {
        // Try creating pool directly with database
        pool = mysql.createPool(dbConfig);
        
        // Test connection
        const testConn = await pool.getConnection();
        testConn.release();
        console.log(`✓ Connected to MySQL database [${dbConfig.database}] at ${dbConfig.host}:${dbConfig.port}`);
        return pool;
    } catch (error) {
        // If database doesn't exist yet on local machine, attempt to create it
        if (error.code === 'ER_BAD_DB_ERROR') {
            try {
                const rootConn = await mysql.createConnection({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    user: dbConfig.user,
                    password: dbConfig.password
                });
                await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
                await rootConn.end();

                pool = mysql.createPool(dbConfig);
                console.log(`✓ Created & Connected to MySQL database [${dbConfig.database}]`);
                return pool;
            } catch (createErr) {
                console.error('❌ Failed to create/connect MySQL database:', createErr.message);
                throw createErr;
            }
        }
        console.error('❌ Failed to connect to MySQL database:', error.message);
        throw error;
    }
}

async function initMySQLDatabase() {
    const p = await getPool();

    // 1. Company Settings
    await p.query(`
        CREATE TABLE IF NOT EXISTS company_settings (
            id INT PRIMARY KEY DEFAULT 1,
            company_name VARCHAR(255) NOT NULL DEFAULT 'Crystal Agro Industries',
            tagline VARCHAR(255) DEFAULT 'Agricultural Machinery & Precision Parts Manufacturer',
            logo_data LONGTEXT DEFAULT NULL,
            gst_number VARCHAR(50) DEFAULT '03AAAAA0000A1Z5',
            address TEXT DEFAULT NULL,
            phone VARCHAR(50) DEFAULT '+91 98765 43210',
            email VARCHAR(150) DEFAULT 'contact@crystalagro.com',
            website VARCHAR(150) DEFAULT 'www.crystalagro.com',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure row 1 exists
    const [compRows] = await p.query('SELECT id FROM company_settings WHERE id = 1');
    if (compRows.length === 0) {
        await p.query(`
            INSERT INTO company_settings (id, company_name, tagline, logo_data, gst_number, address, phone, email, website)
            VALUES (1, 'Crystal Agro Industries', 'Agricultural Machinery & Precision Parts Manufacturer', '', '03AAAAA0000A1Z5', 'Plot No. 128, Industrial Area Phase-II, Focal Point, Ludhiana, Punjab - 141010', '+91 98765 43210', 'contact@crystalagro.com', 'www.crystalagro.com')
        `);
    }

    // 2. Users Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(150) NOT NULL,
            email VARCHAR(150) DEFAULT '',
            phone VARCHAR(50) DEFAULT '',
            role ENUM('admin', 'store', 'planner', 'vendor') NOT NULL DEFAULT 'store',
            status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. User Permissions Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS user_permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            module VARCHAR(100) NOT NULL,
            can_view TINYINT(1) DEFAULT 1,
            can_create TINYINT(1) DEFAULT 0,
            can_edit TINYINT(1) DEFAULT 0,
            can_delete TINYINT(1) DEFAULT 0,
            UNIQUE KEY unique_user_module (user_id, module),
            CONSTRAINT fk_perm_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Master Categories Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed Standard Categories
    const categories = [
        ['Engine & Drive', 'Core engine components, camshafts, crankshafts, and drive belts'],
        ['Hydraulics & Pumps', 'High pressure valves, hydraulic cylinders, and fluid pumps'],
        ['Transmission & Gears', 'Bevel gears, planetary gearsets, bearings, and shafts'],
        ['Chassis & Body Parts', 'Laser cut plates, sheet metal brackets, and welded structural chassis'],
        ['Cutting Blades & Flails', 'Hardened boron steel blades, rotary knives, and wear guards'],
        ['Coli', 'Coil components, adjustment rods and precision round bar parts'],
        ['Electrical & Sensors', 'Motors, limit switches, wiring harnesses, and sensors'],
        ['Assemblies & Sub-components', 'Pre-assembled cutter units, gearboxes, and wheel hubs']
    ];

    for (const [name, desc] of categories) {
        await p.query(`
            INSERT INTO categories (name, description) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE description = VALUES(description);
        `, [name, desc]);
    }

    // 5. Parts Catalog & Physical Inventory Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS parts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            part_code VARCHAR(100) UNIQUE NOT NULL,
            part_name VARCHAR(255) NOT NULL,
            category_id INT NOT NULL,
            unit_of_measure VARCHAR(20) DEFAULT 'Nos',
            unit_price DECIMAL(12,2) DEFAULT 0.00,
            current_stock DECIMAL(12,2) DEFAULT 0.00,
            min_stock_level DECIMAL(12,2) DEFAULT 0.00,
            location VARCHAR(100) DEFAULT '',
            description TEXT DEFAULT NULL,
            drawing_number VARCHAR(100) DEFAULT '',
            material_grade VARCHAR(100) DEFAULT '',
            diameter_mm DECIMAL(10,2) DEFAULT 0.00,
            length_mm DECIMAL(10,2) DEFAULT 0.00,
            density_g_cm3 DECIMAL(10,3) DEFAULT 7.850,
            in_inventory TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_parts_category (category_id),
            INDEX idx_parts_code (part_code),
            INDEX idx_parts_in_inventory (in_inventory),
            CONSTRAINT fk_part_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Stock Movement Transactions Log Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS stock_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            part_id INT NOT NULL,
            transaction_type ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL,
            quantity DECIMAL(12,2) NOT NULL,
            previous_stock DECIMAL(12,2) NOT NULL,
            new_stock DECIMAL(12,2) NOT NULL,
            reference_number VARCHAR(100) DEFAULT '',
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_stock_tx_part (part_id),
            INDEX idx_stock_tx_date (created_at),
            CONSTRAINT fk_tx_part FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. Vendors & Suppliers Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS vendors (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_name VARCHAR(255) NOT NULL,
            contact_person VARCHAR(150) DEFAULT '',
            email VARCHAR(150) DEFAULT '',
            phone VARCHAR(50) DEFAULT '',
            address TEXT DEFAULT NULL,
            gstin VARCHAR(50) DEFAULT '',
            payment_terms VARCHAR(100) DEFAULT '30 Days',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. Vendor Part Rates Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS vendor_parts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            vendor_id INT NOT NULL,
            part_id INT NOT NULL,
            supply_rate DECIMAL(12,2) NOT NULL,
            lead_time_days INT DEFAULT 7,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_vp_vendor FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
            CONSTRAINT fk_vp_part FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 9. Purchase Bills Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS purchase_bills (
            id INT AUTO_INCREMENT PRIMARY KEY,
            bill_number VARCHAR(100) UNIQUE NOT NULL,
            vendor_id INT NOT NULL,
            bill_date DATE NOT NULL,
            due_date DATE DEFAULT NULL,
            subtotal DECIMAL(12,2) DEFAULT 0.00,
            tax_rate DECIMAL(5,2) DEFAULT 18.00,
            tax_amount DECIMAL(12,2) DEFAULT 0.00,
            discount DECIMAL(12,2) DEFAULT 0.00,
            additional_charges DECIMAL(12,2) DEFAULT 0.00,
            total_amount DECIMAL(12,2) DEFAULT 0.00,
            status ENUM('DRAFT', 'COMPLETED', 'CANCELLED') DEFAULT 'COMPLETED',
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_pb_vendor FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 10. Purchase Bill Line Items Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS purchase_bill_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            bill_id INT NOT NULL,
            part_id INT NOT NULL,
            quantity DECIMAL(12,2) NOT NULL,
            unit_price DECIMAL(12,2) NOT NULL,
            total_price DECIMAL(12,2) NOT NULL,
            CONSTRAINT fk_pbi_bill FOREIGN KEY (bill_id) REFERENCES purchase_bills (id) ON DELETE CASCADE,
            CONSTRAINT fk_pbi_part FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 11. Material Planner Calculations History Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS planner_calculations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            part_id INT NOT NULL,
            target_quantity INT NOT NULL,
            total_length_mm DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            estimated_weight_kg DECIMAL(12,3) NOT NULL DEFAULT 0.000,
            created_by_user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_planner_part FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE RESTRICT,
            CONSTRAINT fk_planner_user FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 12. Machines & Assemblies Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS machines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            machine_code VARCHAR(100) UNIQUE NOT NULL,
            machine_name VARCHAR(255) NOT NULL,
            model_number VARCHAR(100) DEFAULT '',
            description TEXT DEFAULT NULL,
            total_built INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 13. Machine BOM Items Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS bom_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            machine_id INT NOT NULL,
            part_id INT NOT NULL,
            required_quantity DECIMAL(12,2) NOT NULL,
            notes TEXT DEFAULT NULL,
            CONSTRAINT fk_bom_machine FOREIGN KEY (machine_id) REFERENCES machines (id) ON DELETE CASCADE,
            CONSTRAINT fk_bom_part FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 14. Machine Build History Table
    await p.query(`
        CREATE TABLE IF NOT EXISTS machine_builds (
            id INT AUTO_INCREMENT PRIMARY KEY,
            machine_id INT NOT NULL,
            quantity_built INT NOT NULL,
            build_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            built_by VARCHAR(100) DEFAULT 'Admin',
            notes TEXT DEFAULT NULL,
            CONSTRAINT fk_build_machine FOREIGN KEY (machine_id) REFERENCES machines (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed Default Users if empty
    const [userRows] = await p.query('SELECT COUNT(*) AS count FROM users');
    if (userRows[0].count === 0) {
        console.log('Seeding initial system users in MySQL...');
        const usersToSeed = [
            { username: 'admin', pass: 'admin123', name: 'System Administrator', email: 'admin@crystalagro.com', phone: '+91 98765 00000', role: 'admin' },
            { username: 'store', pass: 'store123', name: 'Store Manager', email: 'store@crystalagro.com', phone: '+91 98765 11111', role: 'store' },
            { username: 'planner', pass: 'planner123', name: 'Production Planner', email: 'planner@crystalagro.com', phone: '+91 98765 22222', role: 'planner' },
            { username: 'vendor', pass: 'vendor123', name: 'Vendor / Supplier', email: 'vendor@crystalagro.com', phone: '+91 98765 33333', role: 'vendor' }
        ];

        const modules = ['dashboard', 'master_parts', 'planner', 'categories', 'inventory', 'transactions', 'vendors', 'billing', 'users'];

        for (const u of usersToSeed) {
            const hash = bcrypt.hashSync(u.pass, 10);
            const [res] = await p.query(
                'INSERT INTO users (username, password_hash, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [u.username, hash, u.name, u.email, u.phone, u.role, 'active']
            );
            const userId = res.insertId;

            for (const module of modules) {
                const isAdmin = u.role === 'admin';
                const isVendor = u.role === 'vendor';
                const canView = isAdmin || (isVendor ? (module === 'billing' || module === 'vendors' || module === 'dashboard') : module !== 'users');
                const canCreate = isAdmin || (!isVendor && module !== 'users');
                const canEdit = isAdmin || (!isVendor && module !== 'users');
                const canDelete = isAdmin;

                await p.query(
                    'INSERT INTO user_permissions (user_id, module, can_view, can_create, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, module, canView ? 1 : 0, canCreate ? 1 : 0, canEdit ? 1 : 0, canDelete ? 1 : 0]
                );
            }
        }
        console.log('✓ Seeded default users (admin, store, planner, vendor) in MySQL.');
    }

    console.log('✓ MySQL Database and Tables initialized successfully.');
}

module.exports = {
    getPool,
    initMySQLDatabase,
    query: async (sql, params) => {
        const p = await getPool();
        return p.query(sql, params);
    },
    execute: async (sql, params) => {
        const p = await getPool();
        return p.execute(sql, params);
    }
};
