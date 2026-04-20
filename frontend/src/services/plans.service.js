import api from './api';

export const plansService = {
  getAll: () => api.get('/plans'),
  getById: (id) => api.get(`/plans/${id}`),
  /** Price a cart of N properties against all three tiers. */
  quoteCart: (size) => api.get('/plans/quote', { params: { size } }),
};
