const { v4: uuidv4 } = require('uuid');
const PlanModel = require('../models/plan.model');

const PlansService = {
  /** Public read — returns all currently-active plans, sorted by display order. */
  getAll() {
    return PlanModel.findActive()
      .slice()
      .sort((a, b) => (a.display_order || 99) - (b.display_order || 99))
      .map(formatPlan);
  },

  getById(id) {
    const plan = PlanModel.findById(id);
    return plan ? formatPlan(plan) : null;
  },

  getBySlug(slug) {
    const plan = PlanModel.findBySlug(slug);
    return plan ? formatPlan(plan) : null;
  },

  /** Quote a multi-property cart against the configured tiers. */
  quoteCart(cartSize) {
    const size = Math.max(1, Number(cartSize) || 1);
    const single  = PlanModel.findBySlug('single');
    const cart    = PlanModel.findBySlug('cart');
    const premium = PlanModel.findBySlug('premium');

    const lines = [];

    // Option A: buy single unlocks one-by-one
    if (single) {
      const total = size * single.price;
      lines.push({
        planId: single.id,
        planSlug: single.slug,
        planName: single.name,
        quantity: size,
        unitPrice: single.price,
        total,
        perUnit: single.price,
        fits: true,
      });
    }

    // Option B: cart tier (flat ₹200 for up to 10)
    if (cart) {
      const fits = size <= cart.unlock_quota;
      lines.push({
        planId: cart.id,
        planSlug: cart.slug,
        planName: cart.name,
        quantity: Math.min(size, cart.unlock_quota),
        unitPrice: cart.price,
        total: cart.price,
        perUnit: +(cart.price / Math.min(size, cart.unlock_quota)).toFixed(2),
        fits,
        quota: cart.unlock_quota,
      });
    }

    // Option C: premium (₹500 for up to 30)
    if (premium) {
      const fits = size <= premium.unlock_quota;
      lines.push({
        planId: premium.id,
        planSlug: premium.slug,
        planName: premium.name,
        quantity: Math.min(size, premium.unlock_quota),
        unitPrice: premium.price,
        total: premium.price,
        perUnit: +(premium.price / Math.min(size, premium.unlock_quota)).toFixed(2),
        fits,
        quota: premium.unlock_quota,
      });
    }

    // Cheapest fitting option is the recommendation.
    const fitting = lines.filter((l) => l.fits).sort((a, b) => a.total - b.total);
    return {
      cartSize: size,
      options: lines,
      recommended: fitting[0] || null,
      currency: 'INR',
    };
  },

  create(data) {
    const plan = PlanModel.create({ id: uuidv4(), ...data });
    return formatPlan(plan);
  },

  update(id, partial) {
    const updated = PlanModel.update(id, partial);
    return updated ? formatPlan(updated) : null;
  },
};

function formatPlan(p) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    tagline: p.tagline,
    price: p.price,
    currency: p.currency,
    unlockQuota: p.unlock_quota,
    durationDays: p.duration_days,
    billingCycle: p.billing_cycle,
    tier: p.tier,
    features: p.features || [],
    highlight: !!p.highlight,
    displayOrder: p.display_order,
    isActive: p.is_active,
    createdAt: p.created_at,
  };
}

module.exports = PlansService;
