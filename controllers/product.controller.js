const productService = require('../services/product.service');
const { getStorageService } = require('../services/storage.service');
const { validateAddProduct, isValidObjectId } = require('../validators/product.validator');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { ERROR_CODES } = require('../constants');

class ProductController {
  /**
   * Upload up to 5 product images
   * POST /api/seller/products/images
   */
  async uploadImages(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return errorResponse(
          res,
          400,
          'No images uploaded. Please provide at least 1 image.',
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const storage = getStorageService();
      const uploadedImages = [];

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const saved = await storage.saveFile(file);
        uploadedImages.push({
          url: saved.url,
          isCover: i === 0 // First image is the main cover image
        });
      }

      return res.status(200).json({
        success: true,
        images: uploadedImages
      });
    } catch (error) {
      console.error('Error uploading product images:', error);
      return errorResponse(res, 500, 'Failed to upload images', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * Create a new product (Add Product API)
   * POST /api/seller/add_product and POST /api/seller/products
   */
  async addProduct(req, res) {
    try {
      // 1. Validate request payload
      const validation = validateAddProduct(req.body);
      if (!validation.isValid) {
        return errorResponse(
          res,
          400,
          validation.errors[0],
          ERROR_CODES.VALIDATION_ERROR,
          validation.errors
        );
      }

      // 2. Security: Authenticated seller ID is strictly enforced from req.user
      const sellerId = req.user._id;

      // 3. Create product via service
      const product = await productService.createProduct(sellerId, req.body);

      return successResponse(res, 201, 'Product created successfully', { product });
    } catch (error) {
      console.error('Error adding product:', error);
      return errorResponse(res, 500, error.message || 'Failed to create product', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * List paginated products for seller
   * GET /api/seller/products
   */
  async getProducts(req, res) {
    try {
      const sellerId = req.user._id;
      const result = await productService.getSellerProducts(sellerId, req.query);

      return successResponse(res, 200, null, result);
    } catch (error) {
      console.error('Error getting seller products:', error);
      return errorResponse(res, 500, 'Failed to fetch products', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * Get single product detail
   * GET /api/seller/products/:productId
   */
  async getProductById(req, res) {
    try {
      const { productId } = req.params;

      if (!isValidObjectId(productId)) {
        return errorResponse(res, 400, 'Invalid product ID format', ERROR_CODES.VALIDATION_ERROR);
      }

      const sellerId = req.user._id;
      const product = await productService.getSellerProductById(sellerId, productId);

      if (!product) {
        return errorResponse(res, 404, 'Product not found', ERROR_CODES.PRODUCT_NOT_FOUND);
      }

      return successResponse(res, 200, null, { product });
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      return errorResponse(res, 500, 'Failed to fetch product details', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * Update an existing product
   * PUT /api/seller/products/:productId & PATCH /api/seller/products/:productId
   */
  async updateProduct(req, res) {
    try {
      const { productId } = req.params;

      if (!isValidObjectId(productId)) {
        return errorResponse(res, 400, 'Invalid product ID format', ERROR_CODES.VALIDATION_ERROR);
      }

      const sellerId = req.user._id;
      const updatedProduct = await productService.updateSellerProduct(sellerId, productId, req.body);

      if (!updatedProduct) {
        return errorResponse(res, 404, 'Product not found or unauthorized', ERROR_CODES.PRODUCT_NOT_FOUND);
      }

      return successResponse(res, 200, 'Product updated successfully', { product: updatedProduct });
    } catch (error) {
      console.error('Error updating product:', error);
      return errorResponse(res, 500, error.message || 'Failed to update product', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * Publish product for verification
   * POST /api/seller/products/:productId/publish
   */
  async publishProduct(req, res) {
    try {
      const { productId } = req.params;

      if (!isValidObjectId(productId)) {
        return errorResponse(res, 400, 'Invalid product ID format', ERROR_CODES.VALIDATION_ERROR);
      }

      const sellerId = req.user._id;
      const result = await productService.publishSellerProduct(sellerId, productId);

      if (!result.success) {
        if (result.code === 'NOT_FOUND') {
          return errorResponse(res, 404, result.message, ERROR_CODES.PRODUCT_NOT_FOUND);
        }
        if (result.code === 'VALIDATION_ERROR') {
          return errorResponse(res, 422, result.message, ERROR_CODES.VALIDATION_ERROR, result.details);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Product submitted for verification',
        data: {
          productId: result.productId,
          status: result.status
        }
      });
    } catch (error) {
      console.error('Error publishing product:', error);
      return errorResponse(res, 500, 'Failed to publish product', ERROR_CODES.SERVER_ERROR);
    }
  }

  /**
   * Soft-delete a product
   * DELETE /api/seller/products/:productId
   */
  async deleteProduct(req, res) {
    try {
      const { productId } = req.params;

      if (!isValidObjectId(productId)) {
        return errorResponse(res, 400, 'Invalid product ID format', ERROR_CODES.VALIDATION_ERROR);
      }

      const sellerId = req.user._id;
      const deleted = await productService.softDeleteSellerProduct(sellerId, productId);

      if (!deleted) {
        return errorResponse(res, 404, 'Product not found or unauthorized', ERROR_CODES.PRODUCT_NOT_FOUND);
      }

      return successResponse(res, 200, 'Product deleted successfully', { productId, isDeleted: true });
    } catch (error) {
      console.error('Error deleting product:', error);
      return errorResponse(res, 500, 'Failed to delete product', ERROR_CODES.SERVER_ERROR);
    }
  }
}

module.exports = new ProductController();
