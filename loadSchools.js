const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function loadSchools() {
    const schools = fs.readFileSync('schools.txt', 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
    
    for (const school of schools) {
        await pool.query(
            'INSERT INTO schools (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
            [school]
        );
    }
    
    console.log(`✅ Loaded ${schools.length} schools`);
    await pool.end();
}

loadSchools();
