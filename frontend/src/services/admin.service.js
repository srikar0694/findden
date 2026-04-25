import api from './api';

export const adminService = {
  listProperties: (params) => api.get('/admin/properties', { params }),
  stats: () => api.get('/admin/stats'),
  setVerified: (id, verified = true) =>
    api.post(`/properties/${id}/verify`, { verified }),
};
