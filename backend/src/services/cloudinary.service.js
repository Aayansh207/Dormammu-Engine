const cloudinary = require("cloudinary").v2;
const env = require("../../env");

class CloudinaryService {
  /**
   * Check if Cloudinary is configured with credentials (dynamically checking process.env)
   */
  isConfigured() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY || env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET || env.CLOUDINARY_API_SECRET;

    return Boolean(cloudName && apiKey && apiSecret);
  }

  _ensureConfigured() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY || env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET || env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      const error = new Error(
        "Cloudinary keys are not configured in backend/.env. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
      );
      error.statusCode = 503;
      throw error;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  /**
   * Upload an image buffer or base64 data to Cloudinary
   * Returns secure CDN URL and public_id
   * 
   * @param {Buffer|string} fileSource - Buffer from multer or base64 string
   * @param {Object} options
   * @param {string} options.userId - User ID for public_id namespacing
   * @param {string} [options.folder] - Custom folder (defaults to env.CLOUDINARY_FOLDER)
   * @returns {Promise<{ secure_url: string, public_id: string }>}
   */
  async uploadImage(fileSource, options = {}) {
    this._ensureConfigured();

    const folder = options.folder || process.env.CLOUDINARY_FOLDER || env.CLOUDINARY_FOLDER || "dormammu/avatars";
    const userId = options.userId || "anonymous";

    // Transform options: Auto format, quality, square crop for avatars
    const uploadOptions = {
      folder,
      public_id: `avatar_${userId}_${Date.now()}`,
      overwrite: true,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "svg"],
      transformation: [
        { width: 500, height: 500, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    };

    return new Promise((resolve, reject) => {
      if (Buffer.isBuffer(fileSource)) {
        const stream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error("Cloudinary stream upload error:", error);
              return reject(new Error(error.message || "Failed to upload image to Cloudinary"));
            }
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
            });
          }
        );
        stream.end(fileSource);
      } else if (typeof fileSource === "string") {
        cloudinary.uploader.upload(fileSource, uploadOptions, (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return reject(new Error(error.message || "Failed to upload image to Cloudinary"));
          }
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        });
      } else {
        reject(new Error("Invalid file source provided to Cloudinary uploader"));
      }
    });
  }

  /**
   * Delete an existing image from Cloudinary by public ID
   */
  async deleteImage(publicId) {
    if (!this.isConfigured() || !publicId) return null;
    try {
      this._ensureConfigured();
      return await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.warn("Could not delete previous Cloudinary image:", err.message);
      return null;
    }
  }
}

module.exports = new CloudinaryService();
