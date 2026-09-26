const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const cors = require('cors');

const User = require('./models/User');
const { authenticateToken, authorizeRoles, JWT_SECRET } = require('./middleware/auth');

const app = express();

app.use(express.json());
app.use(cors());

// Helper to format sanitized user object (without password & sensitive tokens)
function sanitizeUser(user) {
  return {
    id: user._id,
    role: user.role,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    address: user.address,
    city: user.city,
    state: user.state,
    pincode: user.pincode,
    createdAt: user.createdAt
  };
}


// ===============================
// MongoDB Connection
// ===============================
// ===============================
// Email Transporter
// ===============================

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MONGODB_USERNAME,
    pass: process.env.MONGODB_PASSWORD
  }
});


// ===============================
// Signup (Onboarding with Role & Details)
// ===============================

app.post('/api/auth/signup', async (req, res) => {
  try {
    const {
      role,
      name,
      phoneNumber,
      phone,
      address,
      city,
      state,
      pincode,
      email,
      password
    } = req.body;

    // 1. Role validation (buyer or seller)
    if (!role) {
      return res.status(400).json({
        message: 'Role is required. Must be either "buyer" or "seller".'
      });
    }

    const normalizedRole = String(role).toLowerCase().trim();
    if (!['buyer', 'seller'].includes(normalizedRole)) {
      return res.status(400).json({
        message: 'Invalid role. Role must be strictly "buyer" or "seller".'
      });
    }

    // 2. Onboarding profile fields validation
    const contactPhone = (phoneNumber || phone || '').toString().trim();
    const missingFields = [];

    if (!name || !String(name).trim()) missingFields.push('name');
    if (!contactPhone) missingFields.push('phoneNumber');
    if (!address || !String(address).trim()) missingFields.push('address');
    if (!city || !String(city).trim()) missingFields.push('city');
    if (!state || !String(state).trim()) missingFields.push('state');
    if (!pincode || !String(pincode).trim()) missingFields.push('pincode');
    if (!email || !String(email).trim()) missingFields.push('email');
    if (!password) missingFields.push('password');

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required onboarding fields: ${missingFields.join(', ')}`
      });
    }

    // 3. Duplicate email check
    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists'
      });
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create user with role and profile details
    const newUser = await User.create({
      role: normalizedRole,
      name: String(name).trim(),
      phoneNumber: contactPhone,
      address: String(address).trim(),
      city: String(city).trim(),
      state: String(state).trim(),
      pincode: String(pincode).trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    // 6. Generate JWT containing userId and role
    const token = jwt.sign(
      {
        userId: newUser._id,
        role: newUser.role,
        email: newUser.email
      },
      JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: sanitizeUser(newUser)
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});


// ===============================
// Login
// ===============================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password required'
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Include role in JWT payload
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});



// ===============================
// Forgot Password
// ===============================

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const resetToken = crypto
      .randomBytes(32)
      .toString('hex');

    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.resetPasswordExpires =
      Date.now() + 15 * 60 * 1000;

    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request',
      text: `Your password reset token is: ${resetToken}

Use this token on the reset password endpoint within 15 minutes.`
    });

    return res.status(200).json({
      message: 'Reset token sent to email'
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});


// ===============================
// Reset Password
// ===============================

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: 'Token and new password required'
      });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: {
        $gt: Date.now()
      }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired token'
      });
    }

    user.password = await bcrypt.hash(
      newPassword,
      10
    );

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      message: 'Password reset successful'
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// ===============================
// Current User Profile & Role Check
// ===============================

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    return res.status(200).json({
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});


// ===============================
// Role-Protected Screen Routes (RBAC)
// These routes guarantee that buyers cannot access seller screens/data
// and vice-versa, either via direct URLs or API calls.
// ===============================

// Seller-only screens & actions
app.get('/api/seller/dashboard', authenticateToken,  authorizeRoles('seller'), async (req, res) => {
  try {
    const seller = await User.findById(req.user.userId);

    return res.status(200).json({
      message: 'Welcome to Seller Dashboard',
      user: sanitizeUser(seller),
      screensAllowed: [
        'SELLER_DASHBOARD',
        'CROP_INVENTORY_MANAGEMENT',
        'POST_NEW_PRODUCE_LISTING',
        'VIEW_BUYER_OFFERS_AND_ORDERS',
        'MANDI_PRICE_INSIGHTS',
        'SELLER_PAYOUTS_WALLET'
      ]
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Buyer-only screens & actions
app.get('/api/buyer/dashboard', authenticateToken, authorizeRoles('buyer'), async (req, res) => {
  try {
    const buyer = await User.findById(req.user.userId);

    return res.status(200).json({
      message: 'Welcome to Buyer Dashboard',
      user: sanitizeUser(buyer),
      screensAllowed: [
        'BUYER_MARKETPLACE',
        'EXPLORE_CROPS_AND_PRODUCE',
        'CREATE_PURCHASE_ORDER',
        'TRACK_DELIVERIES',
        'PURCHASE_HISTORY_AND_INVOICES'
      ]
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


// ===============================
// Health Check
// ===============================

app.get('/', (req, res) => {

  res.json({
    message: 'Auth API is running'
  });
});


// ===============================
// Start Server
// ===============================

const PORT = process.env.PORT || 5001;

async function startServer() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set. Add it to auth-api/.env or the deployment environment.');
  }

  await mongoose.connect(mongoUri);
  console.log('Database connected successfully');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  });
}

module.exports = { app, startServer };

