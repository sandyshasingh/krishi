const inquiryService = require('../services/inquiry.service');
const { isValidObjectId } = require('../validators/product.validator');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { ERROR_CODES } = require('../constants');

class InquiryController {
  /**
   * Get inquiries for a seller's product
   * GET /api/seller/products/:productId/inquiries
   */
  async getProductInquiries(req, res) {
    try {
      const { productId } = req.params;

      if (!isValidObjectId(productId)) {
        return errorResponse(res, 400, 'Invalid product ID format', ERROR_CODES.VALIDATION_ERROR);
      }

      const sellerId = req.user._id;
      const inquiries = await inquiryService.getProductInquiriesForSeller(sellerId, productId);

      if (inquiries === null) {
        return errorResponse(res, 404, 'Product not found or unauthorized', ERROR_CODES.PRODUCT_NOT_FOUND);
      }

      return res.status(200).json({
        success: true,
        data: {
          inquiries
        }
      });
    } catch (error) {
      console.error('Error fetching product inquiries:', error);
      return errorResponse(res, 500, 'Failed to fetch inquiries', ERROR_CODES.SERVER_ERROR);
    }
  }
}

module.exports = new InquiryController();
