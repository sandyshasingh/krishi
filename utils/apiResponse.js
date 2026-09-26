const { ERROR_CODES } = require('../constants');

/**
 * Send standard success response
 */
function successResponse(res, statusCode = 200, message = 'Success', data = null) {
  const response = {
    success: true
  };

  if (message) {
    response.message = message;
  }

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send standard error response matching specification:
 * {
 *   "success": false,
 *   "message": "...",
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "details": ... (optional)
 *   }
 * }
 */
function errorResponse(res, statusCode = 400, message = 'An error occurred', errorCode = ERROR_CODES.SERVER_ERROR, details = null) {
  const response = {
    success: false,
    message,
    error: {
      code: errorCode
    }
  };

  if (details !== null && details !== undefined) {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
}

module.exports = {
  successResponse,
  errorResponse
};
