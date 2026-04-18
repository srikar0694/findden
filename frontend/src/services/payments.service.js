import api from './api';

export const paymentsService = {
  initiatePayment: (data) => api.post('/payments/initiate', data),
  verifyPayment: (data) => api.post('/payments/verify', data),
  getHistory: (params) => api.get('/payments/history', { params }),
};
