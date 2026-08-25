-- SQL Schema for Crystal Agro CRM

-- Enable Foreign Keys
PRAGMA foreign_keys = ON;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    can_add INTEGER DEFAULT 1,
    can_edit INTEGER DEFAULT 1,
    can_delete INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Granular per-user, per-section permissions
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id INTEGER NOT NULL,
    module TEXT NOT NULL,
    can_view INTEGER NOT NULL DEFAULT 0,
    can_create INTEGER NOT NULL DEFAULT 0,
    can_edit INTEGER NOT NULL DEFAULT 0,
    can_delete INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, module),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Parts Master Database
CREATE TABLE IF NOT EXISTS parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_code TEXT UNIQUE NOT NULL,
    part_name TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    drawing_number TEXT DEFAULT '',
    material_grade TEXT DEFAULT '',
    diameter REAL DEFAULT 0,
    length REAL DEFAULT 0,
    specifications TEXT DEFAULT '',
    unit_of_measure TEXT DEFAULT 'Pcs',
    unit_price REAL DEFAULT 0.0,
    current_stock REAL DEFAULT 0.0,
    min_stock_level REAL DEFAULT 5.0,
    location TEXT DEFAULT '',
    in_inventory INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- Inventory Stock Transactions Table
CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER NOT NULL,
    type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
    quantity REAL NOT NULL,
    previous_stock REAL NOT NULL,
    new_stock REAL NOT NULL,
    reference_number TEXT DEFAULT '',
    reason TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_by TEXT DEFAULT 'Admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
);

-- Vendors Table (Schema ready for Phase 2)
CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    contact_person TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    gstin TEXT DEFAULT '',
    payment_terms TEXT DEFAULT '30 Days',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Part Rates Table (Schema ready for Phase 2)
CREATE TABLE IF NOT EXISTS vendor_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    supply_rate REAL NOT NULL,
    lead_time_days INTEGER DEFAULT 7,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
);

-- Material Planner calculation audit history
CREATE TABLE IF NOT EXISTS planner_calculations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER NOT NULL,
    target_quantity INTEGER NOT NULL,
    total_length_mm REAL NOT NULL DEFAULT 0,
    estimated_weight_kg REAL NOT NULL DEFAULT 0,
    created_by_user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Purchase Bills Table (Schema ready for Phase 2)
CREATE TABLE IF NOT EXISTS purchase_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT UNIQUE NOT NULL,
    vendor_id INTEGER NOT NULL,
    bill_date DATE NOT NULL,
    due_date DATE,
    subtotal REAL DEFAULT 0.0,
    tax_rate REAL DEFAULT 18.0,
    tax_amount REAL DEFAULT 0.0,
    discount REAL DEFAULT 0.0,
    additional_charges REAL DEFAULT 0.0,
    total_amount REAL DEFAULT 0.0,
    status TEXT CHECK(status IN ('DRAFT', 'COMPLETED', 'CANCELLED')) DEFAULT 'COMPLETED',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT
);

-- Purchase Bill Line Items (Schema ready for Phase 2)
CREATE TABLE IF NOT EXISTS purchase_bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY (bill_id) REFERENCES purchase_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT
);

-- Machines Table (Schema ready for Phase 3)
CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_code TEXT UNIQUE NOT NULL,
    machine_name TEXT NOT NULL,
    model_number TEXT DEFAULT '',
    description TEXT DEFAULT '',
    total_built INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Machine BOM Items (Schema ready for Phase 3)
CREATE TABLE IF NOT EXISTS bom_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    required_quantity REAL NOT NULL,
    notes TEXT DEFAULT '',
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT
);

-- Machine Build History Table (Schema ready for Phase 3)
CREATE TABLE IF NOT EXISTS machine_builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL,
    quantity_built INTEGER NOT NULL,
    build_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    built_by TEXT DEFAULT 'Admin',
    notes TEXT DEFAULT '',
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

-- Company & Business Profile Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    company_name TEXT NOT NULL DEFAULT 'Crystal Agro Industries',
    tagline TEXT DEFAULT 'Agricultural Machinery & Precision Parts Manufacturer',
    logo_data TEXT DEFAULT '',
    gst_number TEXT DEFAULT '03AAAAA0000A1Z5',
    address TEXT DEFAULT 'Plot No. 128, Industrial Area Phase-II, Focal Point, Ludhiana, Punjab - 141010',
    phone TEXT DEFAULT '+91 98765 43210',
    email TEXT DEFAULT 'contact@crystalagro.com',
    website TEXT DEFAULT 'www.crystalagro.com',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices for rapid SQL searching and filtering
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category_id);
CREATE INDEX IF NOT EXISTS idx_parts_code ON parts(part_code);
CREATE INDEX IF NOT EXISTS idx_stock_tx_part ON stock_transactions(part_id);
CREATE INDEX IF NOT EXISTS idx_stock_tx_date ON stock_transactions(created_at);
