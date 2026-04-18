module.exports = {
  USER_ROLES: ['buyer', 'agent', 'owner', 'admin'],
  PROPERTY_TYPES: ['apartment', 'house', 'villa', 'plot', 'commercial', 'pg'],
  PROPERTY_STATUSES: ['draft', 'pending_payment', 'active', 'paused', 'sold', 'rented', 'expired'],
  LISTING_TYPES: ['sale', 'rent'],
  FURNISHING_TYPES: ['unfurnished', 'semi', 'furnished'],
  SUBSCRIPTION_STATUSES: ['active', 'expired', 'cancelled', 'paused'],
  TRANSACTION_STATUSES: ['pending', 'success', 'failed', 'refunded'],
  TRANSACTION_TYPES: ['subscription', 'pay_per_listing'],
  DEFAULT_PAGE_LIMIT: 20,
  MAX_PAGE_LIMIT: 100,
  BCRYPT_ROUNDS: 12,
};
