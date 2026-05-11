const { v4: uuidv4 } = require('uuid');
const PlanModel = require('../models/plan.model');

const PlansService = {
  async getAll() {
    const plans = await PlanModel.findActive();
    return plans
      .slice()
      .sort((a, b) => (a.display_order || 99) - (b.display_order || 99))
      .map(formatPlan);
  },

  async getById(id) {
    const plan = await PlanModel.findById(id);
    return plan ? formatPlan(plan) : null;
  },

  async getBySlug(slug) {
    const plan = await PlanModel.findBySlug(slug);
    return plan ? formatPlan(plan) : null;
  },

  async quoteCart(cartSize) {
    const size = Math.max(1, Number(cartSize) || 1);
    const [single, cart, premium] = await Promise.all([
      PlanModel.findBySlug('single'),
      PlanModel.findBySlug('cart'),
      PlanModel.findBySlug('premium'),
    ]);

    const lines = [];

    if (single) {
      lines.push({
        planId: single.id, planSlug: single.slug, planName: single.name,
        quantity: size, unitPrice: single.price, total: size * single.price,
        perUnit: single.price, fits: true,
      });
    }
    if (cart) {
      const fits = size <= cart.unlock_quota;
      lines.push({
        planId: cart.id, planSlug: cart.slug, planName: cart.name,
        quantity: Math.min(size, cart.unlock_quota), unitPrice: cart.price,
        total: cart.price,
        perUnit: +(cart.price / Math.min(size, cart.unlock_quota)).toFixed(2),
        fits, quota: cart.unlock_quota,
      });
    }
    if (premium) {
      const fits = size <= premium.unlock_quota;
      lines.push({
        planId: premium.id, planSlug: premium.slug, planName: premium.name,
        quantity: Math.min(size, premium.unlock_quota), unitPrice: premium.price,
        total: premium.price,
        perUnit: +(premium.price / Math.min(size, premium.unlock_quota)).toFixed(2),
        fits, quota: premium.unlock_quota,
      });
    }

    const fitting = lines.filter((l) => l.fits).sort((a, b) => a.total - b.total);
    return { cartSize: size, options: lines, recommended: fitting[0] || null, currency: 'INR' };
  },

  async create(data) {
    const plan = await PlanModel.create({ id: uuidv4(), ...data });
    return formatPlan(plan);
  },

  async update(id, partial) {
    const updated = await PlanModel.update(id, partial);
    return updated ? formatPlan(updated) : null;
  },
};

function formatPlan(p) {
  return {
    id: p.id, name: p.name, slug: p.slug,
    description: p.description, tagline: p.tagline,
    price: p.price, currency: p.currency,
    unlockQuota: p.unlock_quota, durationDays: p.duration_days,
    billingCycle: p.billing_cycle, tier: p.tier,
    features: p.features || [], highlight: !!p.highlight,
    displayOrder: p.display_order, isActive: p.is_active,
    createdAt: p.created_at,
  };
}

module.exports = PlansService;
