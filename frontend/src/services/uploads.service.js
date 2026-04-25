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
};
