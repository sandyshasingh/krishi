const Inquiry = require('../models/Inquiry');
const Product = require('../models/Product');

/**
 * Inquiry Service
 */
class InquiryService {
  /**
   * Get inquiries for a specific product belonging to the authenticated seller
   */
  async getProductInquiriesForSeller(sellerId, productId) {
    // 1. Verify that the product exists and belongs to this seller
    const product = await Product.findOne({
      _id: productId,
      $or: [{ sellerId }, { seller: sellerId }],
      isDeleted: { $ne: true }
    });

    if (!product) {
      return null;
    }

    // 2. Fetch inquiries for this product
    const inquiries = await Inquiry.find({
      $or: [{ productId }, { product: productId }],
      $or: [{ sellerId }, { seller: sellerId }]
    }).sort({ createdAt: -1 });

    return inquiries.map((inq) => inq.toClientJSON());
  }

  /**
   * Get total inquiries count and new inquiries count for seller dashboard
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
