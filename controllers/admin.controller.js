const Product = require('../models/Product');
const User = require('../models/User');
const { isValidObjectId } = require('../validators/product.validator');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { ERROR_CODES, PRODUCT_STATUS, VERIFICATION_STATUS } = require('../constants');

class AdminController {
  /**
   * 1. GET ALL PUBLISH PRODUCT REQUESTS
   * GET /api/admin/products/publish-requests
   * GET /api/admin/publish_requests
   * 
   * Retrieves all product listings submitted by sellers that are awaiting admin verification.
   */
  async getPublishRequests(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      // Filter: only products pending verification and not deleted
      const filter = {
        status: PRODUCT_STATUS.PENDING_VERIFICATION,
        isDeleted: { $ne: true }
      };

      // Optional category filter
      if (req.query.category && req.query.category.trim()) {
        filter.category = req.query.category.trim().toLowerCase();
      }

      // Optional text search on name or localName
      if (req.query.search && req.query.search.trim()) {
        const searchRegex = new RegExp(req.query.search.trim(), 'i');
        filter.$or = [
          { name: searchRegex },
          { localName: searchRegex }
        ];
      }

      const [totalCount, products] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('sellerId', 'name email phoneNumber phone city state pincode verificationStatus')
          .lean()
      ]);

      const formattedRequests = products.map((prod) => {
        const seller = prod.sellerId || {};
        return {
          productId: prod._id.toString(),
          name: prod.name,
          localName: prod.localName || '',
          category: prod.category,
          quantity: prod.quantity,
          expectedPrice: prod.expectedPrice,
          location: prod.location,
          transportation: prod.transportation,
          description: prod.description || '',
          tags: prod.tags || [],
          images: prod.images || [],
          status: prod.status,
          verificationStatus: prod.verificationStatus,
          submittedAt: prod.updatedAt,
          createdAt: prod.createdAt,
          seller: {
            id: seller._id ? seller._id.toString() : (prod.seller ? prod.seller.toString() : null),
            name: seller.name || 'Unknown',
            email: seller.email || '',
            phoneNumber: seller.phoneNumber || seller.phone || '',
            city: seller.city || '',
            state: seller.state || '',
            verificationStatus: seller.verificationStatus || 'unverified'
          }
        };
      });

      return successResponse(res, 200, 'Publish product requests retrieved successfully', {
        summary: {
          pendingRequestsCount: totalCount
        },
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        },
        requests: formattedRequests
      });
    } catch (error) {
      console.error('Error fetching admin publish requests:', error);
      return errorResponse(res, 500, 'Failed to fetch publish product requests', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * 2. VERIFY PRODUCT (APPROVE / REJECT)
   * POST /api/admin/products/verify
   * POST /api/admin/verify_product
   * 
   * Approves a product (sets status to 'active' & verificationStatus to 'verified')
   * making it immediately discoverable and visible to buyers in the marketplace.
   * Can also be used to reject a product by passing action: 'reject'.
   */
  async verifyProduct(req, res) {
    try {
      const productId = req.body?.productId || req.body?.id || req.params?.productId;
      const action = (req.body?.action || 'approve').toLowerCase().trim();
      const reason = req.body?.reason || req.body?.notes || '';

      if (!productId) {
        return errorResponse(res, 400, 'Product ID is required in request body (e.g. { "productId": "..." })', ERROR_CODES.VALIDATION_ERROR);
      }

      if (!isValidObjectId(productId)) {
        return errorResponse(res, 400, 'Invalid product ID format', ERROR_CODES.VALIDATION_ERROR);
      }

      const product = await Product.findOne({
        _id: productId,
        isDeleted: { $ne: true }
      }).populate('sellerId', 'name email phoneNumber city state');

      if (!product) {
        return errorResponse(res, 404, 'Product not found', ERROR_CODES.PRODUCT_NOT_FOUND);
      }

      const adminId = req.user._id;

      if (action === 'reject') {
        product.status = PRODUCT_STATUS.REJECTED;
        product.verificationStatus = VERIFICATION_STATUS.REJECTED;
        product.verifiedBy = adminId;
        product.verifiedAt = new Date();
        product.rejectionReason = reason || 'Product submission was rejected by admin';

        await product.save();

        return successResponse(res, 200, 'Product verification rejected', {
          productId: product._id.toString(),
          name: product.name,
          status: product.status,
          verificationStatus: product.verificationStatus,
          rejectionReason: product.rejectionReason,
          verifiedAt: product.verifiedAt
        });
      }

      // Default action: APPROVE / VERIFY -> make visible to buyers
      product.status = PRODUCT_STATUS.ACTIVE;
      product.verificationStatus = VERIFICATION_STATUS.VERIFIED;
      product.verifiedBy = adminId;
      product.verifiedAt = new Date();
      product.rejectionReason = '';

      await product.save();

      return successResponse(res, 200, 'Product successfully verified and published to marketplace (now visible to buyers)', {
        productId: product._id.toString(),
        name: product.name,
        category: product.category,
        status: product.status,
        verificationStatus: product.verificationStatus,
        verifiedAt: product.verifiedAt,
        seller: {
          id: product.sellerId?._id?.toString() || (product.seller ? product.seller.toString() : null),
          name: product.sellerId?.name || '',
          email: product.sellerId?.email || '',
          phone: product.sellerId?.phoneNumber || ''
        }
      });
    } catch (error) {
      console.error('Error verifying product:', error);
      return errorResponse(res, 500, error.message || 'Failed to verify product', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * 3. GET SINGLE PRODUCT DETAILS FOR ADMIN INSPECTION
   * GET /api/admin/products/:productId
   */
  async getProductDetails(req, res) {
    try {
      const productId = req.params?.productId || req.body?.productId;

      if (!productId || !isValidObjectId(productId)) {
        return errorResponse(res, 400, 'Invalid or missing product ID', ERROR_CODES.VALIDATION_ERROR);
      }

      const product = await Product.findOne({
        _id: productId,
        isDeleted: { $ne: true }
      })
        .populate('sellerId', 'name email phoneNumber phone address city state pincode verificationStatus')
        .populate('verifiedBy', 'name email');

      if (!product) {
        return errorResponse(res, 404, 'Product not found', ERROR_CODES.PRODUCT_NOT_FOUND);
      }

      return successResponse(res, 200, 'Product details retrieved successfully', {
        product: {
          ...product.toSellerJSON(),
          seller: product.sellerId,
          verifiedBy: product.verifiedBy ? { id: product.verifiedBy._id, name: product.verifiedBy.name, email: product.verifiedBy.email } : null
        }
      });
    } catch (error) {
      console.error('Error retrieving product details for admin:', error);
      return errorResponse(res, 500, 'Failed to retrieve product details', ERROR_CODES.SERVER_ERROR);
    }
  }
}

module.exports = new AdminController();
