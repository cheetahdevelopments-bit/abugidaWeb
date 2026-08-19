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
        await pool.query('DROP TABLE IF EXISTS payment_transactions CASCADE');
        await pool.query('DROP TABLE IF EXISTS subscriptions CASCADE');
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

        // Create subscriptions table
        console.log('📝 Creating subscriptions table...');
        await pool.query(`
            CREATE TABLE subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                plan_name VARCHAR(50) NOT NULL,
                plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'quarterly', 'semi_annual')),
                amount DECIMAL(10, 2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
                status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
                start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP NOT NULL,
                auto_renew BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ subscriptions table created\n');

        // Create payment_transactions table
        console.log('📝 Creating payment_transactions table...');
        await pool.query(`
            CREATE TABLE payment_transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
                tx_ref VARCHAR(100) UNIQUE NOT NULL,
                chapa_ref_id VARCHAR(100) UNIQUE,
                amount DECIMAL(10, 2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
                plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'quarterly', 'semi_annual')),
                plan_name VARCHAR(50) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
                email VARCHAR(255),
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                phone_number VARCHAR(20),
                checkout_url TEXT,
                callback_url TEXT,
                return_url TEXT,
                payment_method VARCHAR(50),
                verified_at TIMESTAMP,
                paid_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ payment_transactions table created\n');

        // Create webhook_events table for logging Chapa webhooks
        console.log('📝 Creating webhook_events table...');
        await pool.query(`
            CREATE TABLE webhook_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                event_type VARCHAR(100) NOT NULL,
                tx_ref VARCHAR(100),
                chapa_ref_id VARCHAR(100),
                payload JSONB,
                status VARCHAR(20) DEFAULT 'received',
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ webhook_events table created\n');

        // Create indexes
        console.log('📝 Creating indexes...');
        await pool.query('CREATE INDEX idx_users_email ON users(email)');
        await pool.query('CREATE INDEX idx_users_phone ON users(phone)');
        await pool.query('CREATE INDEX idx_children_user_id ON children(user_id)');
        await pool.query('CREATE INDEX idx_otps_phone ON otps(phone)');
        await pool.query('CREATE INDEX "IDX_session_expire" ON "session" ("expire")');
        
        // Subscription indexes
        await pool.query('CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id)');
        await pool.query('CREATE INDEX idx_subscriptions_status ON subscriptions(status)');
        await pool.query('CREATE INDEX idx_subscriptions_end_date ON subscriptions(end_date)');
        
        // Payment transaction indexes
        await pool.query('CREATE INDEX idx_payment_tx_ref ON payment_transactions(tx_ref)');
        await pool.query('CREATE INDEX idx_payment_user_id ON payment_transactions(user_id)');
        await pool.query('CREATE INDEX idx_payment_status ON payment_transactions(status)');
        await pool.query('CREATE INDEX idx_payment_chapa_ref ON payment_transactions(chapa_ref_id)');
        
        // Webhook events indexes
        await pool.query('CREATE INDEX idx_webhook_tx_ref ON webhook_events(tx_ref)');
        await pool.query('CREATE INDEX idx_webhook_chapa_ref ON webhook_events(chapa_ref_id)');
        await pool.query('CREATE INDEX idx_webhook_status ON webhook_events(status)');
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
        console.log('  - subscriptions');
        console.log('  - payment_transactions');
        console.log('  - webhook_events');

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