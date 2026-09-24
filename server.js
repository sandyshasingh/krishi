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

const app = express();

app.use(express.json());
app.use(cors());


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
// Signup
// ===============================

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password required'
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: 'User already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      password: hashedPassword
    });

    return res.status(201).json({
      message: 'User created successfully',
      userId: newUser._id
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

    const user = await User.findOne({ email });

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

    const token = jwt.sign(
      {
        userId: user._id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    return res.status(200).json({
      message: 'Login successful',
      token
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

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
