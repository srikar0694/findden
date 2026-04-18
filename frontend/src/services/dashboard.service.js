import api from './api';

export const dashboardService = {
  getSummary: () => api.get('/dashboard'),
  getSubscription: () => api.get('/subscriptions/me'),
  subscribe: (data) => api.post('/subscriptions', data),
  upgrade: (id, data) => api.post(`/subscriptions/${id}/upgrade`, data),
  cancelSubscription: (id) => api.post(`/subscriptions/${id}/cancel`),
};
