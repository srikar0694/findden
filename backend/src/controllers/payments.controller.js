const PaymentsService = require('../services/payments.service');
const { success, error } = require('../utils/response');

const PaymentsController = {
  initiatePayment(req, res, next) {
    try {
      const order = PaymentsService.initiatePayment(req.user.id, req.body);
      return success(res, order);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return error(res, err.message, 'NOT_FOUND', 404);
      if (err.code === 'VALIDATION_ERROR') return error(res, err.message, 'VALIDATION_ERROR', 422);
      return next(err);
    }
  },

  verifyPayment(req, res, next) {
    try {
      const result = PaymentsService.verifyPayment(req.user.id, req.body);
      return success(res, result);
    } catch (err) {
      if (err.code === 'PAYMENT_FAILED') return error(res, err.message, 'PAYMENT_FAILED', 402);
      return next(err);
    }
  },

  getHistory(req, res, next) {
    try {
      const result = PaymentsService.getHistory(req.user.id, req.query);
      return success(res, result.data, result.meta);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = PaymentsController;
