/**
 * Global, configurable constants.
 * Pricing values can be overridden via env vars at deploy time — no code change needed.
 * (Individual plan rows in `plans.json` remain the source of truth for persisted pricing,
 *  but these defaults are used when seeding / resetting pricing admin-side.)
 */

const toInt = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};

module.exports = {
  USER_ROLES: ['buyer', 'agent', 'owner', 'admin'],
  PROPERTY_TYPES: ['apartment', 'house', 'villa', 'plot', 'commercial', 'pg'],
  PROPERTY_STATUSES: ['draft', 'active', 'paused', 'sold', 'rented', 'expired'],
  LISTING_TYPES: ['sale', 'rent'],
  FURNISHING_TYPES: ['unfurnished', 'semi', 'furnished'],
  SUBSCRIPTION_STATUSES: ['active', 'expired', 'cancelled', 'paused'],
  TRANSACTION_STATUSES: ['pending', 'success', 'failed', 'refunded'],
  // "subscription" => recurring plan (cart/premium); "one_time" => single-property unlock
  TRANSACTION_TYPES: ['subscription', 'one_time'],
  CONTACT_UNLOCK_SOURCES: ['single', 'cart', 'premium', 'admin_grant'],
  WISHLIST_LIMIT: toInt(process.env.WISHLIST_LIMIT, 100),

  DEFAULT_PAGE_LIMIT: 20,
  MAX_PAGE_LIMIT: 100,
  BCRYPT_ROUNDS: 12,

  /**
   * Pricing defaults (INR). These are overridable via env vars so the same
   * code ships to every environment and pricing can be A/B-tested.
   * The source of truth for quote/display is still `plans.json`; these defaults
   * are what the seed script (and the `/api/plans/reset-pricing` admin endpoint)
   * use to recreate the default plan rows.
   */
  PRICING: {
    single:  { price: toInt(process.env.PRICE_SINGLE,  40),  quota: 1  },
    cart:    { price: toInt(process.env.PRICE_CART,    20), quota: toInt(process.env.QUOTA_CART,    10) },
    premium: { price: toInt(process.env.PRICE_PREMIUM, 500), quota: toInt(process.env.QUOTA_PREMIUM, 30) },
    currency: process.env.CURRENCY || 'INR',
  },
};
