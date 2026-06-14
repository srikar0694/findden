/**
 * Uploads Controller
 * ---------------------------------------------------------------
 * Accepts base64-encoded property images/videos via JSON, decodes
 * them, and streams the buffers to Cloudflare R2.  Returns the
 * public R2 URLs so the frontend can store and display them.
 */

const { v4: uuidv4 } = require('uuid');
const { success, error } = require('../utils/response');
const r2 = require('../services/r2.service');

const ALLOWED_IMAGE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_IMAGE_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_FILES = 10;

const ALLOWED_VIDEO = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};
const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300 MB

/**
 * Parse a base64 data URL.
 * Returns { mime, ext, buffer } or null on failure.
 */
function parseDataUrl(dataUrl, allowedMap) {
  const match = dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = allowedMap[mime];
  if (!ext) return null;
  const buffer = Buffer.from(match[2], 'base64');
  return { mime, ext, buffer };
}

const UploadsController = {
  /**
   * POST /api/uploads/property-images
   * Body: { images: [{ dataUrl: 'data:image/png;base64,...' }, ...] }
   * Returns: { urls: ['https://...r2.dev/properties/<userId>/<uuid>.png', ...] }
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

      const urls = [];
      for (const img of images) {
        if (!img || typeof img.dataUrl !== 'string') {
          return error(res, 'Each image needs a dataUrl', 'BAD_REQUEST', 400);
        }

        const parsed = parseDataUrl(img.dataUrl, ALLOWED_IMAGE);
        if (!parsed) {
          return error(res, 'Image must be a valid base64 data URL (jpeg/png/webp)', 'BAD_REQUEST', 400);
        }

        if (parsed.buffer.length > MAX_IMAGE_BYTES) {
          return error(res, `Image exceeds ${MAX_IMAGE_BYTES / 1024 / 1024} MB`, 'BAD_REQUEST', 400);
        }

        const key = `properties/${userId}/${uuidv4()}.${parsed.ext}`;
        const publicUrl = await r2.uploadBuffer(parsed.buffer, key, parsed.mime);
        urls.push(publicUrl);
      }

      return success(res, { urls });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/uploads/property-video
   * Body: { video: { dataUrl: 'data:video/mp4;base64,...' } }
   * Returns: { url: 'https://...r2.dev/properties/<userId>/<uuid>.mp4' }
   */
  async uploadPropertyVideo(req, res, next) {
    try {
      const userId = req.user.id;
      const { video } = req.body;

      if (!video || typeof video.dataUrl !== 'string') {
        return error(res, 'No video provided', 'BAD_REQUEST', 400);
      }

      const parsed = parseDataUrl(video.dataUrl, ALLOWED_VIDEO);
      if (!parsed) {
        return error(res, 'Video must be a valid base64 data URL (mp4/mov/webm)', 'BAD_REQUEST', 400);
      }

      if (parsed.buffer.length > MAX_VIDEO_BYTES) {
        return error(res, `Video exceeds ${MAX_VIDEO_BYTES / 1024 / 1024} MB`, 'BAD_REQUEST', 400);
      }

      const key = `properties/${userId}/${uuidv4()}.${parsed.ext}`;
      const publicUrl = await r2.uploadBuffer(parsed.buffer, key, parsed.mime);

      return success(res, { url: publicUrl });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = UploadsController;
