const mongoose = require('mongoose');

const mandiPriceSchema = new mongoose.Schema(
  {
    commodity: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    market: {
      type: String,
      trim: true
    },

    region: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    state: {
      type: String,
      trim: true,
      index: true
    },

    minPrice: {
      type: Number,
      required: true
    },

    maxPrice: {
      type: Number,
      required: true
    },

    modalPrice: {
      type: Number,
      required: true
    },

    unit: {
      type: String,
      default: 'Quintal'
    },

    percentageChange: {
      type: Number,
      default: 0
    },

    direction: {
      type: String,
      enum: ['up', 'down', 'stable'],
      default: 'up'
    },

    arrivalDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

mandiPriceSchema.index({ commodity: 1, region: 1, state: 1 });

module.exports = mongoose.model('MandiPrice', mandiPriceSchema);
