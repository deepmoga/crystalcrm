require('dotenv').config();
const app = require('./src/app');
const db = require('./src/db/database');

const PORT = process.env.PORT || 5000;
const DB_NAME = process.env.DB_NAME || 'crystal_agro_crm';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '3306';

async function startServer() {
    try {
        // Initialize MySQL Database & Tables (Auto-creates if not exists)
        await db.initMySQLDatabase();

        app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`  Crystal Agro CRM Server running on port ${PORT}`);
            console.log(`  Access Application: http://localhost:${PORT}`);
            console.log(`  MySQL Database: [${DB_NAME}] on ${DB_HOST}:${DB_PORT}`);
            console.log(`  phpMyAdmin URL: http://localhost/phpmyadmin`);
            console.log(`=======================================================`);
        });
    } catch (err) {
        console.error('Fatal: Failed to initialize MySQL server:', err);
        process.exit(1);
    }
}

startServer();
