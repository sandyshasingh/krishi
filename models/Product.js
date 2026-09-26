const mongoose = require('mongoose');
const {
  PRODUCT_STATUS,
  ALL_PRODUCT_STATUSES,
  VERIFICATION_STATUS,
  ALL_VERIFICATION_STATUSES
} = require('../constants');

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true
    },
    isCover: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
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
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    }
  },
  { _id: false }
);

const transportationSchema = new mongoose.Schema(
  {
    available: {
      type: Boolean,
      default: false
    },
    deliveryRadiusKm: {
      type: Number,
      min: 0
    },
    terms: {
      type: String,
      trim: true,
      maxlength: [200, 'Transportation terms cannot exceed 200 characters']
    }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Alias for backward compatibility
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters']
    },

    localName: {
      type: String,
      trim: true,
      default: ''
    },

    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      lowercase: true,
      index: true
    },

    quantity: {
      value: {
        type: Number,
        required: [true, 'Quantity value is required'],
        min: [1, 'Quantity must be greater than zero']
      },
      unit: {
        type: String,
        required: [true, 'Quantity unit is required'],
        trim: true,
        uppercase: true,
        default: 'KG'
      }
    },

    expectedPrice: {
      min: {
        type: Number,
        required: [true, 'Minimum expected price is required'],
        min: [0, 'Minimum price cannot be negative']
      },
      max: {
        type: Number,
        required: [true, 'Maximum expected price is required'],
        min: [0, 'Maximum price cannot be negative']
      },
      unit: {
        type: String,
        required: [true, 'Price unit is required'],
        trim: true,
        uppercase: true,
        default: 'KG'
      }
    },

    location: {
      type: locationSchema,
      required: [true, 'Product location is required']
    },

    transportation: {
      type: transportationSchema,
      default: () => ({ available: false })
    },

    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: ''
    },

    tags: {
      type: [String],
      default: []
    },

    images: {
      type: [imageSchema],
      default: []
    },

    status: {
      type: String,
      enum: {
        values: ALL_PRODUCT_STATUSES,
        message: 'Status must be one of: ' + ALL_PRODUCT_STATUSES.join(', ')
      },
      default: PRODUCT_STATUS.DRAFT,
      lowercase: true,
      trim: true,
      index: true
    },

    verificationStatus: {
      type: String,
      enum: {
        values: ALL_VERIFICATION_STATUSES,
        message: 'Verification status must be one of: ' + ALL_VERIFICATION_STATUSES.join(', ')
      },
      default: VERIFICATION_STATUS.PENDING,
      lowercase: true,
      trim: true
    },

    interestedBuyers: {
      type: Number,
      default: 0,
      min: 0
    },

    highestOffer: {
      type: Number,
      default: null
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to synchronize sellerId and seller
productSchema.pre('save', function () {
  if (this.sellerId && !this.seller) {
    this.seller = this.sellerId;
  } else if (this.seller && !this.sellerId) {
    this.sellerId = this.seller;
  }
});


// Compound indexes for fast, scalable querying
productSchema.index({ sellerId: 1, isDeleted: 1, status: 1 });
productSchema.index({ seller: 1, isDeleted: 1, status: 1 });
productSchema.index({ category: 1, isDeleted: 1, status: 1 });
productSchema.index({ isDeleted: 1, createdAt: -1 });

/**
 * Complete serialization for the authenticated Seller
 * (Includes full details and coordinates)
 */
productSchema.methods.toSellerJSON = function () {
  return {
    id: this._id.toString(),
    sellerId: (this.sellerId || this.seller)?.toString(),
    name: this.name,
    localName: this.localName || '',
    category: this.category,
    quantity: {
      value: this.quantity?.value ?? 0,
      unit: this.quantity?.unit ?? 'KG'
    },
    expectedPrice: {
      min: this.expectedPrice?.min ?? 0,
      max: this.expectedPrice?.max ?? 0,
      unit: this.expectedPrice?.unit ?? 'KG'
    },
    location: {
      city: this.location?.city || '',
      state: this.location?.state || '',
      pincode: this.location?.pincode || '',
      latitude: this.location?.latitude ?? null,
      longitude: this.location?.longitude ?? null
    },
    transportation: {
      available: this.transportation?.available ?? false,
      deliveryRadiusKm: this.transportation?.deliveryRadiusKm ?? null,
      terms: this.transportation?.terms || ''
    },
    description: this.description || '',
    tags: this.tags || [],
    status: this.status,
    verificationStatus: this.verificationStatus,
    interestedBuyers: this.interestedBuyers ?? 0,
    highestOffer: this.highestOffer !== undefined ? this.highestOffer : null,
    images: this.images || [],
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

/**
 * Public buyer-safe serialization
 * (Hides exact GPS coordinates to protect seller farm privacy)
 */
productSchema.methods.toBuyerJSON = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    localName: this.localName || '',
    category: this.category,
    quantity: {
      value: this.quantity?.value ?? 0,
      unit: this.quantity?.unit ?? 'KG'
    },
    expectedPrice: {
      min: this.expectedPrice?.min ?? 0,
      max: this.expectedPrice?.max ?? 0,
      unit: this.expectedPrice?.unit ?? 'KG'
    },
    location: {
      city: this.location?.city || '',
      state: this.location?.state || '',
      pincode: this.location?.pincode || ''
    },
    transportation: {
      available: this.transportation?.available ?? false,
      deliveryRadiusKm: this.transportation?.deliveryRadiusKm ?? null,
      terms: this.transportation?.terms || ''
    },
    description: this.description || '',
    tags: this.tags || [],
    status: this.status,
    images: this.images || [],
    createdAt: this.createdAt
  };
};

// Default serialization
productSchema.methods.toClientJSON = function () {
  return this.toSellerJSON();
};

module.exports = mongoose.model('Product', productSchema);
