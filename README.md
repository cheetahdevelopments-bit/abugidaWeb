# Abugida — Parent-School Connection Platform

![Abugida](images/logos/site_logo.png)

**Abugida** is a mobile-first education platform that connects parents with schools, providing real-time updates on academic progress, attendance, and communication — all in one place.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Payment Integration](#payment-integration)
- [SMS Integration](#sms-integration)
- [Admin Dashboard](#admin-dashboard)
- [Security](#security)
- [Deployment](#deployment)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

Abugida is designed for Ethiopian parents to stay connected with their children's education. The platform offers:

- **Academic Tracking** — Monitor grades and progress in real-time
- **Attendance Monitoring** — Know when your child is in school
- **Parent-Teacher Communication** — Direct messaging with teachers
- **Events & Activities** — Stay updated with school events
- **Subscription-based access** — Monthly, Quarterly, and Semi-Annual plans

The platform is **mobile-first** with an Android/iOS app coming soon. The web interface allows parents to register, add children, subscribe, and manage their accounts.

---

## Features

### For Parents
- **Multi-step Registration** — Phone OTP verification → Add children → Complete
- **Multi-child support** — Track unlimited children (up to 10 per account)
- **Subscription management** — View plan status, payment history
- **Secure authentication** — Phone-based OTP + password
- **Amharic support** — Internationalization ready

### For Admins
- **User management** — View, search, delete users
- **Subscription control** — Activate, pause, reset, cancel subscriptions
- **Manual subscription creation** — Add subscriptions for existing users
- **Bulk activation** — Activate all pending subscriptions at once
- **Payment tracking** — Monitor all Chapa transactions
- **School management** — Add/remove schools
- **Webhook monitoring** — Track Chapa webhook events
- **Revenue analytics** — Dashboard with key metrics

### Subscription Plans
| Plan | Price | Duration |
|------|-------|----------|
| Monthly | ETB 999 | 30 days |
| Quarterly | ETB 2,699 | 90 days |
| Semi-Annual | ETB 4,199 | 180 days |

---

## Tech Stack

### Frontend
- **HTML5** — Semantic markup
- **CSS3** — Custom design system with CSS variables
- **Vanilla JavaScript** — Module-based architecture
- **IntersectionObserver API** — Scroll animations
- **Google Fonts** — Inter & Noto Sans Ethiopic

### Backend
- **Node.js** — Runtime
- **Express.js** — Web framework
- **PostgreSQL** — Database
- **express-session** — Session management
- **connect-pg-simple** — PostgreSQL session store
- **bcrypt** — Password hashing
- **express-rate-limit** — Rate limiting
- **helmet** — Security headers
- **compression** — Response compression

### External Services
- **Chapa** — Payment gateway (Ethiopian)
- **SMS Ethiopia** — SMS/OTP delivery

---

## Architecture
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Client │ ──▶ │ Server │ ──▶ │ PostgreSQL │
│ (Browser) │ ◀── │ (Express) │ ◀── │ Database │
└─────────────┘ └──────┬──────┘ └─────────────┘
│
┌──────▼──────┐
│ Chapa │
│ Payment │
└──────┬──────┘
│
┌──────▼──────┐
│ Webhook │
│ Server │
└─────────────┘

text

### Payment Flow
1. User selects plan → Confirm order modal
2. Server initializes payment with Chapa
3. User redirected to Chapa checkout
4. User pays via Telebirr/CBE Birr/Card
5. Chapa sends webhook to webhook server (VPS)
6. Webhook server verifies signature → forwards to main server
7. Main server creates pending subscription
8. Admin activates subscription (starts countdown)
9. SMS confirmation sent to user

---

## Project Structure
abugidaWebSite/
├── index.html # Main landing page + auth + dashboard
├── server.js # Main Express server
├── createTables.js # Database schema creation
├── resetDatabase.js # Database reset script
├── fixConstraint.js # Database constraint fix
├── package.json
├── .env # Environment variables (gitignored)
├── schools.txt # School names (one per line)
├── css/
│ ├── design-system.css # CSS variables, base styles
│ ├── layout.css # Header, sidebar, layout structure
│ ├── pages.css # Hero, features, pricing, trust, dashboard
│ ├── pages1.css # Auth page styles
│ ├── pages2.css # Dashboard widgets, decorative elements
│ ├── scroll-animations.css
│ └── enhanced-sections.css
├── js/
│ ├── config.js # Configuration constants
│ ├── state.js # Global state management
│ ├── api.js # API client
│ ├── ui.js # UI components (toast, modal, skeleton)
│ ├── auth.js # Auth module (login, register, OTP)
│ ├── dashboard.js # Dashboard module
│ ├── payment.js # Payment module
│ ├── scroll-animations.js
│ ├── i18n.js # Internationalization
│ └── app.js # Main entry point
└── images/
└── logos/
└── site_logo.png # Brand logo

text

---

## Database Schema

### Tables
| Table | Description |
|-------|-------------|
| `users` | Parent accounts |
| `children` | Children linked to parents |
| `otps` | One-time passwords for phone verification |
| `schools` | Registered schools |
| `subscriptions` | Parent subscription plans |
| `payment_transactions` | Chapa payment records |
| `webhook_events` | Incoming Chapa webhook logs |
| `admins` | Admin dashboard users |
| `admin_session` | Admin session store |
| `contact_messages` | Contact form submissions |
| `subscription_audit_log` | Admin actions on subscriptions |
| `session` | User session store |

### Subscription States
| State | Description |
|-------|-------------|
| `pending` | Payment confirmed, awaiting admin activation |
| `active` | Countdown running |
| `paused` | Temporarily stopped, remaining days preserved |
| `cancelled` | Terminated by admin |
| `completed` | Expired naturally |

---

## Setup & Installation

### Prerequisites
- Node.js v18+
- PostgreSQL 14+
- npm or yarn

### Local Development

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd abugidaWebSite

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
nano .env  # Add your credentials

# 4. Create database
createdb abugida_db

# 5. Create tables
node createTables.js

# 6. Load schools (optional)
node -e "
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
const schools = fs.readFileSync('schools.txt', 'utf8').split('\n').filter(s => s.trim());
schools.forEach(async (name) => {
  await pool.query('INSERT INTO schools (name) VALUES ($1) ON CONFLICT DO NOTHING', [name.trim()]);
});
"

# 7. Start server
node server.js

# Or with nodemon for development
npx nodemon server.js
Environment Variables
Create a .env file with:

env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=abugida_db
DB_USER=abugida_user
DB_PASSWORD=your_db_password

# Session
SESSION_SECRET=your_session_secret_here
COOKIE_MAX_AGE=604800000

# Chapa Payment
CHAPA_SECRET_KEY=CHASECK-xxxxxxxxxxxxxxxx
CHAPA_CALLBACK_URL=https://yourdomain.com/webhook

# SMS Ethiopia
SMS_API_KEY=your_sms_api_key

# Admin
ADMIN_SESSION_SECRET=your_admin_session_secret
API Reference
Authentication
Method	Endpoint	Description
POST	/api/send-otp	Send OTP to phone
POST	/api/verify-otp	Verify OTP
POST	/api/register	Complete registration
POST	/api/login	Login
POST	/api/logout	Logout
GET	/api/user	Get current user
PUT	/api/user	Update profile
POST	/api/forgot-password	Send reset OTP
POST	/api/reset-password	Reset password
Children
Method	Endpoint	Description
GET	/api/children	Get user's children
POST	/api/children	Add child
PUT	/api/children/:id	Update child
DELETE	/api/children/:id	Delete child
Schools
Method	Endpoint	Description
GET	/api/schools	Get all schools
Payments
Method	Endpoint	Description
POST	/api/payment/initialize	Initialize Chapa payment
GET	/api/payment/verify/:txRef	Verify payment
GET	/api/payment/transactions	Get transaction history
Subscriptions
Method	Endpoint	Description
GET	/api/subscription	Get user's subscription
Webhook
Method	Endpoint	Description
POST	/webhook	Chapa webhook endpoint
Contact
Method	Endpoint	Description
POST	/api/contact	Submit contact form
Payment Integration
Chapa Setup
Create a Chapa account at chapa.co

Get your Secret Key from the dashboard

Set CHAPA_SECRET_KEY in .env

Configure webhook URL in Chapa dashboard

Help Center: Via the website footer

License
© 2026 Abugida. All rights reserved.

Acknowledgments
Chapa — Ethiopian payment gateway

SMS Ethiopia — SMS delivery service

Google Fonts — Inter & Noto Sans Ethiopic fonts
