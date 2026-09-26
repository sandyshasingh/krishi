const mongoose = require('mongoose');
const { INQUIRY_STATUS, ALL_INQUIRY_STATUSES } = require('../constants');

const inquirySchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Backward-compatible alias
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },

    buyer: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, trim: true },
      phone: { type: String, trim: true }
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },

    quantityRequested: {
      type: Number,
      min: [1, 'Quantity requested must be greater than zero']
    },

    offerPrice: {
      type: Number,
      min: [0, 'Offer price cannot be negative']
    },

    message: {
      type: String,
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters']
    },

    status: {
      type: String,
      enum: {
        values: ALL_INQUIRY_STATUSES,
        message: 'Status must be one of: ' + ALL_INQUIRY_STATUSES.join(', ')
      },
      default: INQUIRY_STATUS.NEW,
      index: true
    },

    isNewInquiry: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to synchronize sellerId/seller and productId/product
inquirySchema.pre('save', function () {
  if (this.sellerId && !this.seller) this.seller = this.sellerId;
  if (this.seller && !this.sellerId) this.sellerId = this.seller;
  if (this.productId && !this.product) this.product = this.productId;
  if (this.product && !this.productId) this.productId = this.product;
});


inquirySchema.index({ sellerId: 1, productId: 1, status: 1 });
inquirySchema.index({ seller: 1, isNewInquiry: 1 });

inquirySchema.methods.toClientJSON = function () {
  return {
    id: this._id.toString(),
    buyer: {
      id: this.buyer?.id?.toString() || this.buyerId?.toString() || '',
      name: this.buyer?.name || 'Interested Buyer'
    },
    productId: (this.productId || this.product)?.toString(),
    quantityRequested: this.quantityRequested ?? 0,
    offerPrice: this.offerPrice ?? 0,
    status: this.status,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('Inquiry', inquirySchema);
