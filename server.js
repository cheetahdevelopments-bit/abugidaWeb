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
app.set('trust proxy', 1);
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
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? 'https://abugida.education' 
        : 'http://localhost:3000',
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// ==================== UNIVERSAL LOGGING MIDDLEWARE ====================
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent']?.substring(0, 80) || 'unknown';
    const sessionId = req.session?.id?.substring(0, 8) || 'no-session';
    const userId = req.session?.userId || 'anonymous';

    console.log('\n' + '='.repeat(80));
    console.log(`📥 [${timestamp}]`);
    console.log(`   Method:      ${method}`);
    console.log(`   URL:         ${url}`);
    console.log(`   IP:          ${ip}`);
    console.log(`   User:        ${userId} (session: ${sessionId})`);
    console.log(`   User-Agent:  ${userAgent}`);

    if (Object.keys(req.query).length > 0) {
        const safeQuery = { ...req.query };
        delete safeQuery.password;
        delete safeQuery.otp;
        delete safeQuery.token;
        console.log(`   Query:       ${JSON.stringify(safeQuery)}`);
    }

    if (req.body && Object.keys(req.body).length > 0) {
        const safeBody = { ...req.body };
        delete safeBody.password;
        delete safeBody.confirmPassword;
        delete safeBody.newPassword;
        delete safeBody.otp;
        delete safeBody.creditCard;
        delete safeBody.cardNumber;
        delete safeBody.cvv;
        console.log(`   Body:        ${JSON.stringify(safeBody, null, 2)}`);
    }

    const startTime = Date.now();
    let responseBody = '';

    const originalJson = res.json.bind(res);
    res.json = function(data) {
        responseBody = JSON.stringify(data).substring(0, 500);
        return originalJson(data);
    };

    const originalSend = res.send.bind(res);
    res.send = function(data) {
        if (typeof data === 'string') {
            responseBody = data.substring(0, 500);
        }
        return originalSend(data);
    };

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        let statusEmoji = '✅';
        if (statusCode >= 400 && statusCode < 500) statusEmoji = '⚠️';
        if (statusCode >= 500) statusEmoji = '❌';
        if (statusCode >= 300 && statusCode < 400) statusEmoji = '↪️';

        console.log(`\n📤 Response:`);
        console.log(`   Status:      ${statusEmoji} ${statusCode}`);
        console.log(`   Duration:    ${duration}ms`);
        if (responseBody) {
            console.log(`   Response:    ${responseBody}`);
        }
        console.log('='.repeat(80) + '\n');
    });

    next();
});
// ==================== PAYMENT ACTIVITY LOGGER ====================
app.use('/api/payment', (req, res, next) => {
    console.log('\n💳 PAYMENT ACTIVITY DETECTED');
    console.log(`   Action: ${req.method} ${req.originalUrl}`);
    if (req.body?.planType) {
        console.log(`   Plan Type: ${req.body.planType}`);
    }
    if (req.params?.txRef) {
        console.log(`   Transaction Ref: ${req.params.txRef}`);
    }
    next();
});
// ==================== WEBHOOK ACTIVITY LOGGER ====================
app.use('/webhook', (req, res, next) => {
    console.log('\n🔔 WEBHOOK RECEIVED');
    console.log(`   Method: ${req.method}`);
    console.log(`   Source: Chapa Payment Gateway`);
    console.log(`   Time: ${new Date().toISOString()}`);
    next();
});
// ==================== AUTH ACTIVITY LOGGER ====================
app.use(['/api/login', '/api/register', '/api/logout', '/api/forgot-password', '/api/reset-password'], (req, res, next) => {
    const action = req.originalUrl.split('/').pop().toUpperCase();
    console.log('\n🔐 AUTH ACTIVITY');
    console.log(`   Action: ${action}`);
    if (req.body?.phone) {
        const phone = req.body.phone;
        const masked = phone.length > 6 ? phone.substring(0, 3) + '***' + phone.substring(phone.length - 3) : '***';
        console.log(`   Phone: ${masked}`);
    }
    if (req.body?.email) {
        console.log(`   Email: ${req.body.email}`);
    }
    next();
});
// ==================== CHILDREN ACTIVITY LOGGER ====================
app.use('/api/children', (req, res, next) => {
    console.log('\n👨‍👩‍👧 CHILDREN ACTIVITY');
    console.log(`   Action: ${req.method} ${req.originalUrl}`);
    if (req.method === 'POST') {
        console.log(`   Adding child: ${req.body?.fullName || 'unknown'}`);
    }
    if (req.method === 'PUT') {
        console.log(`   Updating child ID: ${req.params?.id || 'unknown'}`);
    }
    if (req.method === 'DELETE') {
        console.log(`   Deleting child ID: ${req.params?.id || 'unknown'}`);
    }
    next();
});
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
        maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 7 * 24 * 60 * 60 * 1000,
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
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '251' + cleaned.substring(1);
    } else if (cleaned.startsWith('251')) {
        cleaned = cleaned;
    } else if (cleaned.startsWith('9') && cleaned.length === 9) {
        cleaned = '251' + cleaned;
    } else {
        return null;
    }
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
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password && password.length >= 8;
}

function generateTxRef(prefix = 'abugida') {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function calculateSubscriptionDates(planType) {
    const startDate = new Date();
    let endDate = new Date(startDate);
    
    switch (planType) {
        case 'monthly':
            endDate.setMonth(endDate.getMonth() + 1);
            break;
        case 'quarterly':
            endDate.setMonth(endDate.getMonth() + 3);
            break;
        case 'semi_annual':
            endDate.setMonth(endDate.getMonth() + 6);
            break;
        default:
            endDate.setMonth(endDate.getMonth() + 1);
    }
    
    return { startDate, endDate };
}

function getPlanDetails(planType) {
    const plans = {
        monthly: {
            name: 'Monthly',
            amount: 999,
            type: 'monthly'
        },
        quarterly: {
            name: 'Quarterly',
            amount: 2699,
            type: 'quarterly'
        },
        semi_annual: {
            name: 'Semi-Annual',
            amount: 4199,
            type: 'semi_annual'
        }
    };
    return plans[planType] || plans.monthly;
}
// ==================== ADMIN AUTH MIDDLEWARE ====================
function requireAdmin(req, res, next) {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, message: 'Admin authentication required' });
    }
    next();
}

function requireSuperAdmin(req, res, next) {
    if (!req.session.adminId || req.session.adminRole !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Super admin access required' });
    }
    next();
}

// ==================== Chapa Payment Functions ====================
async function initializeChapaPayment({ amount, email, firstName, lastName, phoneNumber, txRef, callbackUrl, returnUrl, planName }) {
    try {
        const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount.toString(),
                currency: 'ETB',
                email: email,
                first_name: firstName,
                last_name: lastName,
                phone_number: phoneNumber,
                tx_ref: txRef,
                callback_url: callbackUrl,
                return_url: returnUrl,
                'customization[title]': `Abugida ${planName} Subscription`,
                'customization[description]': `Payment for ${planName} subscription plan`,
                'meta[hide_receipt]': 'false'
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Chapa API error:', data);
            throw new Error(data.message || 'Failed to initialize payment');
        }
        
        return data;
    } catch (error) {
        console.error('Chapa initialization failed:', error);
        throw error;
    }
}

async function verifyChapaPayment(txRef) {
    try {
        const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${txRef}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY}`
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Chapa verify error:', data);
            throw new Error(data.message || 'Failed to verify payment');
        }
        
        return data;
    } catch (error) {
        console.error('Chapa verification failed:', error);
        throw error;
    }
}

// ==================== SMS FUNCTIONS ====================
async function sendSMS(phone, text) {
    try {
        const response = await fetch('https://smsethiopia.com/api/sms/send', {
            method: 'POST',
            headers: {
                'KEY': process.env.SMS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                msisdn: phone,
                text: text
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('SMS API error:', data);
            throw new Error(data.message || 'Failed to send SMS');
        }
        
        console.log(`📱 SMS sent to ${phone}`);
        return true;
    } catch (error) {
        console.error('SMS sending failed:', error);
        throw error;
    }
}

async function sendSMSOTP(phone, otp) {
    return sendSMS(phone, `Your Abugida verification code is: ${otp}. Valid for 5 minutes.`);
}

async function sendPaymentSuccessSMS(phone, planName, amount, endDate) {
    const formattedDate = endDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const text = `Thank you for subscribing to Abugida ${planName} plan! Payment of ETB ${amount} received. Your subscription is active until ${formattedDate}.`;
    
    return sendSMS(phone, text);
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
        const parsedPhone = parseEthiopianPhone(phone);
        if (!parsedPhone) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Ethiopian phone number. Format: 09XXXXXXXX or +251XXXXXXXXX'
            });
        }

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

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        await pool.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);
        await pool.query(
            `INSERT INTO otps (phone, otp, expiry, attempts, verified) 
             VALUES ($1, $2, $3, 0, false)`,
            [parsedPhone, otp, expiry]
        );

        try {
            await sendSMSOTP(parsedPhone, otp);
        } catch (smsError) {
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

        if (new Date() > otpRecord.expiry) {
            await pool.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please send a new OTP.'
            });
        }

        if (otpRecord.attempts >= 3) {
            await pool.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);
            return res.status(400).json({
                success: false,
                message: 'Too many attempts. Please send a new OTP.'
            });
        }

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
        const { firstName, lastName, phone, password, email, children } = req.body;

        const parsedPhone = parseEthiopianPhone(phone);
        if (!parsedPhone) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Ethiopian phone number'
            });
        }

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

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const userResult = await client.query(
                `INSERT INTO users (first_name, last_name, email, phone, password_hash, auth_method, is_complete)
                 VALUES ($1, $2, $3, $4, $5, 'manual', true)
                 RETURNING id, first_name, last_name, email, phone`,
                [sanitizeInput(firstName), sanitizeInput(lastName), email ? sanitizeInput(email) : null, parsedPhone, passwordHash]
            );

            const userId = userResult.rows[0].id;

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

            await client.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);
            await client.query('COMMIT');

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

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        req.session.userId = user.id;
        req.session.phone = user.phone;

        if (rememberMe) {
            req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;
        } else {
            req.session.cookie.expires = false;
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

        const userResult = await pool.query('SELECT id FROM users WHERE phone = $1', [parsedPhone]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No account found with this phone number'
            });
        }

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

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE phone = $2', [passwordHash, parsedPhone]);
        await pool.query('DELETE FROM otps WHERE phone = $1', [parsedPhone]);

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
});

// ==================== PAYMENT ROUTES ====================

// Initialize payment (subscription)
app.post('/api/payment/initialize', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const { planType } = req.body;
        
        if (!planType || !['monthly', 'quarterly', 'semi_annual'].includes(planType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid plan type'
            });
        }

        // Get user details
        const userResult = await pool.query(
            'SELECT id, first_name, last_name, email, phone FROM users WHERE id = $1',
            [req.session.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];
        const plan = getPlanDetails(planType);
        const txRef = generateTxRef('abugida');
        
        // Format phone for Chapa (10 digits: 09XXXXXXXX)
        const phone10 = user.phone ? user.phone.replace('251', '0') : '';
        
        const callbackUrl = process.env.CHAPA_CALLBACK_URL || 'https://chapawwebhook.duckdns.org/webhook';
        const returnUrl = `${req.protocol}://${req.get('host')}/payment/return`;
        
        // Initialize payment with Chapa
        const chapaResponse = await initializeChapaPayment({
            amount: plan.amount,
            email: user.email || 'no-email@abugida.com',
            firstName: user.first_name,
            lastName: user.last_name,
            phoneNumber: phone10,
            txRef: txRef,
            callbackUrl: callbackUrl,
            returnUrl: returnUrl,
            planName: plan.name
        });

        if (chapaResponse.status !== 'success' || !chapaResponse.data || !chapaResponse.data.checkout_url) {
            return res.status(400).json({
                success: false,
                message: chapaResponse.message || 'Failed to initialize payment'
            });
        }

        // Save transaction to database
        const transactionResult = await pool.query(
            `INSERT INTO payment_transactions 
             (user_id, tx_ref, amount, currency, plan_type, plan_name, status, email, first_name, last_name, phone_number, checkout_url, callback_url, return_url)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11, $12, $13)
             RETURNING id, tx_ref, amount, currency, plan_type, plan_name, status, checkout_url`,
            [user.id, txRef, plan.amount, 'ETB', planType, plan.name, user.email, user.first_name, user.last_name, phone10, chapaResponse.data.checkout_url, callbackUrl, returnUrl]
        );

        res.json({
            success: true,
            message: 'Payment initialized successfully',
            transaction: transactionResult.rows[0],
            checkout_url: chapaResponse.data.checkout_url
        });

    } catch (error) {
        console.error('Payment initialization error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to initialize payment'
        });
    }
});

// Verify payment
app.get('/api/payment/verify/:txRef', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const { txRef } = req.params;

        // Check if transaction exists
        const txResult = await pool.query(
            'SELECT * FROM payment_transactions WHERE tx_ref = $1 AND user_id = $2',
            [txRef, req.session.userId]
        );

        if (txResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        const transaction = txResult.rows[0];

        // Verify with Chapa
        const verification = await verifyChapaPayment(txRef);

        if (verification.status === 'success' && verification.data) {
            const chapaData = verification.data;
            
            // Update transaction status
            await pool.query(
                `UPDATE payment_transactions 
                 SET status = $1, chapa_ref_id = $2, verified_at = CURRENT_TIMESTAMP, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE tx_ref = $3`,
                [chapaData.status, chapaData.reference, txRef]
            );

                        // If payment successful, create/update subscription
                        // If payment successful, create pending subscription
            if (chapaData.status === 'success') {
                const days = transaction.plan_type === 'monthly' ? 30 : 
                             transaction.plan_type === 'quarterly' ? 90 : 180;
                
                const existingSub = await pool.query(
                    `SELECT id FROM subscriptions 
                     WHERE user_id = $1 AND activation_status IN ('pending', 'active', 'paused')
                     ORDER BY created_at DESC LIMIT 1`,
                    [req.session.userId]
                );

                let subscription;
                
                if (existingSub.rows.length > 0) {
                    const extResult = await pool.query(
                        `UPDATE subscriptions 
                         SET plan_name = $1, plan_type = $2, amount = $3,
                             activation_status = 'pending', status = 'pending',
                             start_date = NULL, end_date = NULL,
                             activated_at = NULL, paused_at = NULL,
                             original_duration_days = $4, remaining_days = $4,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = $5
                         RETURNING id, plan_name, plan_type, amount, activation_status`,
                        [transaction.plan_name, transaction.plan_type, transaction.amount, days, existingSub.rows[0].id]
                    );
                    subscription = extResult.rows[0];
                } else {
                    const subResult = await pool.query(
                        `INSERT INTO subscriptions 
                         (user_id, plan_name, plan_type, amount, currency, status, activation_status,
                          original_duration_days, remaining_days)
                         VALUES ($1, $2, $3, $4, 'ETB', 'pending', 'pending', $5, $5)
                         RETURNING id, plan_name, plan_type, amount, activation_status`,
                        [req.session.userId, transaction.plan_name, transaction.plan_type, transaction.amount, days]
                    );
                    subscription = subResult.rows[0];
                }

                await pool.query(
                    'UPDATE payment_transactions SET subscription_id = $1 WHERE tx_ref = $2',
                    [subscription.id, txRef]
                );

                return res.json({
                    success: true,
                    message: 'Payment verified. Subscription pending activation.',
                    transaction: { ...transaction, status: chapaData.status, chapa_ref_id: chapaData.reference },
                    subscription: subscription
                });
            }

            return res.json({
                success: true,
                message: 'Payment verification complete',
                transaction: {
                    ...transaction,
                    status: chapaData.status,
                    chapa_ref_id: chapaData.reference
                }
            });
        }

        return res.json({
            success: true,
            message: 'Payment is still pending',
            transaction: transaction
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to verify payment'
        });
    }
});

// Get user's subscription
app.get('/api/subscription', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const result = await pool.query(
            `SELECT * FROM subscriptions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                subscription: null
            });
        }

        res.json({
            success: true,
            subscription: result.rows[0]
        });

    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription'
        });
    }
});

// Get user's payment history
app.get('/api/payment/transactions', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const result = await pool.query(
            `SELECT id, tx_ref, chapa_ref_id, amount, currency, plan_type, plan_name, status, paid_at, created_at
             FROM payment_transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [req.session.userId]
        );

        res.json({
            success: true,
            transactions: result.rows
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions'
        });
    }
});

// ==================== SUBSCRIPTION MANAGEMENT (ADMIN) ====================

// Get all subscriptions with detailed info (for admin)
app.get('/api/admin/subscriptions', requireAdmin, async (req, res) => {
    try {
        const { status, activation_status } = req.query;
        
        let query = `
            SELECT 
                s.*,
                u.first_name, u.last_name, u.email, u.phone,
                a.full_name as activated_by_name,
                p.full_name as paused_by_name
            FROM subscriptions s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN admins a ON a.id = s.activated_by
            LEFT JOIN admins p ON p.id = s.paused_by
            WHERE 1=1
        `;
        const params = [];
        
        if (status) {
            params.push(status);
            query += ` AND s.status = $${params.length}`;
        }
        
        if (activation_status) {
            params.push(activation_status);
            query += ` AND s.activation_status = $${params.length}`;
        }
        
        query += ` ORDER BY s.created_at DESC`;
        
        const result = await pool.query(query, params);
        res.json({ success: true, subscriptions: result.rows });
        
    } catch (error) {
        console.error('Get admin subscriptions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch subscriptions' });
    }
});

// Activate subscription (start countdown)
app.post('/api/admin/subscriptions/:id/activate', requireAdmin, async (req, res) => {
    try {
        const subId = req.params.id;
        const adminId = req.session.adminId;
        const { duration_days } = req.body; // Optional: override duration
        
        const subResult = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [subId]);
        
        if (subResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }
        
        const sub = subResult.rows[0];
        
        // If already active, don't reactivate
        if (sub.activation_status === 'active') {
            return res.status(400).json({ success: false, message: 'Subscription is already active' });
        }
        
        const now = new Date();
        let daysToUse = duration_days || sub.original_duration_days || sub.remaining_days || 30;
        
        // Calculate new end date based on remaining or specified duration
        let endDate;
        if (sub.activation_status === 'paused' && sub.remaining_days) {
            // Resume from pause with remaining days
            daysToUse = sub.remaining_days;
        }
        
        endDate = new Date(now);
        endDate.setDate(endDate.getDate() + daysToUse);
        
        await pool.query(
            `UPDATE subscriptions 
             SET activation_status = 'active',
                 activated_at = $1,
                 start_date = $1,
                 end_date = $2,
                 status = 'active',
                 activated_by = $3,
                 paused_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [now, endDate, adminId, subId]
        );
        
        // Log the action
        console.log(`\n📋 SUBSCRIPTION ACTIVATED`);
        console.log(`   ID: ${subId}`);
        console.log(`   User: ${sub.user_id}`);
        console.log(`   Duration: ${daysToUse} days`);
        console.log(`   End Date: ${endDate.toISOString()}`);
        console.log(`   Activated by: ${adminId}`);
        
        // Send SMS notification
        try {
            const userResult = await pool.query('SELECT phone, first_name FROM users WHERE id = $1', [sub.user_id]);
            const userPhone = userResult.rows[0]?.phone;
            
            if (userPhone) {
                const formattedDate = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                await sendSMS(userPhone, `Your Abugida ${sub.plan_name} subscription is now active! It will expire on ${formattedDate}.`);
                console.log(`   📱 Activation SMS sent`);
            }
        } catch (smsError) {
            console.error('   Failed to send SMS:', smsError.message);
        }
        
        res.json({ success: true, message: 'Subscription activated successfully' });
        
    } catch (error) {
        console.error('Activate subscription error:', error);
        res.status(500).json({ success: false, message: 'Failed to activate subscription' });
    }
});

// Pause subscription
app.post('/api/admin/subscriptions/:id/pause', requireAdmin, async (req, res) => {
    try {
        const subId = req.params.id;
        const adminId = req.session.adminId;
        const { reason } = req.body;
        
        const subResult = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [subId]);
        
        if (subResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }
        
        const sub = subResult.rows[0];
        
        if (sub.activation_status !== 'active') {
            return res.status(400).json({ success: false, message: 'Only active subscriptions can be paused' });
        }
        
        // Calculate remaining days
        const now = new Date();
        const remainingMs = sub.end_date - now;
        const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
        
        await pool.query(
            `UPDATE subscriptions 
             SET activation_status = 'paused',
                 paused_at = $1,
                 remaining_days = $2,
                 status = 'paused',
                 paused_by = $3,
                 notes = COALESCE(notes, '') || CASE WHEN $4 IS NOT NULL THEN E'\nPaused: ' || $4 ELSE '' END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5`,
            [now, remainingDays, adminId, reason || null, subId]
        );
        
        console.log(`\n⏸️ SUBSCRIPTION PAUSED`);
        console.log(`   ID: ${subId}`);
        console.log(`   Remaining days preserved: ${remainingDays}`);
        console.log(`   Paused by: ${adminId}`);
        
        res.json({ success: true, message: 'Subscription paused', remaining_days: remainingDays });
        
    } catch (error) {
        console.error('Pause subscription error:', error);
        res.status(500).json({ success: false, message: 'Failed to pause subscription' });
    }
});

// Reset subscription (restart countdown)
app.post('/api/admin/subscriptions/:id/reset', requireAdmin, async (req, res) => {
    try {
        const subId = req.params.id;
        const adminId = req.session.adminId;
        const { duration_days } = req.body;
        
        const subResult = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [subId]);
        
        if (subResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }
        
        const sub = subResult.rows[0];
        const days = duration_days || sub.original_duration_days || 30;
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + days);
        
        await pool.query(
            `UPDATE subscriptions 
             SET activation_status = 'active',
                 activated_at = $1,
                 start_date = $1,
                 end_date = $2,
                 status = 'active',
                 remaining_days = $3,
                 paused_at = NULL,
                 activated_by = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5`,
            [now, endDate, days, adminId, subId]
        );
        
        console.log(`\n🔄 SUBSCRIPTION RESET`);
        console.log(`   ID: ${subId}`);
        console.log(`   New duration: ${days} days`);
        console.log(`   Reset by: ${adminId}`);
        
        res.json({ success: true, message: 'Subscription reset', end_date: endDate });
        
    } catch (error) {
        console.error('Reset subscription error:', error);
        res.status(500).json({ success: false, message: 'Failed to reset subscription' });
    }
});

// Cancel subscription
app.post('/api/admin/subscriptions/:id/cancel', requireAdmin, async (req, res) => {
    try {
        const subId = req.params.id;
        const adminId = req.session.adminId;
        
        await pool.query(
            `UPDATE subscriptions 
             SET activation_status = 'cancelled',
                 status = 'cancelled',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [subId]
        );
        
        console.log(`\n❌ SUBSCRIPTION CANCELLED`);
        console.log(`   ID: ${subId}`);
        console.log(`   Cancelled by: ${adminId}`);
        
        res.json({ success: true, message: 'Subscription cancelled' });
        
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel subscription' });
    }
});

// Bulk activate all pending subscriptions
app.post('/api/admin/subscriptions/bulk/activate', requireAdmin, async (req, res) => {
    try {
        const adminId = req.session.adminId;
        const { duration_days } = req.body;
        
        const pendingResult = await pool.query(
            `SELECT id, original_duration_days FROM subscriptions WHERE activation_status = 'pending'`
        );
        
        const now = new Date();
        let activated = 0;
        
        for (const sub of pendingResult.rows) {
            const days = duration_days || sub.original_duration_days || 30;
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() + days);
            
            await pool.query(
                `UPDATE subscriptions 
                 SET activation_status = 'active',
                     activated_at = $1,
                     start_date = $1,
                     end_date = $2,
                     status = 'active',
                     activated_by = $3,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4`,
                [now, endDate, adminId, sub.id]
            );
            activated++;
        }
        
        console.log(`\n📋 BULK ACTIVATION`);
        console.log(`   Activated: ${activated} subscriptions`);
        console.log(`   By: ${adminId}`);
        
        res.json({ success: true, message: `Activated ${activated} subscriptions`, count: activated });
        
    } catch (error) {
        console.error('Bulk activate error:', error);
        res.status(500).json({ success: false, message: 'Failed to bulk activate' });
    }
});

// Manually add subscription for user
app.post('/api/admin/subscriptions/manual', requireAdmin, async (req, res) => {
    try {
        const adminId = req.session.adminId;
        const { user_id, plan_type, plan_name, amount, duration_days, activate_now } = req.body;
        
        if (!user_id || !plan_type) {
            return res.status(400).json({ success: false, message: 'User and plan type required' });
        }
        
        // Check user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const plan = getPlanDetails(plan_type);
        const finalAmount = amount || plan.amount;
        const finalName = plan_name || plan.name;
        const days = duration_days || (plan_type === 'monthly' ? 30 : plan_type === 'quarterly' ? 90 : 180);
        
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + days);
        
        const activationStatus = activate_now ? 'active' : 'pending';
        const status = activate_now ? 'active' : 'pending';
        
        const result = await pool.query(
            `INSERT INTO subscriptions 
             (user_id, plan_name, plan_type, amount, currency, status, activation_status, 
              start_date, end_date, original_duration_days, remaining_days, activated_by, notes)
             VALUES ($1, $2, $3, $4, 'ETB', $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            [
                user_id, finalName, plan_type, finalAmount, status, activationStatus,
                activate_now ? now : null, activate_now ? endDate : null, days,
                activate_now ? days : null, activate_now ? adminId : null,
                'Manual subscription added by admin'
            ]
        );
        
        console.log(`\n📋 MANUAL SUBSCRIPTION ADDED`);
        console.log(`   ID: ${result.rows[0].id}`);
        console.log(`   User: ${user_id}`);
        console.log(`   Plan: ${finalName}`);
        console.log(`   Amount: ETB ${finalAmount}`);
        console.log(`   Status: ${activationStatus}`);
        console.log(`   Added by: ${adminId}`);
        
        res.json({ success: true, message: 'Subscription added', subscription_id: result.rows[0].id });
        
    } catch (error) {
        console.error('Manual subscription error:', error);
        res.status(500).json({ success: false, message: 'Failed to add subscription' });
    }
});

// ==================== USER SUBSCRIPTION (CLIENT) ====================

// Get user's current subscription (modified for activation_status)
app.get('/api/subscription', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const result = await pool.query(
            `SELECT * FROM subscriptions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.json({ success: true, subscription: null });
        }

        const subscription = result.rows[0];
        
        // If subscription is pending or paused, don't show end date
        if (subscription.activation_status === 'pending') {
            subscription.end_date = null;
            subscription.message = 'Your subscription is ready and will be activated soon.';
        } else if (subscription.activation_status === 'paused') {
            subscription.end_date = null;
            subscription.message = 'Your subscription is temporarily paused.';
        }

        res.json({ success: true, subscription });

    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch subscription' });
    }
});

// ==================== WEBHOOK ROUTE ====================

// Chapa Webhook (public endpoint — no auth required, but should validate)
app.post('/webhook', async (req, res) => {
    try {
        const payload = req.body;
        console.log('🔔 Webhook received:', JSON.stringify(payload, null, 2));

        // Log webhook event
        await pool.query(
            `INSERT INTO webhook_events (event_type, tx_ref, chapa_ref_id, payload, status)
             VALUES ($1, $2, $3, $4, 'received')`,
            [payload.event || 'payment_callback', payload.tx_ref || payload.trx_ref, payload.reference || payload.ref_id, JSON.stringify(payload)]
        );

        // Extract transaction reference
        const txRef = payload.tx_ref || payload.trx_ref;
        const chapaRefId = payload.reference || payload.ref_id;
        
        // IMPORTANT: Determine the correct status
        // Chapa sends 'event' as 'charge.success' for successful payments
        // But the payload might also have a 'status' field
        let status = payload.status;
        
        // If status is not explicitly set, derive from the event type
        if (!status) {
            if (payload.event === 'charge.success') {
                status = 'success';
            } else if (payload.event === 'charge.failed' || payload.event === 'charge.cancelled') {
                status = 'failed';
            } else {
                status = 'pending';
            }
        }
        
        console.log(`   📊 Derived status: ${status}`);
        console.log(`   Event: ${payload.event}`);

        if (!txRef) {
            console.error('❌ No tx_ref in webhook payload');
            return res.status(400).json({ success: false, message: 'Missing tx_ref' });
        }

        // Find the transaction
        const txResult = await pool.query(
            'SELECT * FROM payment_transactions WHERE tx_ref = $1',
            [txRef]
        );

        if (txResult.rows.length === 0) {
            console.error('❌ Transaction not found:', txRef);
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        const transaction = txResult.rows[0];
        console.log(`   Found transaction: ${transaction.id}`);
        console.log(`   Current status: ${transaction.status}`);
        console.log(`   Phone in transaction: ${transaction.phone_number}`);

        // Update transaction status
        await pool.query(
            `UPDATE payment_transactions 
             SET status = $1, chapa_ref_id = $2, verified_at = CURRENT_TIMESTAMP, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE tx_ref = $3`,
            [status, chapaRefId, txRef]
        );
        console.log(`   ✅ Transaction status updated to: ${status}`);

        // If payment successful, create/update subscription
        if (status === 'success') {
            console.log('   💰 PAYMENT SUCCESS — Creating pending subscription...');
            
            const days = transaction.plan_type === 'monthly' ? 30 : 
                         transaction.plan_type === 'quarterly' ? 90 : 180;
            
            // Check if user already has a pending or active subscription
            const existingSub = await pool.query(
                `SELECT id FROM subscriptions 
                 WHERE user_id = $1 AND activation_status IN ('pending', 'active', 'paused')
                 ORDER BY created_at DESC LIMIT 1`,
                [transaction.user_id]
            );

            let subscription;
            
            if (existingSub.rows.length > 0) {
                // Update existing subscription to pending (if it was paused)
                const extResult = await pool.query(
                    `UPDATE subscriptions 
                     SET plan_name = $1, plan_type = $2, amount = $3,
                         activation_status = 'pending',
                         status = 'pending',
                         start_date = NULL,
                         end_date = NULL,
                         activated_at = NULL,
                         paused_at = NULL,
                         original_duration_days = $4,
                         remaining_days = $4,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $5
                     RETURNING id`,
                    [transaction.plan_name, transaction.plan_type, transaction.amount, days, existingSub.rows[0].id]
                );
                subscription = extResult.rows[0];
                console.log(`   ✅ Existing subscription updated to pending: ${subscription.id}`);
            } else {
                // Create new pending subscription
                const subResult = await pool.query(
                    `INSERT INTO subscriptions 
                     (user_id, plan_name, plan_type, amount, currency, status, activation_status, 
                      original_duration_days, remaining_days)
                     VALUES ($1, $2, $3, $4, 'ETB', 'pending', 'pending', $5, $5)
                     RETURNING id`,
                    [transaction.user_id, transaction.plan_name, transaction.plan_type, transaction.amount, days]
                );
                subscription = subResult.rows[0];
                console.log(`   ✅ New pending subscription created: ${subscription.id}`);
            }

            // Link transaction to subscription
            await pool.query(
                'UPDATE payment_transactions SET subscription_id = $1 WHERE tx_ref = $2',
                [subscription.id, txRef]
            );

            // Mark webhook as processed
            await pool.query(
                `UPDATE webhook_events SET processed_at = CURRENT_TIMESTAMP, status = 'processed' WHERE tx_ref = $1`,
                [txRef]
            );
            
            // Send SMS notification
            try {
                const userResult = await pool.query(
                    'SELECT phone, first_name FROM users WHERE id = $1',
                    [transaction.user_id]
                );
                
                const userPhone = userResult.rows[0]?.phone;
                const firstName = userResult.rows[0]?.first_name || '';
                
                if (userPhone) {
                    const text = `Dear ${firstName}, your Abugida ${transaction.plan_name} payment has been received. Your subscription will be activated soon.`;
                    await sendSMS(userPhone, text);
                    console.log(`   📱 Payment confirmation SMS sent to ${userPhone}`);
                }
            } catch (smsError) {
                console.error('   ❌ Failed to send SMS:', smsError.message);
            }
            
            console.log('   ✅ SUBSCRIPTION MARKED AS PENDING');
        } else {
            console.log(`   ⚠️ Payment not successful (status: ${status})`);
        }

        console.log('✅ Webhook processed successfully');
        res.json({ success: true, message: 'Webhook processed successfully' });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        console.error('   Stack:', error.stack);
        res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
});

// Payment return URL (after Chapa redirect)
app.get('/payment/return', (req, res) => {
    // Chapa redirects back with tx_ref in query params
    const txRef = req.query.tx_ref || req.query.trx_ref;
    
    if (txRef) {
        // Redirect to frontend payment success page with tx_ref
        res.redirect(`/#payment-return?tx_ref=${encodeURIComponent(txRef)}`);
    } else {
        res.redirect('/#dashboard');
    }
});

// ==================== Load Schools ====================
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

// ==================== ERROR LOGGING MIDDLEWARE ====================
app.use((err, req, res, next) => {
    console.error('\n💥 UNHANDLED ERROR');
    console.error(`   Time: ${new Date().toISOString()}`);
    console.error(`   URL: ${req.originalUrl}`);
    console.error(`   Method: ${req.method}`);
    console.error(`   Error: ${err.message}`);
    console.error(`   Stack: ${err.stack?.substring(0, 500)}`);
    next(err);
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