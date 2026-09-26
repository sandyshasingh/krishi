const multer = require('multer');
const { ERROR_CODES } = require('../constants');
const { errorResponse } = require('../utils/apiResponse');

// Use MemoryStorage so that the StorageService can manage file writing
const storage = multer.memoryStorage();

// Allowed MIME types for crop/produce photos
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// File filter for image verification
function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, JPG, PNG, and WEBP image files are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
}

// Multer upload instance configured for max 5 images, 5MB each
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 5 // Maximum 5 photos
  }
});

// Middleware wrapper with custom error response formatting
function uploadProductImages(req, res, next) {
  // Support both 'images' and 'photos' form field names
  const uploadHandler = upload.array('images', 5);

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return errorResponse(
            res,
            400,
            'File size exceeds limit. Maximum allowed size is 5MB per image.',
            ERROR_CODES.FILE_TOO_LARGE
          );
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return errorResponse(
            res,
            400,
            'Maximum 5 images can be uploaded for a product.',
            ERROR_CODES.TOO_MANY_FILES
          );
        }
        return errorResponse(res, 400, err.message, ERROR_CODES.VALIDATION_ERROR);
      }

      if (err.code === 'INVALID_FILE_TYPE') {
        return errorResponse(res, 400, err.message, ERROR_CODES.INVALID_FILE_TYPE);
      }

      return errorResponse(res, 400, err.message || 'Error processing uploaded images', ERROR_CODES.VALIDATION_ERROR);
    }

    if (!req.files || req.files.length === 0) {
      return errorResponse(
        res,
        400,
        'No image files provided. Please upload at least 1 image (up to 5 images).',
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    next();
  });
}

module.exports = {
  uploadProductImages
};
