const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Abstract Base Storage Service Interface
 */
class StorageService {
  /**
   * Save uploaded file buffer or stream
   * @param {Object} file Multer file object
   * @param {Object} options Additional options (e.g. subfolder)
   * @returns {Promise<{ url: string, filename: string, size: number, mimetype: string }>}
   */
  async saveFile(file, options = {}) {
    throw new Error('saveFile method must be implemented by storage provider');
  }

  /**
   * Delete file by URL or path
   * @param {string} fileUrl
   * @returns {Promise<boolean>}
   */
  async deleteFile(fileUrl) {
    throw new Error('deleteFile method must be implemented by storage provider');
  }
}

/**
 * Local Storage Implementation (for Development & Self-Hosted deployments)
 */
class LocalStorageService extends StorageService {
  constructor(baseUploadDir = 'uploads/products') {
    super();
    this.uploadDir = path.resolve(__dirname, '..', baseUploadDir);
    this.ensureUploadDir();
  }

  ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFile(file, options = {}) {
    this.ensureUploadDir();

    // Generate safe, unique filename
    const fileExt = path.extname(file.originalname).toLowerCase() || '.jpg';
    const randomHex = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const filename = `crop_${timestamp}_${randomHex}${fileExt}`;
    const destinationPath = path.join(this.uploadDir, filename);

    // If file is in buffer (MemoryStorage) or already on disk
    if (file.buffer) {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } else if (file.path) {
      await fs.promises.copyFile(file.path, destinationPath);
    } else {
      throw new Error('Invalid file object provided to storage service');
    }

    // Public URL served by express static
    const publicUrl = `/uploads/products/${filename}`;

    return {
      url: publicUrl,
      filename,
      size: file.size,
      mimetype: file.mimetype
    };
  }

  async deleteFile(fileUrl) {
    try {
      const filename = path.basename(fileUrl);
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting local file:', err);
      return false;
    }
  }
}

/**
 * Storage Service Factory
 * Can easily be extended for S3StorageService, CloudinaryStorageService, etc.
 */
let instance = null;

function getStorageService() {
  if (!instance) {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    switch (provider.toLowerCase()) {
      case 'local':
      default:
        instance = new LocalStorageService();
        break;
      // Future providers (AWS S3, Cloudinary) plug in seamlessly here
    }
  }
  return instance;
}

module.exports = {
  StorageService,
  LocalStorageService,
  getStorageService
};
