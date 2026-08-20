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
    console.log('🔄 Checking and creating database tables...\n');
    
    try {
        // Connect to database
        await pool.connect();
        console.log('✅ Connected to database\n');

        // Create users table
        console.log('📝 Checking users table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
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
        console.log('✅ users table ready\n');

        // Create children table
        console.log('📝 Checking children table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS children (
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
        console.log('✅ children table ready\n');

        // Create otps table
        console.log('📝 Checking otps table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS otps (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(20) NOT NULL,
                otp VARCHAR(6) NOT NULL,
                expiry TIMESTAMP NOT NULL,
                attempts INTEGER DEFAULT 0,
                verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ otps table ready\n');

        // Create schools table
        console.log('📝 Checking schools table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schools (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ schools table ready\n');

        // Create session table
        console.log('📝 Checking session table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL,
                CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
            )
        `);
        console.log('✅ session table ready\n');

        // Create admins table (BEFORE subscriptions since subscriptions references it)
        console.log('📝 Checking admins table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
                status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ admins table ready\n');

        // Create subscriptions table (with activation_status)
        console.log('📝 Checking subscriptions table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                plan_name VARCHAR(50) NOT NULL,
                plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'quarterly', 'semi_annual')),
                amount DECIMAL(10, 2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
                status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'expired', 'cancelled', 'pending', 'paused')),
                activation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (activation_status IN ('pending', 'active', 'paused', 'completed', 'cancelled')),
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                activated_at TIMESTAMP,
                paused_at TIMESTAMP,
                total_paused_duration INTEGER DEFAULT 0,
                original_duration_days INTEGER DEFAULT 0,
                remaining_days INTEGER,
                auto_renew BOOLEAN DEFAULT TRUE,
                activated_by UUID REFERENCES admins(id) ON DELETE SET NULL,
                paused_by UUID REFERENCES admins(id) ON DELETE SET NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ subscriptions table ready\n');

        // Create payment_transactions table
        console.log('📝 Checking payment_transactions table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS payment_transactions (
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
        console.log('✅ payment_transactions table ready\n');

        // Create webhook_events table
        console.log('📝 Checking webhook_events table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS webhook_events (
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
        console.log('✅ webhook_events table ready\n');

        // Create admin_session table
        console.log('📝 Checking admin_session table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "admin_session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL,
                CONSTRAINT "admin_session_pkey" PRIMARY KEY ("sid")
            )
        `);
        console.log('✅ admin_session table ready\n');

        // Create contact_messages table
        console.log('📝 Checking contact_messages table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contact_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL,
                subject VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ contact_messages table ready\n');

        // Create subscription_audit_log table for tracking admin actions
        console.log('📝 Checking subscription_audit_log table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscription_audit_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
                admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
                action VARCHAR(50) NOT NULL CHECK (action IN ('activate', 'pause', 'resume', 'reset', 'cancel', 'manual_add', 'bulk_activate')),
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ subscription_audit_log table ready\n');

        // Create indexes
        console.log('📝 Creating indexes...');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_children_user_id ON children(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone)');
        await pool.query('CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")');
        
        // Admin indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role)');
        
        // Subscription indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_activation ON subscriptions(activation_status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_remaining ON subscriptions(remaining_days)');
        
        // Payment transaction indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_payment_tx_ref ON payment_transactions(tx_ref)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_payment_user_id ON payment_transactions(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_transactions(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_payment_chapa_ref ON payment_transactions(chapa_ref_id)');
        
        // Webhook events indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_webhook_tx_ref ON webhook_events(tx_ref)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_webhook_chapa_ref ON webhook_events(chapa_ref_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_webhook_status ON webhook_events(status)');
        
        // Admin session index
        await pool.query('CREATE INDEX IF NOT EXISTS "IDX_admin_session_expire" ON "admin_session" ("expire")');
        
        // Contact messages index
        await pool.query('CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_messages(created_at)');
        
        // Audit log indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_subscription ON subscription_audit_log(subscription_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_admin ON subscription_audit_log(admin_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_created ON subscription_audit_log(created_at)');
        console.log('✅ Indexes ready\n');

        // Enable UUID extension if not exists
        console.log('📝 Enabling pgcrypto extension...');
        await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
        console.log('✅ pgcrypto enabled\n');

        console.log('========================================');
        console.log('✅ All tables checked and ready!');
        console.log('========================================');
        console.log('\nTables:');
        console.log('  - users');
        console.log('  - children');
        console.log('  - otps');
        console.log('  - schools');
        console.log('  - session');
        console.log('  - admins');
        console.log('  - subscriptions (with activation_status)');
        console.log('  - payment_transactions');
        console.log('  - webhook_events');
        console.log('  - admin_session');
        console.log('  - contact_messages');
        console.log('  - subscription_audit_log (new)');

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