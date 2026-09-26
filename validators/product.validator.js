const mongoose = require('mongoose');

/**
 * Validate MongoDB ObjectId
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Validate Add Product Request
 */
function validateAddProduct(body) {
  const errors = [];

  if (!body) {
    return { isValid: false, errors: ['Request body cannot be empty'] };
  }

  // 1. Name
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Product name is required');
  } else if (body.name.trim().length > 100) {
    errors.push('Product name cannot exceed 100 characters');
  }

  // 2. Category
  if (!body.category || typeof body.category !== 'string' || !body.category.trim()) {
    errors.push('Category is required');
  }

  // 3. Quantity
  if (!body.quantity || typeof body.quantity !== 'object') {
    errors.push('Quantity object with value and unit is required');
  } else {
    const val = Number(body.quantity.value);
    if (isNaN(val) || val <= 0) {
      errors.push('Quantity value must be a positive number greater than 0');
    }
    if (!body.quantity.unit || typeof body.quantity.unit !== 'string' || !body.quantity.unit.trim()) {
      errors.push('Quantity unit is required (e.g. KG, Quintal, Ton)');
    }
  }

  // 4. Expected Price
  if (!body.expectedPrice || typeof body.expectedPrice !== 'object') {
    errors.push('Expected price object with min, max, and unit is required');
  } else {
    const min = Number(body.expectedPrice.min);
    const max = Number(body.expectedPrice.max);

    if (isNaN(min) || min < 0) {
      errors.push('Minimum expected price must be a non-negative number');
    }
    if (isNaN(max) || max < 0) {
      errors.push('Maximum expected price must be a non-negative number');
    }
    if (!isNaN(min) && !isNaN(max) && min > max) {
      errors.push('Minimum expected price cannot be greater than maximum expected price');
    }
    if (!body.expectedPrice.unit || typeof body.expectedPrice.unit !== 'string' || !body.expectedPrice.unit.trim()) {
      errors.push('Expected price unit is required (e.g. KG, Quintal)');
    }
  }

  // 5. Location
  if (!body.location || typeof body.location !== 'object') {
    errors.push('Location object with city, state, and pincode is required');
  } else {
    if (!body.location.city || typeof body.location.city !== 'string' || !body.location.city.trim()) {
      errors.push('Location city is required');
    }
    if (!body.location.state || typeof body.location.state !== 'string' || !body.location.state.trim()) {
      errors.push('Location state is required');
    }
    if (!body.location.pincode || typeof body.location.pincode !== 'string' || !body.location.pincode.trim()) {
      errors.push('Location pincode is required');
    }
    if (body.location.latitude !== undefined && body.location.latitude !== null) {
      const lat = Number(body.location.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.push('Latitude must be a valid number between -90 and 90');
      }
    }
    if (body.location.longitude !== undefined && body.location.longitude !== null) {
      const lng = Number(body.location.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.push('Longitude must be a valid number between -180 and 180');
      }
    }
  }

  // 6. Description (Max 300 chars)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push('Description must be a string');
    } else if (body.description.length > 300) {
      errors.push('Description cannot exceed 300 characters');
    }
  }

  // 7. Tags
  if (body.tags !== undefined && body.tags !== null) {
    if (!Array.isArray(body.tags)) {
      errors.push('Tags must be an array of strings');
    }
  }

  // 8. Transportation (optional)
  if (body.transportation !== undefined && body.transportation !== null) {
    if (typeof body.transportation !== 'object') {
      errors.push('Transportation must be an object');
    } else {
      if (body.transportation.deliveryRadiusKm !== undefined && body.transportation.deliveryRadiusKm !== null) {
        const rad = Number(body.transportation.deliveryRadiusKm);
        if (isNaN(rad) || rad < 0) {
          errors.push('Delivery radius must be a non-negative number');
        }
      }
      if (body.transportation.terms && typeof body.transportation.terms === 'string' && body.transportation.terms.length > 200) {
        errors.push('Transportation terms cannot exceed 200 characters');
      }
    }
  }

  // 9. Images (optional in draft, max 5)
  if (body.images !== undefined && body.images !== null) {
    if (!Array.isArray(body.images)) {
      errors.push('Images must be an array');
    } else if (body.images.length > 5) {
      errors.push('A maximum of 5 images can be attached to a product');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate Product Before Publishing
 */
function validatePublishProduct(product) {
  const errors = [];

  if (!product.name || !product.name.trim()) {
    errors.push('Product name is required for publishing');
  }

  if (!product.category || !product.category.trim()) {
    errors.push('Category is required for publishing');
  }

  if (!product.quantity || !product.quantity.value || product.quantity.value <= 0 || !product.quantity.unit) {
    errors.push('Valid quantity (value > 0 and unit) is required for publishing');
  }

  if (
    !product.expectedPrice ||
    product.expectedPrice.min === undefined ||
    product.expectedPrice.max === undefined ||
    product.expectedPrice.min < 0 ||
    product.expectedPrice.max < product.expectedPrice.min ||
    !product.expectedPrice.unit
  ) {
    errors.push('Valid expected price range (min <= max and unit) is required for publishing');
  }

  if (
    !product.location ||
    !product.location.city ||
    !product.location.state ||
    !product.location.pincode
  ) {
    errors.push('Complete location (city, state, pincode) is required for publishing');
  }

  if (!product.images || product.images.length === 0) {
    errors.push('At least one product photo is required to publish this product');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  isValidObjectId,
  validateAddProduct,
  validatePublishProduct
};
