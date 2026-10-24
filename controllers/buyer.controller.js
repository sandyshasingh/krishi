const Product = require('../models/Product');
const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const inquiryService = require('../services/inquiry.service');
const { isValidObjectId } = require('../validators/product.validator');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { ERROR_CODES, PRODUCT_STATUS, USER_ROLES } = require('../constants');

class BuyerController {
  /**
   * 1. GET ALL LIVE PRODUCTS (Marketplace)
   * GET /api/buyer/products
   * GET /api/buyer/marketplace
   * 
   * Fetches all live, verified products with full seller information.
   * Query params: page, limit, category, search, city, state, minPrice, maxPrice, sortBy
   */
  async getLiveProducts(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      const filter = {
        status: PRODUCT_STATUS.ACTIVE,
        isDeleted: { $ne: true }
      };

      // Category filter
      if (req.query.category && req.query.category.trim()) {
        filter.category = req.query.category.trim().toLowerCase();
      }

      // Keyword search on name or localName
      if (req.query.search && req.query.search.trim()) {
        const searchRegex = new RegExp(req.query.search.trim(), 'i');
        filter.$or = [
          { name: searchRegex },
          { localName: searchRegex }
        ];
      }

      // Location filters
      if (req.query.city && req.query.city.trim()) {
        filter['location.city'] = new RegExp(req.query.city.trim(), 'i');
      }
      if (req.query.state && req.query.state.trim()) {
        filter['location.state'] = new RegExp(req.query.state.trim(), 'i');
      }

      // Price filters
      if (req.query.minPrice !== undefined && req.query.minPrice !== '') {
        const minP = Number(req.query.minPrice);
        if (!isNaN(minP)) {
          filter['expectedPrice.min'] = { $gte: minP };
        }
      }
      if (req.query.maxPrice !== undefined && req.query.maxPrice !== '') {
        const maxP = Number(req.query.maxPrice);
        if (!isNaN(maxP)) {
          filter['expectedPrice.max'] = { $lte: maxP };
        }
      }

      // Sorting
      let sort = { createdAt: -1 };
      if (req.query.sortBy === 'price_low') {
        sort = { 'expectedPrice.min': 1 };
      } else if (req.query.sortBy === 'price_high') {
        sort = { 'expectedPrice.max': -1 };
      } else if (req.query.sortBy === 'oldest') {
        sort = { createdAt: 1 };
      }

      const [totalCount, products] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('sellerId', 'name email phoneNumber phone city state pincode verificationStatus')
          .lean()
      ]);

      const formattedProducts = products.map((prod) => {
        const seller = prod.sellerId || {};
        return {
          productId: prod._id.toString(),
          name: prod.name,
          localName: prod.localName || '',
          category: prod.category,
          quantity: prod.quantity,
          expectedPrice: prod.expectedPrice,
          location: {
            city: prod.location?.city || '',
            state: prod.location?.state || '',
            pincode: prod.location?.pincode || ''
          },
          transportation: prod.transportation || { available: false },
          description: prod.description || '',
          tags: prod.tags || [],
          images: prod.images || [],
          status: prod.status,
          interestedBuyers: prod.interestedBuyers || 0,
          highestOffer: prod.highestOffer || null,
          createdAt: prod.createdAt,
          seller: {
            id: seller._id ? seller._id.toString() : (prod.seller ? prod.seller.toString() : null),
            name: seller.name || 'Seller',
            phoneNumber: seller.phoneNumber || seller.phone || '',
            phone: seller.phoneNumber || seller.phone || '',
            email: seller.email || '',
            city: seller.city || '',
            state: seller.state || '',
            verificationStatus: seller.verificationStatus || 'verified'
          }
        };
      });

      return successResponse(res, 200, 'Live products retrieved successfully', {
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        },
        products: formattedProducts
      });
    } catch (error) {
      console.error('Error fetching live buyer products:', error);
      return errorResponse(res, 500, 'Failed to fetch products', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * 2. GET SINGLE LIVE PRODUCT BY ID
   * GET /api/buyer/products/:productId
   */
  async getProductById(req, res) {
    try {
      const { productId } = req.params;

      if (!isValidObjectId(productId)) {
        return errorResponse(res, 400, 'Invalid product ID format', ERROR_CODES.VALIDATION_ERROR);
      }

      const prod = await Product.findOne({
        _id: productId,
        status: PRODUCT_STATUS.ACTIVE,
        isDeleted: { $ne: true }
      }).populate('sellerId', 'name email phoneNumber phone city state pincode verificationStatus');

      if (!prod) {
        return errorResponse(res, 404, 'Product not found or not active', ERROR_CODES.PRODUCT_NOT_FOUND);
      }

      const seller = prod.sellerId || {};
      const formatted = {
        productId: prod._id.toString(),
        name: prod.name,
        localName: prod.localName || '',
        category: prod.category,
        quantity: prod.quantity,
        expectedPrice: prod.expectedPrice,
        location: {
          city: prod.location?.city || '',
          state: prod.location?.state || '',
          pincode: prod.location?.pincode || ''
        },
        transportation: prod.transportation || { available: false },
        description: prod.description || '',
        tags: prod.tags || [],
        images: prod.images || [],
        status: prod.status,
        interestedBuyers: prod.interestedBuyers || 0,
        highestOffer: prod.highestOffer || null,
        createdAt: prod.createdAt,
        seller: {
          id: seller._id ? seller._id.toString() : (prod.seller ? prod.seller.toString() : null),
          name: seller.name || 'Seller',
          phoneNumber: seller.phoneNumber || seller.phone || '',
          email: seller.email || '',
          city: seller.city || '',
          state: seller.state || '',
          verificationStatus: seller.verificationStatus || 'verified'
        }
      };

      return successResponse(res, 200, 'Product retrieved successfully', { product: formatted });
    } catch (error) {
      console.error('Error fetching product details for buyer:', error);
      return errorResponse(res, 500, 'Failed to fetch product details', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * 3. SHOW INTEREST / SUBMIT INQUIRY
   * POST /api/buyer/inquiries
   * POST /api/buyer/products/inquire
   * POST /api/buyer/show_interest
   * 
   * Body:
   *   - productId (Required)
   *   - quantity / quantityRequested (Required: mandatory)
   *   - price / offerPrice (Optional: comfortable price)
   *   - message (Optional: custom note)
   */
  async showInterest(req, res) {
    try {
      const productId = req.body?.productId || req.body?.id;
      const quantityRaw = req.body?.quantityRequested !== undefined ? req.body?.quantityRequested : req.body?.quantity;
      const priceRaw = req.body?.offerPrice !== undefined ? req.body?.offerPrice : req.body?.price;
      const message = req.body?.message || '';

      // 1. Validate Product ID
      if (!productId) {
        return errorResponse(res, 400, 'Product ID is required in request body (e.g. { "productId": "..." })', ERROR_CODES.VALIDATION_ERROR);
      }
      if (!isValidObjectId(productId)) {
        return errorResponse(res, 400, 'Invalid product ID format', ERROR_CODES.VALIDATION_ERROR);
      }

      // 2. Validate Quantity (Mandatory)
      if (quantityRaw === undefined || quantityRaw === null || quantityRaw === '') {
        return errorResponse(res, 400, 'Quantity is mandatory. Please specify the quantity you are interested in.', ERROR_CODES.VALIDATION_ERROR);
      }
      const quantity = Number(quantityRaw);
      if (isNaN(quantity) || quantity <= 0) {
        return errorResponse(res, 400, 'Quantity must be a positive number greater than 0', ERROR_CODES.VALIDATION_ERROR);
      }

      // 3. Validate Offer Price (Optional)
      let offerPrice = null;
      if (priceRaw !== undefined && priceRaw !== null && priceRaw !== '') {
        offerPrice = Number(priceRaw);
        if (isNaN(offerPrice) || offerPrice < 0) {
          return errorResponse(res, 400, 'Offer price must be a non-negative number if provided', ERROR_CODES.VALIDATION_ERROR);
        }
      }

      // 4. Create Inquiry via service
      const result = await inquiryService.createInquiry(req.user, {
        productId,
        quantityRequested: quantity,
        offerPrice,
        message
      });

      if (!result.success) {
        if (result.code === 'PRODUCT_NOT_FOUND') {
          return errorResponse(res, 404, result.message, ERROR_CODES.PRODUCT_NOT_FOUND);
        }
        if (result.code === 'INVALID_OPERATION') {
          return errorResponse(res, 400, result.message, ERROR_CODES.INVALID_OPERATION);
        }
        return errorResponse(res, 400, result.message, ERROR_CODES.VALIDATION_ERROR);
      }

      return successResponse(res, 201, 'Interest submitted successfully! The seller has been notified with your inquiry.', {
        inquiry: result.inquiry
      });
    } catch (error) {
      console.error('Error submitting buyer interest:', error);
      return errorResponse(res, 500, 'Failed to submit interest', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * 4. GET INQUIRIES SENT BY THIS BUYER
   * GET /api/buyer/inquiries
   */
  async getMyInquiries(req, res) {
    try {
      const buyerId = req.user._id;
      const result = await inquiryService.getBuyerInquiries(buyerId, req.query);

      return successResponse(res, 200, 'Sent inquiries retrieved successfully', {
        pagination: result.pagination,
        inquiries: result.inquiries
      });
    } catch (error) {
      console.error('Error fetching buyer sent inquiries:', error);
      return errorResponse(res, 500, 'Failed to fetch inquiries', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * 5. GET PRODUCTS BUYER HAS SHOWN INTEREST IN (buyerInterests)
   * GET /api/buyer/buyerInterests
   * GET /api/buyer/buyer-interests
   * GET /api/buyer/interests
   */
  async buyerInterests(req, res) {
    try {
      const buyerId = req.user._id;
      const result = await inquiryService.getBuyerInterests(buyerId, req.query);

      return successResponse(res, 200, 'Buyer interests retrieved successfully', {
        totalInterests: result.pagination.total,
        pagination: result.pagination,
        buyerInterests: result.buyerInterests
      });
    } catch (error) {
      console.error('Error fetching buyer interests:', error);
      return errorResponse(res, 500, 'Failed to fetch buyer interests', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * 6. GET ALL FARMERS / SELLERS
   * GET /api/buyer/farmers
   * GET /api/buyer/sellers
   * 
   * Fetches list of registered farmers with their location and active crops count.
   * Query params: page, limit, search, city, state
   */
  async getFarmers(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      const filter = {
        role: USER_ROLES.SELLER
      };

      // Search keyword on name, city, state, or phone
      if (req.query.search && req.query.search.trim()) {
        const regex = new RegExp(req.query.search.trim(), 'i');
        filter.$or = [
          { name: regex },
          { city: regex },
          { state: regex },
          { phoneNumber: regex }
        ];
      }

      // Location filters
      if (req.query.city && req.query.city.trim()) {
        filter.city = new RegExp(req.query.city.trim(), 'i');
      }
      if (req.query.state && req.query.state.trim()) {
        filter.state = new RegExp(req.query.state.trim(), 'i');
      }

      const [totalCount, farmers] = await Promise.all([
        User.countDocuments(filter),
        User.find(filter)
          .select('-password -resetPasswordToken -resetPasswordExpires')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      ]);

      const farmerIds = farmers.map((f) => f._id);

      // Fetch active crops count and categories for all retrieved farmers
      const [productStats, profiles] = await Promise.all([
        Product.aggregate([
          {
            $match: {
              $or: [
                { sellerId: { $in: farmerIds } },
                { seller: { $in: farmerIds } }
              ],
              status: PRODUCT_STATUS.ACTIVE,
              isDeleted: { $ne: true }
            }
          },
          {
            $group: {
              _id: { $ifNull: ['$sellerId', '$seller'] },
              activeCropsCount: { $sum: 1 },
              categories: { $addToSet: '$category' }
            }
          }
        ]),
        SellerProfile.find({ user: { $in: farmerIds } }).lean()
      ]);

      const statsMap = {};
      productStats.forEach((st) => {
        if (st._id) statsMap[st._id.toString()] = st;
      });

      const profileMap = {};
      profiles.forEach((pr) => {
        if (pr.user) profileMap[pr.user.toString()] = pr;
      });

      const formattedFarmers = farmers.map((f) => {
        const idStr = f._id.toString();
        const stat = statsMap[idStr] || { activeCropsCount: 0, categories: [] };
        const prof = profileMap[idStr] || {};

        return {
          farmerId: idStr,
          name: f.name,
          phoneNumber: f.phoneNumber || f.phone || '',
          email: f.email || '',
          location: {
            address: f.address || '',
            city: f.city || '',
            state: f.state || '',
            pincode: f.pincode || ''
          },
          verificationStatus: f.verificationStatus || 'verified',
          farmName: prof.farmName || '',
          businessType: prof.businessType || 'individual_farmer',
          rating: prof.rating || 4.5,
          activeCropsCount: stat.activeCropsCount,
          categories: stat.categories || [],
          memberSince: f.createdAt
        };
      });

      return successResponse(res, 200, 'Farmers retrieved successfully', {
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        },
        farmers: formattedFarmers
      });
    } catch (error) {
      console.error('Error fetching farmers for buyer:', error);
      return errorResponse(res, 500, 'Failed to fetch farmers list', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * 7. GET A SPECIFIC FARMER & ALL HIS LISTED PRODUCTS
   * GET /api/buyer/farmers/:farmerId/products
   * GET /api/buyer/farmers/:farmerId
   * 
   * When buyer clicks a farmer, returns the farmer profile + all their live listings.
   * Query params: page, limit, category, search
   */
  async getFarmerProducts(req, res) {
    try {
      const { farmerId } = req.params;

      if (!isValidObjectId(farmerId)) {
        return errorResponse(res, 400, 'Invalid farmer ID format', ERROR_CODES.VALIDATION_ERROR);
      }

      const farmer = await User.findOne({
        _id: farmerId,
        role: USER_ROLES.SELLER
      }).select('-password -resetPasswordToken -resetPasswordExpires');

      if (!farmer) {
        return errorResponse(res, 404, 'Farmer not found', ERROR_CODES.USER_NOT_FOUND);
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;

      const productFilter = {
        $or: [{ sellerId: farmer._id }, { seller: farmer._id }],
        status: PRODUCT_STATUS.ACTIVE,
        isDeleted: { $ne: true }
      };

      if (req.query.category && req.query.category.trim()) {
        productFilter.category = req.query.category.trim().toLowerCase();
      }

      if (req.query.search && req.query.search.trim()) {
        const regex = new RegExp(req.query.search.trim(), 'i');
        productFilter.$or = [
          { name: regex },
          { localName: regex }
        ];
      }

      const [totalCount, products, profile] = await Promise.all([
        Product.countDocuments(productFilter),
        Product.find(productFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        SellerProfile.findOne({ user: farmer._id }).lean()
      ]);

      const formattedProducts = products.map((prod) => ({
        productId: prod._id.toString(),
        name: prod.name,
        localName: prod.localName || '',
        category: prod.category,
        quantity: prod.quantity,
        expectedPrice: prod.expectedPrice,
        location: {
          city: prod.location?.city || '',
          state: prod.location?.state || '',
          pincode: prod.location?.pincode || ''
        },
        transportation: prod.transportation || { available: false },
        description: prod.description || '',
        tags: prod.tags || [],
        images: prod.images || [],
        status: prod.status,
        interestedBuyers: prod.interestedBuyers || 0,
        highestOffer: prod.highestOffer || null,
        createdAt: prod.createdAt
      }));

      return successResponse(res, 200, 'Farmer and listed products retrieved successfully', {
        farmer: {
          farmerId: farmer._id.toString(),
          name: farmer.name,
          phoneNumber: farmer.phoneNumber || farmer.phone || '',
          email: farmer.email || '',
          location: {
            address: farmer.address || '',
            city: farmer.city || '',
            state: farmer.state || '',
            pincode: farmer.pincode || ''
          },
          verificationStatus: farmer.verificationStatus || 'verified',
          farmName: profile?.farmName || '',
          businessType: profile?.businessType || 'individual_farmer',
          rating: profile?.rating || 4.5,
          totalListedCrops: totalCount,
          memberSince: farmer.createdAt
        },
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        },
        products: formattedProducts
      });
    } catch (error) {
      console.error('Error fetching farmer products for buyer:', error);
      return errorResponse(res, 500, 'Failed to fetch farmer products', ERROR_CODES.SERVER_ERROR);
    }
  }
}

module.exports = new BuyerController();
