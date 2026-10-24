const express = require('express');
const router = express.Router();

const buyerController = require('../controllers/buyer.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { USER_ROLES } = require('../constants');

// Buyer authentication & role authorization
router.use(authenticateToken);
router.use(authorizeRoles(USER_ROLES.BUYER, USER_ROLES.ADMIN));

/**
 * ==================================================
 * 1. BUYER DASHBOARD
 * Endpoint: GET /api/buyer/dashboard
 * ==================================================
 */
router.get('/dashboard', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Welcome to Buyer Dashboard',
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phoneNumber || req.user.phone || '',
      city: req.user.city || '',
      state: req.user.state || '',
      verificationStatus: req.user.verificationStatus || 'verified'
    },
    screensAllowed: [
      'BUYER_MARKETPLACE',
      'EXPLORE_CROPS_AND_PRODUCE',
      'CREATE_PURCHASE_ORDER',
      'TRACK_DELIVERIES',
      'PURCHASE_HISTORY_AND_INVOICES'
    ]
  });
});

/**
 * ==================================================
 * 2. BROWSE LIVE PRODUCTS WITH SELLER INFO
 * Endpoints:
 *   GET /api/buyer/products
 *   GET /api/buyer/marketplace
 * Query Params: page, limit, category, search, city, state, minPrice, maxPrice, sortBy
 * ==================================================
 */
router.get('/products', (req, res) => buyerController.getLiveProducts(req, res));
router.get('/marketplace', (req, res) => buyerController.getLiveProducts(req, res));

/**
 * ==================================================
 * 3. VIEW SINGLE PRODUCT DETAILS
 * Endpoint: GET /api/buyer/products/:productId
 * ==================================================
 */
router.get('/products/:productId', (req, res) => buyerController.getProductById(req, res));

/**
 * ==================================================
 * 4. SHOW INTEREST / SUBMIT INQUIRY
 * Endpoints:
 *   POST /api/buyer/inquiries
 *   POST /api/buyer/products/inquire
 *   POST /api/buyer/show_interest
 * Request Body:
 *   {
 *     "productId": "64f1a2b3c4d5e6f7a8b9c0d1", // Required
 *     "quantity": 10,                         // Required (Mandatory)
 *     "price": 2700,                          // Optional (Comfortable price)
 *     "message": "Ready to buy this week"     // Optional
 *   }
 * ==================================================
 */
router.post('/inquiries', (req, res) => buyerController.showInterest(req, res));
router.post('/products/inquire', (req, res) => buyerController.showInterest(req, res));
router.post('/show_interest', (req, res) => buyerController.showInterest(req, res));

/**
 * ==================================================
 * 5. VIEW INQUIRIES SENT BY THIS BUYER
 * Endpoint: GET /api/buyer/inquiries
 * ==================================================
 */
router.get('/inquiries', (req, res) => buyerController.getMyInquiries(req, res));

/**
 * ==================================================
 * 6. LIST OF PRODUCTS BUYER HAS SHOWN INTEREST IN (buyerInterests)
 * Endpoints:
 *   GET /api/buyer/buyerInterests (exact requested name)
 *   GET /api/buyer/buyer-interests
 *   GET /api/buyer/interests
 * Query Params: page, limit
 * ==================================================
 */
router.get('/buyerInterests', (req, res) => buyerController.buyerInterests(req, res));
router.get('/buyer-interests', (req, res) => buyerController.buyerInterests(req, res));
router.get('/interests', (req, res) => buyerController.buyerInterests(req, res));

/**
 * ==================================================
 * 7. BROWSE ALL FARMERS / SELLERS
 * Endpoints:
 *   GET /api/buyer/farmers
 *   GET /api/buyer/sellers
 * Query Params: page, limit, search, city, state
 * ==================================================
 */
router.get('/farmers', (req, res) => buyerController.getFarmers(req, res));
router.get('/sellers', (req, res) => buyerController.getFarmers(req, res));

/**
 * ==================================================
 * 8. GET A SPECIFIC FARMER & HIS LISTED PRODUCTS
 * Endpoints:
 *   GET /api/buyer/farmers/:farmerId/products
 *   GET /api/buyer/farmers/:farmerId
 * Query Params: page, limit, category, search
 * ==================================================
 */
router.get('/farmers/:farmerId/products', (req, res) => buyerController.getFarmerProducts(req, res));
router.get('/farmers/:farmerId', (req, res) => buyerController.getFarmerProducts(req, res));

module.exports = router;
