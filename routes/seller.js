const express = require('express');
const router = express.Router();

const productController = require('../controllers/product.controller');
const inquiryController = require('../controllers/inquiry.controller');
const productService = require('../services/product.service');
const inquiryService = require('../services/inquiry.service');
const Product = require('../models/Product');
const MandiTrend = require('../models/MandiTrend');
const MandiPrice = require('../models/MandiPrice');

const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { uploadProductImages } = require('../middleware/upload.middleware');
const { USER_ROLES, PRODUCT_STATUS } = require('../constants');

// All seller endpoints require authentication and verified 'seller' role from database
router.use(authenticateToken);
router.use(authorizeRoles(USER_ROLES.SELLER));

/**
 * ==================================================
 * 3. SELLER DASHBOARD API
 * Endpoint: GET /api/seller/dashboard
 * Access: Seller only (verified from database record)
 * ==================================================
 */
router.get('/dashboard', async (req, res) => {
  try {
    const sellerId = req.user._id;

    // 1. Dynamic active listings count (calculated from seller's active, non-deleted products)
    const activeListingsCount = await Product.countDocuments({
      $or: [{ sellerId }, { seller: sellerId }],
      status: PRODUCT_STATUS.ACTIVE,
      isDeleted: { $ne: true }
    });

    // 2. Dynamic inquiries summary (calculated from actual inquiries)
    const inquirySummary = await inquiryService.getSellerInquirySummary(sellerId);

    // 3. Mandi market trend (fetched from MandiPrice / MandiTrend database)
    const sellerState = req.user.state || '';
    let trend = await MandiPrice.findOne({
      $or: [
        { state: new RegExp(sellerState, 'i') },
        { region: new RegExp(sellerState, 'i') },
        { commodity: 'Wheat' }
      ]
    });

    if (!trend) {
      trend = await MandiTrend.findOne({
        $or: [
          { state: new RegExp(sellerState, 'i') },
          { region: new RegExp(sellerState, 'i') },
          { commodity: 'Wheat' }
        ]
      });
    }

    const regionCode = sellerState.toUpperCase().includes('UTTAR') ? 'UP' : (sellerState || 'UP');
    const mandiTrendData = {
      percentage: trend?.percentage || trend?.percentageChange || 4,
      direction: trend?.direction || 'up',
      commodity: trend?.commodity || 'Wheat',
      region: trend?.region || regionCode
    };

    // 4. Products query (supports pagination and status filter)
    const productsResult = await productService.getSellerProducts(sellerId, req.query);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          name: req.user.name,
          location: {
            city: req.user.city || '',
            state: req.user.state || ''
          },
          verificationStatus: req.user.verificationStatus || 'verified'
        },
        summary: {
          activeListings: {
            count: activeListingsCount,
            label: 'Crops'
          },
          totalInquiries: inquirySummary,
          mandiTrend: mandiTrendData
        },
        products: productsResult.products,
        pagination: productsResult.pagination
      }
    });
  } catch (error) {
    console.error('Error fetching seller dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch seller dashboard data'
    });
  }
});

/**
 * ==================================================
 * 7. PRODUCT PHOTOS UPLOAD
 * Endpoint: POST /api/seller/products/images
 * ==================================================
 */
router.post('/products/images', uploadProductImages, (req, res) => {
  return productController.uploadImages(req, res);
});

/**
 * ==================================================
 * 6. ADD PRODUCT API
 * Endpoints:
 *   POST /api/seller/add_product (exact user request)
 *   POST /api/seller/products (REST standard)
 * ==================================================
 */
router.post('/add_product', (req, res) => productController.addProduct(req, res));
router.post('/products', (req, res) => productController.addProduct(req, res));

/**
 * ==================================================
 * GET ALL SELLER PRODUCTS
 * Endpoint: GET /api/seller/products
 * ==================================================
 */
router.get('/products', (req, res) => productController.getProducts(req, res));

/**
 * ==================================================
 * 11 & 15. PRODUCT DETAILS & PREVIEW
 * Endpoint: GET /api/seller/products/:productId
 * ==================================================
 */
router.get('/products/:productId', (req, res) => productController.getProductById(req, res));

/**
 * ==================================================
 * 13. EDIT PRODUCT
 * Endpoints: PUT & PATCH /api/seller/products/:productId
 * ==================================================
 */
router.put('/products/:productId', (req, res) => productController.updateProduct(req, res));
router.patch('/products/:productId', (req, res) => productController.updateProduct(req, res));

/**
 * ==================================================
 * 12. PUBLISH PRODUCT
 * Endpoint: POST /api/seller/products/:productId/publish
 * ==================================================
 */
router.post('/products/:productId/publish', (req, res) => productController.publishProduct(req, res));

/**
 * ==================================================
 * 14. DELETE PRODUCT (Soft delete)
 * Endpoint: DELETE /api/seller/products/:productId
 * ==================================================
 */
router.delete('/products/:productId', (req, res) => productController.deleteProduct(req, res));

/**
 * ==================================================
 * 16. PRODUCT INQUIRIES
 * Endpoint: GET /api/seller/products/:productId/inquiries
 * ==================================================
 */
router.get('/products/:productId/inquiries', (req, res) => inquiryController.getProductInquiries(req, res));

module.exports = router;
