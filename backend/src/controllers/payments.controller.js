const PaymentsService = require('../services/payments.service');
const RazorpayGateway = require('../services/razorpay.gateway');
const { success, error } = require('../utils/response');

const PaymentsController = {
  async initiatePayment(req, res, next) {
    try {
      const order = await PaymentsService.initiatePayment(req.user.id, req.body);
      return success(res, order);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return error(res, err.message, 'NOT_FOUND', 404);
      if (err.code === 'VALIDATION_ERROR') return error(res, err.message, 'VALIDATION_ERROR', 422);
      return next(err);
    }
  },

  async verifyPayment(req, res, next) {
    try {
      const result = await PaymentsService.verifyPayment(req.user.id, req.body);
      return success(res, result);
    } catch (err) {
      if (err.code === 'PAYMENT_FAILED') return error(res, err.message, 'PAYMENT_FAILED', 402);
      if (err.code === 'NOT_FOUND')      return error(res, err.message, 'NOT_FOUND', 404);
      return next(err);
    }
  },

  /** Sandbox-only HMAC signer — see payments.routes.js comment. */
  sandboxSign(req, res, next) {
    try {
      if (RazorpayGateway.isLive()) {
        return error(res, 'Sandbox sign disabled in live mode', 'FORBIDDEN', 403);
      }
      const signature = RazorpayGateway.sandboxSign(req.body);
      return success(res, { signature });
    } catch (err) {
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
