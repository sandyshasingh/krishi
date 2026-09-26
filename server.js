const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');
const cors = require('cors');

const User = require('./models/User');
const { USER_ROLES, ALL_ROLES } = require('./constants');
const { authenticateToken, authorizeRoles, JWT_SECRET } = require('./middleware/auth');
const { uploadProductImages } = require('./middleware/upload.middleware');
const productController = require('./controllers/product.controller');
const sellerRoutes = require('./routes/seller');

const app = express();

app.use(express.json());
app.use(cors());

// Serve static uploaded product images
const uploadsDir = path.join(__dirname, 'uploads/products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Helper to format sanitized user object (without password & sensitive tokens)
function sanitizeUser(user) {
  return {
    id: user._id ? user._id.toString() : user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phoneNumber || user.phone || '',
    phoneNumber: user.phoneNumber || user.phone || '',
    address: user.address || '',
    city: user.city || '',
    state: user.state || '',
    pincode: user.pincode || '',
    verificationStatus: user.verificationStatus || 'verified',
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
// Supports roles: seller, buyer, admin
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

    // 1. Role validation (seller, buyer, admin)
    const userRole = role ? String(role).toLowerCase().trim() : USER_ROLES.SELLER;
    if (!ALL_ROLES.includes(userRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Role must be one of: ${ALL_ROLES.join(', ')}`
      });
    }

    // 2. Onboarding profile fields validation
    const contactPhone = (phoneNumber || phone || '').toString().trim();
    const missingFields = [];

    if (!name || !String(name).trim()) missingFields.push('name');
    if (!contactPhone) missingFields.push('phone / phoneNumber');
    if (!address || !String(address).trim()) missingFields.push('address');
    if (!city || !String(city).trim()) missingFields.push('city');
    if (!state || !String(state).trim()) missingFields.push('state');
    if (!pincode || !String(pincode).trim()) missingFields.push('pincode');
    if (!email || !String(email).trim()) missingFields.push('email');
    if (!password) missingFields.push('password');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required onboarding fields: ${missingFields.join(', ')}`
      });
    }

    // 3. Duplicate email check
    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create user with role and profile details
    const newUser = await User.create({
      role: userRole,
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
        expiresIn: '7d'
      }
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser._id.toString(),
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phoneNumber,
          role: newUser.role
        },
        token
      }
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


// ===============================
// 1. LOGIN API
// Endpoint: POST /api/auth/login
// 1. Validate email and password.
// 2. Find the user by email.
// 3. Verify the password securely.
// 4. Read the role from the database.
// 5. Generate the authentication token/JWT.
// 6. Return the user's basic information and role.
// ===============================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
    }

    // 2. Find the user by email
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // 3. Verify the password securely
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // 4. Read the role from the database record
    const role = user.role;

    // 5. Generate authentication token/JWT
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: '7d'
      }
    );

    // 6. Return user's basic information and role (without password)
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phoneNumber || user.phone || '',
          role: role
        },
        token: token
      }
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
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
    return res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(req.user)
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


// ===============================
// Seller Routes (Dashboard, Products, etc.)
// Role: 'seller' only (Verified from database record)
// ===============================

app.use('/api/seller', sellerRoutes);

// Dedicated Image Upload Route Alias (Section 7)
app.post(
  '/api/uploads/product-images',
  authenticateToken,
  authorizeRoles(USER_ROLES.SELLER),
  uploadProductImages,
  (req, res) => productController.uploadImages(req, res)
);


// Buyer-only screens & actions
app.get('/api/buyer/dashboard', authenticateToken, authorizeRoles('buyer'), async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Welcome to Buyer Dashboard',
      user: sanitizeUser(req.user),
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
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


// ===============================
// Health Check
// ===============================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Krishi Platform API is running'
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

