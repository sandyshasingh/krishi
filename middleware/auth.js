const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'krishi_jwt_secret_key_2026';

/**
 * Middleware to verify JWT token and authenticate user directly against database record.
 * GUARANTEE: User's role and identity always come from the database record, never trusted from client input.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload'
      });
    }

    // Role MUST come from the authenticated user's database record
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User account not found'
      });
    }

    // Attach verified database user record to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

/**
 * Middleware to restrict access based on verified database role
 * @param  {...string} allowedRoles Roles permitted ('seller', 'buyer', 'admin')
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Authentication required'
      });
    }

    const userDbRole = String(req.user.role).toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => String(r).toLowerCase());

    if (!normalizedAllowed.includes(userDbRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to ${allowedRoles.join(' / ')}. Your database role (${req.user.role}) is not authorized.`
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  JWT_SECRET
};
