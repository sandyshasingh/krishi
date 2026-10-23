const inquiryService = require('../services/inquiry.service');
const { isValidObjectId } = require('../validators/product.validator');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { ERROR_CODES } = require('../constants');

class InquiryController {
  /**
   * 1. Get all inquiries across all products for authenticated seller
   * GET /api/seller/inquiries
   * GET /api/seller/all_inquiries
   */
  async getAllSellerInquiries(req, res) {
    try {
      const sellerId = req.user._id;
      const result = await inquiryService.getAllSellerInquiries(sellerId, req.query);

      return successResponse(res, 200, 'Seller inquiries retrieved successfully', {
        pagination: result.pagination,
        inquiries: result.inquiries
      });
    } catch (error) {
      console.error('Error fetching all seller inquiries:', error);
      return errorResponse(res, 500, 'Failed to fetch inquiries', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * 2. Get inquiries for a specific seller's product
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

      return successResponse(res, 200, 'Product inquiries retrieved successfully', {
        productId,
        inquiries
      });
    } catch (error) {
      console.error('Error fetching product inquiries:', error);
      return errorResponse(res, 500, 'Failed to fetch inquiries', ERROR_CODES.SERVER_ERROR);
    }
  }
}

module.exports = new InquiryController();
