const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['buyer', 'seller'],
      required: [true, 'Role is required and must be either buyer or seller'],
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