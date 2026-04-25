import api from './api';

export const propertiesService = {
  search: (params) => api.get('/properties', { params }),
  getById: (id) => api.get(`/properties/${id}`),
  getMyListings: (params) => api.get('/properties/my', { params }),
  create: (data) => api.post('/properties', data),
  quickCreate: (data) => api.post('/properties/quick', data),
  update: (id, data) => api.patch(`/properties/${id}`, data),
  remove: (id) => api.delete(`/properties/${id}`),
};
