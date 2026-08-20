const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'abugida_db',
    user: process.env.DB_USER || 'abugida_user',
    password: process.env.DB_PASSWORD,
});

async function updateSubscriptionSchema() {
    console.log('🔄 Updating subscriptions table schema...\n');
    
    try {
        await pool.connect();
        console.log('✅ Connected to database\n');

        // Add new columns
        console.log('📝 Adding activation_status column...');
        await pool.query(`
            ALTER TABLE subscriptions 
            ADD COLUMN IF NOT EXISTS activation_status VARCHAR(20) NOT NULL DEFAULT 'pending'
            CHECK (activation_status IN ('pending', 'active', 'paused', 'completed', 'cancelled'))
        `);
        console.log('✅ activation_status added\n');

        console.log('📝 Adding activated_at column...');
        await pool.query(`
            ALTER TABLE subscriptions 
            ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP
        `);
        console.log('✅ activated_at added\n');

        console.log('📝 Adding paused_at column...');
        await pool.query(`
            ALTER TABLE subscriptions 
            ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP
        `);
        console.log('✅ paused_at added\n');

        console.log('📝 Adding total_paused_duration column...');
        await pool.query(`
            ALTER TABLE subscriptions 
            ADD COLUMN IF NOT EXISTS total_paused_duration INTEGER DEFAULT 0
        `);
        console.log('✅ total_paused_duration added\n');

        console.log('📝 Adding original_duration_days column...');
        await pool.query(`
            ALTER TABLE subscriptions 
            ADD COLUMN IF NOT EXISTS original_duration_days INTEGER DEFAULT 0
        `);
        console.log('✅ original_duration_days added\n');

        console.log('📝 Adding remaining_days column...');
        await pool.query(`
            ALTER TABLE subscriptions 
            ADD COLUMN IF NOT EXISTS remaining_days INTEGER
        `);
        console.log('✅ remaining_days added\n');

        console.log('📝 Adding activated_by column...');
        await pool.query(`
            ALTER TABLE subscriptions 
            ADD COLUMN IF NOT EXISTS activated_by UUID REFERENCES admins(id)
        `);
        console.log('✅ activated_by added\n');

        console.log('📝 Adding paused_by column...');
        await pool.query(`
            ALTER TABLE subscriptions 
            ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES admins(id)
        `);
        console.log('✅ paused_by added\n');

        console.log('📝 Adding notes column...');
        await pool.query(`
            ALTER TABLE subscriptions 
            ADD COLUMN IF NOT EXISTS notes TEXT
        `);
        console.log('✅ notes added\n');

        // Update existing active subscriptions
        console.log('📝 Updating existing subscriptions...');
        await pool.query(`
            UPDATE subscriptions 
            SET activation_status = 'active',
                activated_at = start_date,
                original_duration_days = CEIL(EXTRACT(EPOCH FROM (end_date - start_date)) / 86400),
                remaining_days = CASE 
                    WHEN end_date > CURRENT_TIMESTAMP THEN 
                        CEIL(EXTRACT(EPOCH FROM (end_date - CURRENT_TIMESTAMP)) / 86400)
                    ELSE 0
                END
            WHERE activation_status = 'pending' 
              AND status = 'active'
              AND start_date IS NOT NULL
              AND end_date IS NOT NULL
        `);
        console.log('✅ Existing subscriptions updated\n');

        console.log('========================================');
        console.log('✅ Schema update complete!');
        console.log('========================================');
        console.log('\nNew columns added to subscriptions:');
        console.log('  - activation_status (pending/active/paused/completed/cancelled)');
        console.log('  - activated_at');
        console.log('  - paused_at');
        console.log('  - total_paused_duration');
        console.log('  - original_duration_days');
        console.log('  - remaining_days');
        console.log('  - activated_by');
        console.log('  - paused_by');
        console.log('  - notes');

    } catch (error) {
        console.error('❌ Error updating schema:', error);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n🔌 Database connection closed');
    }
}

updateSubscriptionSchema();