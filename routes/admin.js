const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { USER_ROLES } = require('../constants');

// All admin endpoints require authentication and verified 'admin' role in database
router.use(authenticateToken);
router.use(authorizeRoles(USER_ROLES.ADMIN));

/**
 * ==================================================
 * 1. SEE ALL PUBLISH PRODUCT REQUESTS
 * Endpoints:
 *   GET /api/admin/products/publish-requests
 *   GET /api/admin/publish_requests
 * Query Params: page, limit, category, search
 * ==================================================
 */
router.get('/products/publish-requests', (req, res) => adminController.getPublishRequests(req, res));
router.get('/publish_requests', (req, res) => adminController.getPublishRequests(req, res));

/**
 * ==================================================
 * 2. VERIFY PRODUCT & MAKE VISIBLE TO BUYERS
 * Endpoints:
 *   POST /api/admin/products/verify (productId in body)
 *   POST /api/admin/verify_product (productId in body)
 * Request Body:
 *   {
 *     "productId": "64f1a2b3c4d5e6f7a8b9c0d1",
 *     "action": "approve" | "reject",   // default is approve
 *     "reason": "optional rejection note"
 *   }
 * ==================================================
 */
router.post('/products/verify', (req, res) => adminController.verifyProduct(req, res));
router.post('/verify_product', (req, res) => adminController.verifyProduct(req, res));
router.post('/products/:productId/verify', (req, res) => adminController.verifyProduct(req, res));

/**
 * ==================================================
 * 3. GET SINGLE PRODUCT DETAILS FOR ADMIN INSPECTION
 * Endpoint: GET /api/admin/products/:productId
 * ==================================================
 */
router.get('/products/:productId', (req, res) => adminController.getProductDetails(req, res));

module.exports = router;
