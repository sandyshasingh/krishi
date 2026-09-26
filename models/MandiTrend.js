const mongoose = require('mongoose');

const mandiTrendSchema = new mongoose.Schema(
  {
    commodity: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    region: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    state: {
      type: String,
      trim: true
    },

    currentPrice: {
      type: Number,
      required: true
    },

    percentage: {
      type: Number,
      default: 0
    },

    direction: {
      type: String,
      enum: ['up', 'down', 'stable'],
      default: 'up'
    },

    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MandiTrend', mandiTrendSchema);
