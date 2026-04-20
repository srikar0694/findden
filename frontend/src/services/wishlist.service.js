import api from './api';

export const wishlistService = {
  list: () => api.get('/wishlist'),
  add: (propertyId, notes = null) => api.post('/wishlist', { propertyId, notes }),
  remove: (propertyId) => api.delete(`/wishlist/${propertyId}`),
};
