const SubscriptionsService = require('../services/subscriptions.service');
const { success, created, notFound, error } = require('../utils/response');

const SubscriptionsController = {
  async subscribe(req, res, next) {
    try {
      const sub = await SubscriptionsService.subscribe(req.user.id, req.body);
      return created(res, sub);
    } catch (err) {
      if (err.code === 'PLAN_NOT_FOUND') return notFound(res, err.message);
      if (err.code === 'PAYMENT_REQUIRED') return error(res, err.message, 'PAYMENT_REQUIRED', 402);
      return next(err);
    }
  },

  getMySubscription(req, res, next) {
    try {
      const sub = SubscriptionsService.getMySubscription(req.user.id);
      return success(res, sub);
    } catch (err) {
      return next(err);
    }
  },

  getHistory(req, res, next) {
    try {
      const history = SubscriptionsService.getSubscriptionHistory(req.user.id);
      return success(res, history);
    } catch (err) {
      return next(err);
    }
  },

  async upgrade(req, res, next) {
    try {
      const sub = await SubscriptionsService.upgrade(req.params.id, req.user.id, req.body);
      return success(res, sub);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return notFound(res, err.message);
      if (err.code === 'PLAN_NOT_FOUND') return notFound(res, err.message);
      if (err.code === 'PAYMENT_REQUIRED') return error(res, err.message, 'PAYMENT_REQUIRED', 402);
      return next(err);
    }
  },

  cancel(req, res, next) {
    try {
      const sub = SubscriptionsService.cancel(req.params.id, req.user.id);
      return success(res, sub);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return notFound(res, err.message);
      return next(err);
    }
  },
};

module.exports = SubscriptionsController;
