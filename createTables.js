const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'abugida_db',
    user: process.env.DB_USER || 'abugida_user',
    password: process.env.DB_PASSWORD,
});

async function createTables() {
    console.log('🔄 Creating database tables...\n');
    
    try {
        // Connect to database
        await pool.connect();
        console.log('✅ Connected to database\n');

        // Drop existing tables (in correct order)
        console.log('🗑️  Dropping existing tables...');
        await pool.query('DROP TABLE IF EXISTS children CASCADE');
        await pool.query('DROP TABLE IF EXISTS users CASCADE');
        await pool.query('DROP TABLE IF EXISTS otps CASCADE');
        await pool.query('DROP TABLE IF EXISTS schools CASCADE');
        await pool.query('DROP TABLE IF EXISTS "session" CASCADE');
        console.log('✅ Old tables dropped\n');

        // Create users table
        console.log('📝 Creating users table...');
        await pool.query(`
            CREATE TABLE users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                google_id VARCHAR(255) UNIQUE,
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                password_salt VARCHAR(255),
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                profile_picture TEXT,
                phone VARCHAR(20) UNIQUE,
                auth_method VARCHAR(20) NOT NULL DEFAULT 'manual',
                is_complete BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ users table created\n');

        // Create children table
        console.log('📝 Creating children table...');
        await pool.query(`
            CREATE TABLE children (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                full_name VARCHAR(200) NOT NULL,
                date_of_birth DATE,
                grade VARCHAR(10) NOT NULL,
                school_name VARCHAR(200) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ children table created\n');

        // Create otps table
        console.log('📝 Creating otps table...');
        await pool.query(`
            CREATE TABLE otps (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(20) NOT NULL,
                otp VARCHAR(6) NOT NULL,
                expiry TIMESTAMP NOT NULL,
                attempts INTEGER DEFAULT 0,
                verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ otps table created\n');

        // Create schools table
        console.log('📝 Creating schools table...');
        await pool.query(`
            CREATE TABLE schools (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ schools table created\n');

        // Create session table
        console.log('📝 Creating session table...');
        await pool.query(`
            CREATE TABLE "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL,
                CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
            )
        `);
        console.log('✅ session table created\n');

        // Create indexes
        console.log('📝 Creating indexes...');
        await pool.query('CREATE INDEX idx_users_email ON users(email)');
        await pool.query('CREATE INDEX idx_users_phone ON users(phone)');
        await pool.query('CREATE INDEX idx_children_user_id ON children(user_id)');
        await pool.query('CREATE INDEX idx_otps_phone ON otps(phone)');
        await pool.query('CREATE INDEX "IDX_session_expire" ON "session" ("expire")');
        console.log('✅ Indexes created\n');

        // Enable UUID extension if not exists
        console.log('📝 Enabling pgcrypto extension...');
        await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
        console.log('✅ pgcrypto enabled\n');

        console.log('========================================');
        console.log('✅ All tables created successfully!');
        console.log('========================================');
        console.log('\nTables created:');
        console.log('  - users');
        console.log('  - children');
        console.log('  - otps');
        console.log('  - schools');
        console.log('  - session');

    } catch (error) {
        console.error('❌ Error creating tables:', error);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the function
createTables();
