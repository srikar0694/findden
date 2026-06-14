/**
 * Uploads Controller
 * ---------------------------------------------------------------
 * Accepts base64-encoded property images/videos via JSON, decodes
 * them, and streams the buffers to Cloudflare R2.  Returns the
 * public R2 URLs so the frontend can store and display them.
 *
 * Also exposes a cleanup endpoint so the frontend can delete R2
 * objects when the user cancels a post or removes an uploaded file.
 */

const { v4: uuidv4 } = require('uuid');
const { success, error } = require('../utils/response');
const r2 = require('../services/r2.service');

const ALLOWED_IMAGE = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_FILES = 10;

const ALLOWED_VIDEO = {
  'video/mp4':       'mp4',
  'video/quicktime': 'mov',
  'video/webm':      'webm',
};
const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300 MB
const MAX_CLEANUP_URLS = 20; // safety cap on bulk deletes

/**
 * Parse a base64 data URL.
 * Returns { mime, ext, buffer } or null on failure.
 */
function parseDataUrl(dataUrl, allowedMap) {
  const match = dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext  = allowedMap[mime];
  if (!ext) return null;
  const buffer = Buffer.from(match[2], 'base64');
  return { mime, ext, buffer };
}

const UploadsController = {
  /**
   * POST /api/uploads/property-images
   * Body:    { images: [{ dataUrl: 'data:image/png;base64,...' }, ...] }
   * Returns: { urls: ['https://pub-xxx.r2.dev/properties/<userId>/<uuid>.png', ...] }
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
          return error(
            res,
            `Each image must be under ${MAX_IMAGE_BYTES / 1024 / 1024} MB`,
            'BAD_REQUEST',
            400
          );
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
   * Body:    { video: { dataUrl: 'data:video/mp4;base64,...' } }
   * Returns: { url: 'https://pub-xxx.r2.dev/properties/<userId>/<uuid>.mp4' }
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
        return error(
          res,
          `Video must be under ${MAX_VIDEO_BYTES / 1024 / 1024} MB`,
          'BAD_REQUEST',
          400
        );
      }

      const key = `properties/${userId}/${uuidv4()}.${parsed.ext}`;
      const publicUrl = await r2.uploadBuffer(parsed.buffer, key, parsed.mime);

      return success(res, { url: publicUrl });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * DELETE /api/uploads/cleanup
   * Body:    { urls: ['https://pub-xxx.r2.dev/properties/...', ...] }
   * Deletes the given R2 objects. Called when:
   *   - User removes an image/video from the form
   *   - User cancels / navigates away without submitting
   * Errors are swallowed — a failed delete is non-fatal.
   */
  async cleanupUploads(req, res, next) {
    try {
      const { urls } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        return error(res, 'urls must be a non-empty array', 'BAD_REQUEST', 400);
      }
      if (urls.length > MAX_CLEANUP_URLS) {
        return error(res, `Cannot delete more than ${MAX_CLEANUP_URLS} files at once`, 'BAD_REQUEST', 400);
      }

      // Fire-and-forget — don't block the response on R2 latency.
      r2.deleteByUrls(urls).catch(() => {});

      return success(res, { deleted: urls.length });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = UploadsController;
