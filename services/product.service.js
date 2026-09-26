const Product = require('../models/Product');
const { PRODUCT_STATUS, ALL_PRODUCT_STATUSES } = require('../constants');
const { validatePublishProduct } = require('../validators/product.validator');

/**
 * Product Service containing all business logic for Products
 */
class ProductService {
  /**
   * Create a new product for an authenticated seller
   */
  async createProduct(sellerId, productData) {
    // 1. Force the sellerId from the authenticated user context
    const initialStatus = productData.status && ALL_PRODUCT_STATUSES.includes(productData.status)
      ? productData.status
      : PRODUCT_STATUS.DRAFT;

    // Process images if provided
    let images = [];
    if (Array.isArray(productData.images) && productData.images.length > 0) {
      images = productData.images.slice(0, 5).map((img, idx) => ({
        url: typeof img === 'string' ? img : img.url,
        isCover: typeof img === 'object' && img.isCover !== undefined ? Boolean(img.isCover) : idx === 0
      }));
    }

    const newProduct = await Product.create({
      sellerId,
      seller: sellerId,
      name: productData.name.trim(),
      localName: productData.localName ? productData.localName.trim() : '',
      category: productData.category.toLowerCase().trim(),
      quantity: {
        value: Number(productData.quantity.value),
        unit: productData.quantity.unit.trim().toUpperCase()
      },
      expectedPrice: {
        min: Number(productData.expectedPrice.min),
        max: Number(productData.expectedPrice.max),
        unit: productData.expectedPrice.unit.trim().toUpperCase()
      },
      location: {
        city: productData.location.city.trim(),
        state: productData.location.state.trim(),
        pincode: productData.location.pincode.trim(),
        latitude: productData.location.latitude !== undefined ? Number(productData.location.latitude) : null,
        longitude: productData.location.longitude !== undefined ? Number(productData.location.longitude) : null
      },
      transportation: {
        available: Boolean(productData.transportation?.available),
        deliveryRadiusKm: productData.transportation?.deliveryRadiusKm ? Number(productData.transportation.deliveryRadiusKm) : null,
        terms: productData.transportation?.terms ? productData.transportation.terms.trim() : ''
      },
      description: productData.description ? productData.description.trim() : '',
      tags: Array.isArray(productData.tags) ? productData.tags.map((t) => String(t).trim()) : [],
      images,
      status: initialStatus
    });

    return newProduct.toSellerJSON();
  }

  /**
   * Get paginated products for an authenticated seller
   */
  async getSellerProducts(sellerId, { status, page = 1, limit = 10 }) {
    const filter = {
      $or: [{ sellerId }, { seller: sellerId }],
      isDeleted: { $ne: true }
    };

    if (status) {
      const normalizedStatus = String(status).toLowerCase().trim();
      if (ALL_PRODUCT_STATUSES.includes(normalizedStatus)) {
        filter.status = normalizedStatus;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Product.countDocuments(filter)
    ]);

    const pages = Math.ceil(total / limitNum) || 1;

    return {
      products: products.map((p) => p.toSellerJSON()),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages
      }
    };
  }

  /**
   * Get single product detail belonging strictly to the authenticated seller
   */
  async getSellerProductById(sellerId, productId) {
    const product = await Product.findOne({
      _id: productId,
      $or: [{ sellerId }, { seller: sellerId }],
      isDeleted: { $ne: true }
    });

    if (!product) {
      return null;
    }

    return product.toSellerJSON();
  }

  /**
   * Update an existing product belonging to the authenticated seller
   */
  async updateSellerProduct(sellerId, productId, updateData) {
    const product = await Product.findOne({
      _id: productId,
      $or: [{ sellerId }, { seller: sellerId }],
      isDeleted: { $ne: true }
    });

    if (!product) {
      return null;
    }

    // Never allow updating seller ownership or soft-delete flags directly
    delete updateData.sellerId;
    delete updateData.seller;
    delete updateData._id;
    delete updateData.id;
    delete updateData.isDeleted;
    delete updateData.deletedAt;

    if (updateData.name) product.name = updateData.name.trim();
    if (updateData.localName !== undefined) product.localName = updateData.localName.trim();
    if (updateData.category) product.category = updateData.category.toLowerCase().trim();

    if (updateData.quantity) {
      if (updateData.quantity.value !== undefined) product.quantity.value = Number(updateData.quantity.value);
      if (updateData.quantity.unit) product.quantity.unit = updateData.quantity.unit.trim().toUpperCase();
    }

    if (updateData.expectedPrice) {
      if (updateData.expectedPrice.min !== undefined) product.expectedPrice.min = Number(updateData.expectedPrice.min);
      if (updateData.expectedPrice.max !== undefined) product.expectedPrice.max = Number(updateData.expectedPrice.max);
      if (updateData.expectedPrice.unit) product.expectedPrice.unit = updateData.expectedPrice.unit.trim().toUpperCase();
    }

    if (updateData.location) {
      if (updateData.location.city) product.location.city = updateData.location.city.trim();
      if (updateData.location.state) product.location.state = updateData.location.state.trim();
      if (updateData.location.pincode) product.location.pincode = updateData.location.pincode.trim();
      if (updateData.location.latitude !== undefined) product.location.latitude = updateData.location.latitude;
      if (updateData.location.longitude !== undefined) product.location.longitude = updateData.location.longitude;
    }

    if (updateData.transportation) {
      if (updateData.transportation.available !== undefined) {
        product.transportation.available = Boolean(updateData.transportation.available);
      }
      if (updateData.transportation.deliveryRadiusKm !== undefined) {
        product.transportation.deliveryRadiusKm = Number(updateData.transportation.deliveryRadiusKm);
      }
      if (updateData.transportation.terms !== undefined) {
        product.transportation.terms = updateData.transportation.terms.trim();
      }
    }

    if (updateData.description !== undefined) {
      product.description = updateData.description.trim();
    }

    if (Array.isArray(updateData.tags)) {
      product.tags = updateData.tags.map((t) => String(t).trim());
    }

    if (Array.isArray(updateData.images)) {
      product.images = updateData.images.slice(0, 5).map((img, idx) => ({
        url: typeof img === 'string' ? img : img.url,
        isCover: typeof img === 'object' && img.isCover !== undefined ? Boolean(img.isCover) : idx === 0
      }));
    }

    await product.save();
    return product.toSellerJSON();
  }

  /**
   * Publish a draft product for verification
   */
  async publishSellerProduct(sellerId, productId) {
    const product = await Product.findOne({
      _id: productId,
      $or: [{ sellerId }, { seller: sellerId }],
      isDeleted: { $ne: true }
    });

    if (!product) {
      return { success: false, code: 'NOT_FOUND', message: 'Product not found or unauthorized' };
    }

    // Validate all mandatory publishing criteria
    const validation = validatePublishProduct(product);
    if (!validation.isValid) {
      return {
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Product is not complete for publishing',
        details: validation.errors
      };
    }

    // Update status to pending_verification (or active)
    product.status = PRODUCT_STATUS.PENDING_VERIFICATION;
    await product.save();

    return {
      success: true,
      productId: product._id.toString(),
      status: product.status
    };
  }

  /**
   * Soft-delete a product
   */
  async softDeleteSellerProduct(sellerId, productId) {
    const product = await Product.findOne({
      _id: productId,
      $or: [{ sellerId }, { seller: sellerId }],
      isDeleted: { $ne: true }
    });

    if (!product) {
      return false;
    }

    product.isDeleted = true;
    product.deletedAt = new Date();
    await product.save();

    return true;
  }
}

module.exports = new ProductService();
