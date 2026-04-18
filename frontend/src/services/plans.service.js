import api from './api';

export const plansService = {
  getAll: () => api.get('/plans'),
  getById: (id) => api.get(`/plans/${id}`),
};
