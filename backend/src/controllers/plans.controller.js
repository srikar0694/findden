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
};

module.exports = PlansController;
