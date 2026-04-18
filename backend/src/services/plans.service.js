const { v4: uuidv4 } = require('uuid');
const PlanModel = require('../models/plan.model');

const PlansService = {
  getAll() {
    return PlanModel.findActive().map(formatPlan);
  },

  getById(id) {
    const plan = PlanModel.findById(id);
    return plan ? formatPlan(plan) : null;
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
    description: p.description,
    price: p.price,
    currency: p.currency,
    quota: p.quota,
    durationDays: p.duration_days,
    isActive: p.is_active,
    createdAt: p.created_at,
  };
}

module.exports = PlansService;
