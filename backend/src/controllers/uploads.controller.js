/**
 * Uploads Controller
 * ---------------------------------------------------------------
 * Accepts base64-encoded property images via JSON (no multipart
 * dependency needed). Decodes, writes to disk under
 * `db/uploads/properties/<userId>/<uuid>.<ext>`, and returns the
 * publicly-servable URL paths.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { success, error } = require('../utils/response');

const ROOT = path.join(__dirname, '..', '..', 'db', 'uploads', 'properties');
const ALLOWED = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 10;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const UploadsController = {
  /**
   * POST /api/uploads/property-images
   * Body: { images: [{ dataUrl: 'data:image/png;base64,...' }, ...] }
   * Returns: { urls: ['/uploads/properties/<userId>/<uuid>.png', ...] }
   */
  async uploadPropertyImages(req, res, next) {
    try {
      const userId = req.user.id;
      const { images } = req.body;

      if (!Array.isArray(images) || images.length === 0) {
        return error(res, 'No images provided', 'BAD_REQUEST', 400);
      }
      if (images.length > MAX_FILES) {
        return error(res, `Up to ${MAX_FILES} images per upload`, 'BAD_REQUEST', 400);
      }

      const userDir = path.join(ROOT, userId);
      ensureDir(userDir);

      const urls = [];
      for (const img of images) {
        if (!img || typeof img.dataUrl !== 'string') {
          return error(res, 'Each image needs a dataUrl', 'BAD_REQUEST', 400);
        }
        const match = img.dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
        if (!match) {
          return error(res, 'Image must be a base64 data URL', 'BAD_REQUEST', 400);
        }
        const mime = match[1].toLowerCase();
        const ext = ALLOWED[mime];
        if (!ext) {
          return error(res, `Unsupported image type: ${mime}`, 'BAD_REQUEST', 400);
        }
        const buffer = Buffer.from(match[2], 'base64');
        if (buffer.length > MAX_BYTES) {
          return error(res, `Image exceeds ${MAX_BYTES / 1024 / 1024} MB`, 'BAD_REQUEST', 400);
        }
        const fileName = `${uuidv4()}.${ext}`;
        const filePath = path.join(userDir, fileName);
        fs.writeFileSync(filePath, buffer);
        urls.push(`/uploads/properties/${userId}/${fileName}`);
      }

      return success(res, { urls });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = UploadsController;
