const mongoose = require('mongoose');
const { ALL_ROLES, USER_ROLES, VERIFICATION_STATUS, ALL_VERIFICATION_STATUSES } = require('../constants');

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: {
        values: ALL_ROLES,
        message: 'Role must be one of: ' + ALL_ROLES.join(', ')
      },
      required: [true, 'Role is required and must be either seller, buyer, or admin'],
      lowercase: true,
      trim: true,
      default: USER_ROLES.SELLER
    },

    verificationStatus: {
      type: String,
      enum: ALL_VERIFICATION_STATUSES,
      default: VERIFICATION_STATUS.VERIFIED,
      lowercase: true,
      trim: true
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },

    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },

    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },

    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },

    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },

    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: [true, 'Password is required']
    },

    resetPasswordToken: {
      type: String
    },

    resetPasswordExpires: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);