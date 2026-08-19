const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { Pool } = require('pg');
const connectPgSimple = require('connect-pg-simple');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== Database Connection ====================
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'abugida_db',
    user: process.env.DB_USER || 'abugida_user',
    password: process.env.DB_PASSWORD,
});

// Test database connection
pool.connect((err, client, done) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to PostgreSQL database');
    done();
});

// ==================== Middleware ====================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Session configuration with PostgreSQL store
const PgSession = connectPgSimple(session);

app.use(session({
    store: new PgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'abugida-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 7 * 24 * 60 * 60 * 1000, // 7 days default
        sameSite: 'lax'
    }
}));

// ==================== Rate Limiting ====================
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', apiLimiter);

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    message: JSON.stringify({ success: false, message: 'Too many OTP requests. Please try again later.' })
});
app.use('/api/send-otp', otpLimiter);

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: JSON.stringify({ success: false, message: 'Too many login attempts. Please try again later.' })
});
app.use('/api/login', loginLimiter);

// ==================== Helper Functions ====================
function parseEthiopianPhone(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle different formats
    if (cleaned.startsWith('0')) {
        // Format: 09XXXXXXXX → 251XXXXXXXXX
        cleaned = '251' + cleaned.substring(1);
    } else if (cleaned.startsWith('251')) {
        // Format: 251XXXXXXXXX → keep as is
        cleaned = cleaned;
    } else if (cleaned.startsWith('9') && cleaned.length === 9) {
        // Format: 9XXXXXXXX → 251XXXXXXXXX
        cleaned = '251' + cleaned;
    } else {
        return null;
    }
    
    // Validate Ethiopian phone number (251 + 9 digits)
    if (cleaned.length !== 12 || !cleaned.startsWith('251')) {
        return null;
    }
    
    return cleaned;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[<>]/g, '').trim();
}

function validateEmail(email) {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password && password.length >= 8;
}

// ==================== SMS OTP Functions ====================
async function sendSMSOTP(phone, otp) {
    try {
        const response = await fetch('https://smsethiopia.com/api/sms/send', {
            method: 'POST',
            headers: {
                'KEY': process.env.SMS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                msisdn: phone,
                text: `Your Abugida verification code is: ${otp}. Valid for 5 minutes.`
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('SMS API error:', data);
            throw new Error(data.message || 'Failed to send SMS');
        }
        
        console.log(`📱 OTP sent to ${phone}: ${otp}`);
        return true;
    } catch (error) {
        console.error('SMS sending failed:', error);
        throw error;
    }
}

// ==================== Routes ====================

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get schools list
app.get('/api/schools', async (req, res) => {
    try {
        const result = await pool.query('SELECT name FROM schools ORDER BY name ASC');
        res.json({
            success: true,
            schools: result.rows.map(row => row.name)
        });
    } catch (error) {
        console.error('Error fetching schools:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch schools' });
    }
});

// Send OTP
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        
        // Parse and validate phone
        const parsedPhone = parseEthiopianPhone(phone);
        if (!parsedPhone) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Ethiopian phone number. Format: 09XXXXXXXX or +251XXXXXXXXX'
            });
        }

        // Check if phone already registered
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE phone = $1',
            [parsedPhone]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'This phone number is already registered'
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Delete any existing OTP for this phone
        await pool.query(
            'DELETE FROM otps WHERE phone = $1',
            [parsedPhone]
        );

        // Store OTP in database
        await pool.query(
            `INSERT INTO otps (phone, otp, expiry, attempts, verified) 
             VALUES ($1, $2, $3, 0, false)`,
            [parsedPhone, otp, expiry]
        );

        // Send OTP via SMS
        try {
            await sendSMSOTP(parsedPhone, otp);
        } catch (smsError) {
            // In development, still return OTP for testing
            if (process.env.NODE_ENV === 'production') {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send OTP. Please try again.'
                });
            }
            console.log('⚠️ Development mode: SMS failed, returning OTP for testing');
        }

        res.json({
            success: true,
            message: 'OTP sent successfully',
            // Only return OTP in development mode
            demoOtp: process.env.NODE_ENV === 'production' ? undefined : otp
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP'
        });
    }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        
        const parsedPhone = parseEthiopianPhone(phone);
        if (!parsedPhone || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Phone and OTP are required'
            });
        }

        // Get OTP record
        const result = await pool.query(
            'SELECT * FROM otps WHERE phone = $1 AND verified = false',
            [parsedPhone]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No OTP found. Please send a new OTP.'
            });
        }

        const otpRecord = result.rows[0];

        // Check expiry
        if (new Date() > otpRecord.expiry) {
            await pool.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please send a new OTP.'
            });
        }

        // Check attempts
        if (otpRecord.attempts >= 3) {
            await pool.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);
            return res.status(400).json({
                success: false,
                message: 'Too many attempts. Please send a new OTP.'
            });
        }

        // Verify OTP
        if (otpRecord.otp !== otp) {
            await pool.query(
                'UPDATE otps SET attempts = attempts + 1 WHERE phone = $1',
                [parsedPhone]
            );
            const remainingAttempts = 3 - (otpRecord.attempts + 1);
            return res.status(400).json({
                success: false,
                message: `Invalid OTP. ${remainingAttempts} attempts remaining.`
            });
        }

        // Mark OTP as verified
        await pool.query(
            'UPDATE otps SET verified = true WHERE phone = $1',
            [parsedPhone]
        );

        res.json({
            success: true,
            message: 'OTP verified successfully'
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP'
        });
    }
});

// Complete Registration (after OTP verification)
app.post('/api/register', async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            phone,
            password,
            email,
            children
        } = req.body;

        // Parse phone
        const parsedPhone = parseEthiopianPhone(phone);
        if (!parsedPhone) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Ethiopian phone number'
            });
        }

        // Validate required fields
        if (!firstName || firstName.trim().length < 2) {
            return res.status(400).json({ success: false, message: 'First name is required' });
        }
        if (!lastName || lastName.trim().length < 2) {
            return res.status(400).json({ success: false, message: 'Last name is required' });
        }
        if (!validatePassword(password)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }
        if (!validateEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email address' });
        }
        if (!children || !Array.isArray(children) || children.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one child is required' });
        }

        // Verify OTP was completed
        const otpResult = await pool.query(
            'SELECT * FROM otps WHERE phone = $1 AND verified = true',
            [parsedPhone]
        );
        
        if (otpResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Phone number not verified. Please verify OTP first.'
            });
        }

        // Check if phone already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE phone = $1',
            [parsedPhone]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already registered'
            });
        }

        // Check if email exists (if provided)
        if (email) {
            const existingEmail = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );
            
            if (existingEmail.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Begin transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create user
            const userResult = await client.query(
                `INSERT INTO users (first_name, last_name, email, phone, password_hash, auth_method, is_complete)
                 VALUES ($1, $2, $3, $4, $5, 'manual', true)
                 RETURNING id, first_name, last_name, email, phone`,
                [sanitizeInput(firstName), sanitizeInput(lastName), email ? sanitizeInput(email) : null, parsedPhone, passwordHash]
            );

            const userId = userResult.rows[0].id;

            // In /api/register endpoint
for (const child of children) {
    if (!child.fullName || !child.grade || !child.schoolName) {
        throw new Error('All child fields are required');
    }
    
    await client.query(
        `INSERT INTO children (user_id, full_name, grade, school_name)
         VALUES ($1, $2, $3, $4)`,
        [userId, sanitizeInput(child.fullName), child.grade, sanitizeInput(child.schoolName)]
    );
}

            // Delete OTP record
            await client.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);

            await client.query('COMMIT');

            // Set session
            req.session.userId = userId;
            req.session.phone = parsedPhone;

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                user: userResult.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Registration failed'
        });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password, rememberMe } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Phone/email and password are required'
            });
        }

        // Determine if identifier is phone or email
        const parsedPhone = parseEthiopianPhone(identifier);
        let query;
        let params;

        if (parsedPhone) {
            query = 'SELECT * FROM users WHERE phone = $1';
            params = [parsedPhone];
        } else {
            query = 'SELECT * FROM users WHERE email = $1';
            params = [identifier];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Set session
        req.session.userId = user.id;
        req.session.phone = user.phone;

        // Set remember me cookie (7 days if checked, otherwise browser session)
        if (rememberMe) {
            req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        } else {
            req.session.cookie.expires = false; // Browser session
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
        res.clearCookie('connect.sid');
        res.json({
            success: true,
            message: 'Logout successful'
        });
    });
});

// Get current user
app.get('/api/user', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const result = await pool.query(
            `SELECT id, first_name, last_name, email, phone, created_at, updated_at
             FROM users WHERE id = $1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            // User not found - clear session
            req.session.destroy();
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
});
// Get user's children
app.get('/api/children', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const result = await pool.query(
            `SELECT id, full_name, grade, school_name, created_at
             FROM children WHERE user_id = $1 ORDER BY created_at ASC`,
            [req.session.userId]
        );

        res.json({
            success: true,
            children: result.rows
        });

    } catch (error) {
        console.error('Get children error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch children'
        });
    }
});

// Add child
app.post('/api/children', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const { fullName, grade, schoolName } = req.body;

        if (!fullName || !grade || !schoolName) {
            return res.status(400).json({
                success: false,
                message: 'Full name, grade, and school are required'
            });
        }

        const result = await pool.query(
            `INSERT INTO children (user_id, full_name, grade, school_name)
             VALUES ($1, $2, $3, $4)
             RETURNING id, full_name, grade, school_name`,
            [req.session.userId, sanitizeInput(fullName), grade, sanitizeInput(schoolName)]
        );

        res.status(201).json({
            success: true,
            message: 'Child added successfully',
            child: result.rows[0]
        });

    } catch (error) {
        console.error('Add child error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add child'
        });
    }
});

// Update child
app.put('/api/children/:id', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const childId = req.params.id;
        const { fullName, grade, schoolName } = req.body;

        const result = await pool.query(
            `UPDATE children 
             SET full_name = $1, grade = $2, school_name = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 AND user_id = $5
             RETURNING id, full_name, grade, school_name`,
            [sanitizeInput(fullName), grade, sanitizeInput(schoolName), childId, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Child not found'
            });
        }

        res.json({
            success: true,
            message: 'Child updated successfully',
            child: result.rows[0]
        });

    } catch (error) {
        console.error('Update child error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update child'
        });
    }
});

// Delete child
app.delete('/api/children/:id', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const childId = req.params.id;

        const result = await pool.query(
            'DELETE FROM children WHERE id = $1 AND user_id = $2 RETURNING id',
            [childId, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Child not found'
            });
        }

        res.json({
            success: true,
            message: 'Child deleted successfully'
        });

    } catch (error) {
        console.error('Delete child error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete child'
        });
    }
});

// Update user profile
app.put('/api/user', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const { firstName, lastName, email } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'First name and last name are required'
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address'
            });
        }

        const result = await pool.query(
            `UPDATE users 
             SET first_name = $1, last_name = $2, email = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING id, first_name, last_name, email, phone`,
            [sanitizeInput(firstName), sanitizeInput(lastName), email ? sanitizeInput(email) : null, req.session.userId]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

// Forgot Password - Send OTP
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { phone } = req.body;
        const parsedPhone = parseEthiopianPhone(phone);
        if (!parsedPhone) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Ethiopian phone number'
            });
        }

        // Check if user exists
        const userResult = await pool.query('SELECT id FROM users WHERE phone = $1', [parsedPhone]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No account found with this phone number'
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        await pool.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);
        await pool.query(
            `INSERT INTO otps (phone, otp, expiry, attempts, verified) VALUES ($1, $2, $3, 0, false)`,
            [parsedPhone, otp, expiry]
        );

        try {
            await sendSMSOTP(parsedPhone, otp);
        } catch (smsError) {
            if (process.env.NODE_ENV === 'production') {
                return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
            }
            console.log('⚠️ Development mode: SMS failed, returning OTP for testing');
        }

        res.json({
            success: true,
            message: 'OTP sent successfully',
            demoOtp: process.env.NODE_ENV === 'production' ? undefined : otp
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Failed to process request' });
    }
});

// Forgot Password - Verify OTP & Reset Password
app.post('/api/reset-password', async (req, res) => {
    try {
        const { phone, otp, newPassword } = req.body;
        const parsedPhone = parseEthiopianPhone(phone);
        if (!parsedPhone || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: 'Phone, OTP, and new password are required' });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }

        const result = await pool.query('SELECT * FROM otps WHERE phone = $1 AND verified = false', [parsedPhone]);
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
        }

        const otpRecord = result.rows[0];
        if (new Date() > otpRecord.expiry) {
            await pool.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }
        if (otpRecord.attempts >= 3) {
            await pool.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);
            return res.status(400).json({ success: false, message: 'Too many attempts. Please request a new OTP.' });
        }
        if (otpRecord.otp !== otp) {
            await pool.query('UPDATE otps SET attempts = attempts + 1 WHERE phone = $1', [parsedPhone]);
            const remaining = 3 - (otpRecord.attempts + 1);
            return res.status(400).json({ success: false, message: `Invalid OTP. ${remaining} attempts remaining.` });
        }

        // OTP valid - update password
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE phone = $2', [passwordHash, parsedPhone]);
        await pool.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
});

// Load schools from file
app.post('/api/load-schools', async (req, res) => {
    try {
        const schoolsFile = path.join(__dirname, 'schools.txt');
        
        if (!fs.existsSync(schoolsFile)) {
            return res.status(404).json({
                success: false,
                message: 'schools.txt file not found'
            });
        }

        const schools = fs.readFileSync(schoolsFile, 'utf8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '');

        let insertedCount = 0;
        
        for (const school of schools) {
            try {
                await pool.query(
                    'INSERT INTO schools (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
                    [school]
                );
                insertedCount++;
            } catch (error) {
                console.error(`Failed to insert school: ${school}`, error);
            }
        }

        res.json({
            success: true,
            message: `Loaded ${insertedCount} schools`,
            total: schools.length
        });

    } catch (error) {
        console.error('Load schools error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load schools'
        });
    }
});

// Contact Form
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Validate inputs
        if (!name || name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Name must be at least 2 characters'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address'
            });
        }

        if (!subject || subject.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Subject must be at least 2 characters'
            });
        }

        if (!message || message.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Message must be at least 10 characters'
            });
        }

        // Save contact message to database
        const result = await pool.query(
            `INSERT INTO contact_messages (name, email, subject, message)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [sanitizeInput(name), sanitizeInput(email), sanitizeInput(subject), sanitizeInput(message)]
        );

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            contactId: result.rows[0].id
        });

    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message'
        });
    }
});

// ==================== Error Handling ====================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

// ==================== Start Server ====================
app.listen(PORT, () => {
    console.log(`🚀 Abugida server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        pool.end();
        console.log('HTTP server closed');
        process.exit(0);
    });
});
