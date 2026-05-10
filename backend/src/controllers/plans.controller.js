const PlansService = require('../services/plans.service');
const { success, created, notFound } = require('../utils/response');

const PlansController = {
  async getAll(req, res, next) {
    try {
      return success(res, await PlansService.getAll());
    } catch (err) {
      return next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const plan = await PlansService.getById(req.params.id);
      if (!plan) return notFound(res, 'Plan not found');
      return success(res, plan);
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const plan = await PlansService.create(req.body);
      return created(res, plan);
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const plan = await PlansService.update(req.params.id, req.body);
      if (!plan) return notFound(res, 'Plan not found');
      return success(res, plan);
    } catch (err) {
      return next(err);
    }
  },

  async quoteCart(req, res, next) {
    try {
      const size = parseInt(req.query.size, 10) || 1;
      return success(res, await PlansService.quoteCart(size));
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = PlansController;
