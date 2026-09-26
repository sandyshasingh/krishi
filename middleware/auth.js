const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'krishi_jwt_secret_key_2026';

/**
 * Middleware to verify JWT token and authenticate user
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({
      message: 'Access denied: No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains userId, role, email
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token'
    });
  }
}

/**
 * Middleware to restrict access based on user role
 * @param  {...string} allowedRoles Roles permitted to access the route ('buyer', 'seller', etc.)
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        message: 'Unauthorized: User authentication required'
      });
    }

    const userRole = req.user.role.toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: `Forbidden: Access restricted to ${allowedRoles.join(' / ')}. Your role (${req.user.role}) is not authorized.`
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
