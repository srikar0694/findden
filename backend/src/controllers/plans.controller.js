const PlansService = require('../services/plans.service');
const { success, created, notFound } = require('../utils/response');

const PlansController = {
  getAll(req, res, next) {
    try {
      return success(res, PlansService.getAll());
    } catch (err) {
      return next(err);
    }
  },

  getById(req, res, next) {
    try {
      const plan = PlansService.getById(req.params.id);
      if (!plan) return notFound(res, 'Plan not found');
      return success(res, plan);
    } catch (err) {
      return next(err);
    }
  },

  create(req, res, next) {
    try {
      const plan = PlansService.create(req.body);
      return created(res, plan);
    } catch (err) {
      return next(err);
    }
  },

  update(req, res, next) {
    try {
      const plan = PlansService.update(req.params.id, req.body);
      if (!plan) return notFound(res, 'Plan not found');
      return success(res, plan);
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /plans/quote?size=N
   * Returns a comparison of all three tiers for a cart of N properties,
   * along with the `recommended` (cheapest fitting) option.
   */
  quoteCart(req, res, next) {
    try {
      const size = parseInt(req.query.size, 10) || 1;
      return success(res, PlansService.quoteCart(size));
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = PlansController;
