const db = require('./database');
const bcrypt = require('bcryptjs');

function seedDatabase() {
    console.log('Seeding initial Crystal Agro CRM database...');

    // 1. Seed Default Users if not exists
    const usersToSeed = [
        {
            username: 'admin',
            password: 'admin123',
            full_name: 'System Administrator',
            role: 'admin',
            can_add: 1,
            can_edit: 1,
            can_delete: 1
        },
        {
            username: 'store',
            password: 'store123',
            full_name: 'Vikram Singh (Store Mgr)',
            role: 'store',
            can_add: 1,
            can_edit: 1,
            can_delete: 0
        },
        {
            username: 'planner',
            password: 'planner123',
            full_name: 'Gurpreet Kaur (Planner)',
            role: 'planner',
            can_add: 1,
            can_edit: 1,
            can_delete: 0
        },
        {
            username: 'vendor',
            password: 'vendor123',
            full_name: 'Rajesh Sharma (Supplier)',
            role: 'vendor',
            can_add: 0,
            can_edit: 0,
            can_delete: 0
        }
    ];

    for (const u of usersToSeed) {
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
        if (!existing) {
            const hash = bcrypt.hashSync(u.password, 10);
            db.prepare(`
                INSERT INTO users (username, password_hash, full_name, role, can_add, can_edit, can_delete, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
            `).run(u.username, hash, u.full_name, u.role, u.can_add, u.can_edit, u.can_delete);
            console.log(`Seeded user: ${u.username} (${u.role})`);
        }
    }

    // Migrate/seed section-wise permissions from the legacy global flags.
    const modules = ['dashboard', 'master_parts', 'planner', 'categories', 'inventory', 'transactions', 'vendors', 'billing', 'users'];
    const insertPermission = db.prepare(`
        INSERT OR IGNORE INTO user_permissions
        (user_id, module, can_view, can_create, can_edit, can_delete)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const allUsers = db.prepare('SELECT id, role, can_add, can_edit, can_delete FROM users').all();
    const seedPermissions = db.transaction(() => {
        for (const user of allUsers) {
            for (const module of modules) {
                const isAdmin = user.role === 'admin';
                const canView = isAdmin || module !== 'users';
                insertPermission.run(
                    user.id,
                    module,
                    canView ? 1 : 0,
                    isAdmin ? 1 : (module === 'users' ? 0 : user.can_add),
                    isAdmin ? 1 : (module === 'users' ? 0 : user.can_edit),
                    isAdmin ? 1 : (module === 'users' ? 0 : user.can_delete)
                );
            }
        }
    });
    seedPermissions();

    // 2. Seed Categories
    const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get().count;
    if (categoryCount === 0) {
        const insertCategory = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
        const categories = [
            ['Raw Materials', 'Round bars, MS shafts, sheets, structural steel, and pipes'],
            ['Coli', 'Coil components, adjustment rods and precision round bar parts'],
            ['Fasteners & Hardware', 'Bolts, nuts, washers, studs, keys, and pins'],
            ['Machined Parts', 'Precision gears, pulleys, sprockets, bushings, and hubs'],
            ['Hydraulics & Seals', 'O-rings, hydraulic fittings, hoses, seals, and valves'],
            ['Electrical & Sensors', 'Motors, limit switches, wiring harnesses, and sensors'],
            ['Assemblies & Sub-components', 'Pre-assembled cutter units, gearboxes, and wheel hubs']
        ];

        for (const cat of categories) {
            insertCategory.run(cat[0], cat[1]);
        }
        console.log('Seeded Categories.');
    }

    // Ensure Coli category exists if database was already created
    const coliCheck = db.prepare('SELECT id FROM categories WHERE name = ?').get('Coli');
    if (!coliCheck) {
        db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run('Coli', 'Coil components, adjustment rods and precision round bar parts');
    }

    // 3. Seed Company & Business Profile Settings
    db.prepare(`
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
        )
    `).run();

    const companyRecord = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
    if (!companyRecord) {
        db.prepare(`
            INSERT INTO company_settings (id, company_name, tagline, logo_data, gst_number, address, phone, email, website)
            VALUES (1, 'Crystal Agro Industries', 'Agricultural Machinery & Precision Parts Manufacturer', '', '03AAAAA0000A1Z5', 'Plot No. 128, Industrial Area Phase-II, Focal Point, Ludhiana, Punjab - 141010', '+91 98765 43210', 'contact@crystalagro.com', 'www.crystalagro.com')
        `).run();
        console.log('Seeded default Company Settings.');
    }

    // Ensure users table has email and phone columns
    try { db.prepare('ALTER TABLE users ADD COLUMN email TEXT DEFAULT ""').run(); } catch(e) {}
    try { db.prepare('ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ""').run(); } catch(e) {}

    console.log('Database initialization complete (Clean state with 0 dummy parts).');
}

seedDatabase();
