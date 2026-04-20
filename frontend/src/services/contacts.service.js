import api from './api';

export const contactsService = {
  /** Snapshot of the caller's active subscription + remaining quota */
  getEntitlement: () => api.get('/contacts/entitlement'),

  /** List all property contacts I've unlocked */
  listMyUnlocks: () => api.get('/contacts/mine'),

  /** Preview — does not consume quota */
  preview: (propertyId) => api.get(`/contacts/preview/${propertyId}`),

  /**
   * Unlock one property's contact — consumes 1 subscription slot if available.
   * 402 => need to purchase a plan first.
   */
  unlock: (propertyId) => api.post(`/contacts/unlock/${propertyId}`),

  /** Batch unlock from wishlist/cart. */
  unlockMany: (propertyIds) => api.post('/contacts/unlock-many', { propertyIds }),
};
