import api from './api';

export const paymentsService = {
  /**
   * POST /api/payments/initiate
   * body: { planId? | planSlug?, propertyIds?: [] }
   * → { orderId, amount (paise), currency, key, planSlug, sandbox }
   */
  initiatePayment: (data) => api.post('/payments/initiate', data),

  /**
   * POST /api/payments/verify
   * body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, propertyIds? }
   */
  verifyPayment: (data) => api.post('/payments/verify', data),

  /** Sandbox-only: returns { signature } for a fake payment event. */
  sandboxSign: (data) => api.post('/payments/sandbox-sign', data),

  getHistory: (params) => api.get('/payments/history', { params }),
};
