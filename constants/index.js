/**
 * User Roles Enum
 */
const USER_ROLES = Object.freeze({
  SELLER: 'seller',
  BUYER: 'buyer',
  ADMIN: 'admin'
});

const ALL_ROLES = Object.freeze(Object.values(USER_ROLES));

/**
 * Product Statuses Enum
 */
const PRODUCT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  SOLD: 'sold',
  EXPIRED: 'expired'
});

const ALL_PRODUCT_STATUSES = Object.freeze(Object.values(PRODUCT_STATUS));

/**
 * Verification Statuses Enum
 */
const VERIFICATION_STATUS = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected'
});

const ALL_VERIFICATION_STATUSES = Object.freeze(Object.values(VERIFICATION_STATUS));

/**
 * Inquiry Statuses Enum
 */
const INQUIRY_STATUS = Object.freeze({
  NEW: 'new',
  READ: 'read',
  RESPONDED: 'responded',
  CLOSED: 'closed'
});

const ALL_INQUIRY_STATUSES = Object.freeze(Object.values(INQUIRY_STATUS));

/**
 * Application Error Codes Enum
 */
const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  INQUIRY_NOT_FOUND: 'INQUIRY_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_OPERATION: 'INVALID_OPERATION',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  TOO_MANY_FILES: 'TOO_MANY_FILES',
  CONFLICT: 'CONFLICT',
  SERVER_ERROR: 'SERVER_ERROR'
});

module.exports = {
  USER_ROLES,
  ALL_ROLES,
  PRODUCT_STATUS,
  ALL_PRODUCT_STATUSES,
  VERIFICATION_STATUS,
  ALL_VERIFICATION_STATUSES,
  INQUIRY_STATUS,
  ALL_INQUIRY_STATUSES,
  ERROR_CODES
};
