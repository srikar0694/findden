import api from './api';

/**
 * Convert a File to a base64 data URL.
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const uploadsService = {
  /** Upload up to 10 image File objects; returns { urls: [...] }. */
  uploadPropertyImages: async (files) => {
    const list = Array.from(files);
    const images = [];
    for (const f of list) {
      const dataUrl = await fileToDataUrl(f);
      images.push({ dataUrl });
    }
    return api.post('/uploads/property-images', { images });
  },

  /** Upload a single video File; returns { url }. */
  uploadPropertyVideo: async (file) => {
    const dataUrl = await fileToDataUrl(file);
    return api.post('/uploads/property-video', { video: { dataUrl } });
  },

  /**
   * Delete uploaded R2 objects by their public URLs.
   * Called when the user removes a file from the form or cancels the post.
   * Fire-and-forget — callers should not await this.
   * @param {string[]} urls
   */
  deleteUploads: (urls) => {
    if (!Array.isArray(urls) || urls.length === 0) return Promise.resolve();
    // Only send R2 / https URLs — skip local blob: or /uploads/ legacy paths.
    const r2Urls = urls.filter((u) => u && /^https?:\/\//.test(u));
    if (r2Urls.length === 0) return Promise.resolve();
    return api.delete('/uploads/cleanup', { data: { urls: r2Urls } });
  },
};
