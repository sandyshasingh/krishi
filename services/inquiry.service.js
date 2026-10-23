const Inquiry = require('../models/Inquiry');
const Product = require('../models/Product');
const { INQUIRY_STATUS, PRODUCT_STATUS } = require('../constants');

/**
 * Inquiry Service
 */
class InquiryService {
  /**
   * 1. CREATE INQUIRY (Buyer shows interest in live product)
   */
  async createInquiry(buyerUser, { productId, quantityRequested, offerPrice, message }) {
    // 1. Verify that product exists, is live/active, and not deleted
    const product = await Product.findOne({
      _id: productId,
      status: PRODUCT_STATUS.ACTIVE,
      isDeleted: { $ne: true }
    });

    if (!product) {
      return {
        success: false,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found or is not currently active for inquiries'
      };
    }

    // 2. Prevent seller from inquiring on their own product
    const sellerId = product.sellerId || product.seller;
    if (sellerId && sellerId.toString() === buyerUser._id.toString()) {
      return {
        success: false,
        code: 'INVALID_OPERATION',
        message: 'You cannot submit an inquiry on your own product listing'
      };
    }

    // 3. Create the inquiry
    const numericQuantity = Number(quantityRequested);
    const numericOffer = offerPrice !== undefined && offerPrice !== null && offerPrice !== '' ? Number(offerPrice) : null;

    const inquiry = await Inquiry.create({
      sellerId,
      seller: sellerId,
      buyerId: buyerUser._id,
      buyer: {
        id: buyerUser._id,
        name: buyerUser.name || 'Interested Buyer',
        phone: buyerUser.phoneNumber || buyerUser.phone || '',
        email: buyerUser.email || '',
        city: buyerUser.city || '',
        state: buyerUser.state || ''
      },
      productId: product._id,
      product: product._id,
      quantityRequested: numericQuantity,
      offerPrice: numericOffer,
      message: message ? String(message).trim() : '',
      status: INQUIRY_STATUS.NEW,
      isNewInquiry: true
    });

    // 4. Update interested buyers count and highest offer on Product
    const updateFields = { $inc: { interestedBuyers: 1 } };
    if (numericOffer !== null && (!product.highestOffer || numericOffer > product.highestOffer)) {
      updateFields.$max = { highestOffer: numericOffer };
    }
    await Product.findByIdAndUpdate(product._id, updateFields);

    return {
      success: true,
      inquiry: inquiry.toClientJSON()
    };
  }

  /**
   * 2. GET ALL INQUIRIES FOR A SELLER (Across all their listed products)
   */
  async getAllSellerInquiries(sellerId, query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      $or: [{ sellerId }, { seller: sellerId }]
    };

    if (query.status && query.status.trim()) {
      filter.status = query.status.trim().toLowerCase();
    }

    if (query.productId && query.productId.trim()) {
      filter.$and = [
        { $or: [{ productId: query.productId.trim() }, { product: query.productId.trim() }] }
      ];
    }

    const [totalCount, inquiries] = await Promise.all([
      Inquiry.countDocuments(filter),
      Inquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('productId', 'name localName category quantity expectedPrice images status')
        .lean()
    ]);

    const formatted = inquiries.map((inq) => {
      const prod = inq.productId || {};
      const buyer = inq.buyer || {};
      return {
        id: inq._id.toString(),
        inquiryId: inq._id.toString(),
        quantityRequested: inq.quantityRequested,
        offerPrice: inq.offerPrice !== undefined ? inq.offerPrice : null,
        message: inq.message || '',
        status: inq.status,
        isNewInquiry: inq.isNewInquiry ?? false,
        createdAt: inq.createdAt,
        product: {
          id: prod._id ? prod._id.toString() : inq.productId?.toString(),
          name: prod.name || 'Product',
          localName: prod.localName || '',
          category: prod.category || '',
          availableQuantity: prod.quantity || null,
          expectedPrice: prod.expectedPrice || null,
          images: prod.images || []
        },
        buyer: {
          id: buyer.id ? buyer.id.toString() : (inq.buyerId ? inq.buyerId.toString() : null),
          name: buyer.name || 'Interested Buyer',
          phone: buyer.phone || '',
          phoneNumber: buyer.phone || '',
          email: buyer.email || '',
          city: buyer.city || '',
          state: buyer.state || ''
        }
      };
    });

    return {
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1
      },
      inquiries: formatted
    };
  }

  /**
   * 3. GET INQUIRIES FOR A SPECIFIC PRODUCT (Belonging to seller)
   */
  async getProductInquiriesForSeller(sellerId, productId) {
    const product = await Product.findOne({
      _id: productId,
      $or: [{ sellerId }, { seller: sellerId }],
      isDeleted: { $ne: true }
    });

    if (!product) {
      return null;
    }

    const inquiries = await Inquiry.find({
      $and: [
        { $or: [{ productId }, { product: productId }] },
        { $or: [{ sellerId }, { seller: sellerId }] }
      ]
    }).sort({ createdAt: -1 });

    return inquiries.map((inq) => inq.toClientJSON());
  }

  /**
   * 4. GET INQUIRIES SENT BY A BUYER
   */
  async getBuyerInquiries(buyerId, query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      $or: [{ buyerId }, { 'buyer.id': buyerId }]
    };

    const [totalCount, inquiries] = await Promise.all([
      Inquiry.countDocuments(filter),
      Inquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('productId', 'name localName category quantity expectedPrice images status location')
        .populate('sellerId', 'name email phoneNumber phone city state')
        .lean()
    ]);

    const formatted = inquiries.map((inq) => {
      const prod = inq.productId || {};
      const seller = inq.sellerId || {};
      return {
        id: inq._id.toString(),
        quantityRequested: inq.quantityRequested,
        offerPrice: inq.offerPrice !== undefined ? inq.offerPrice : null,
        message: inq.message || '',
        status: inq.status,
        createdAt: inq.createdAt,
        product: {
          id: prod._id ? prod._id.toString() : inq.productId?.toString(),
          name: prod.name || 'Product',
          category: prod.category || '',
          expectedPrice: prod.expectedPrice || null,
          location: prod.location || null,
          images: prod.images || []
        },
        seller: {
          id: seller._id ? seller._id.toString() : inq.sellerId?.toString(),
          name: seller.name || 'Seller',
          phoneNumber: seller.phoneNumber || seller.phone || '',
          city: seller.city || '',
          state: seller.state || ''
        }
      };
    });

    return {
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1
      },
      inquiries: formatted
    };
  }

  /**
   * 5. GET SELLER INQUIRY SUMMARY (Dashboard counters)
   */
  async getSellerInquirySummary(sellerId) {
    const [totalCount, newCount] = await Promise.all([
      Inquiry.countDocuments({
        $or: [{ sellerId }, { seller: sellerId }]
      }),
      Inquiry.countDocuments({
        $or: [{ sellerId }, { seller: sellerId }],
        $or: [{ status: 'new' }, { isNewInquiry: true }]
      })
    ]);

    return {
      count: totalCount,
      label: 'Buyers',
      newCount
    };
  }
}

module.exports = new InquiryService();
