const mongoose = require('mongoose');
const { VERIFICATION_STATUS, ALL_VERIFICATION_STATUSES } = require('../constants');

const sellerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    farmName: {
      type: String,
      trim: true
    },

    businessType: {
      type: String,
      enum: ['individual_farmer', 'fpo', 'trader', 'cooperative'],
      default: 'individual_farmer'
    },

    farmSizeAcres: {
      type: Number
    },

    primaryCrops: {
      type: [String],
      default: []
    },

    verificationStatus: {
      type: String,
      enum: ALL_VERIFICATION_STATUSES,
      default: VERIFICATION_STATUS.VERIFIED
    },

    rating: {
      type: Number,
      default: 4.5,
      min: 0,
      max: 5
    },

    totalSalesCount: {
      type: Number,
      default: 0
    },

    badges: {
      type: [String],
      default: ['verified_farmer']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SellerProfile', sellerProfileSchema);
