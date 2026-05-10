const MessagesService = require('../services/messages.service');
const PropertiesService = require('../services/properties.service');
const { success, created, error } = require('../utils/response');

const MessagesController = {
  async send(req, res, next) {
    try {
      const { id } = req.params;
      const { body } = req.body;
      const result = await MessagesService.send(req.user.id, id, body, {
        name: req.user.name,
        phone: req.user.phone,
        email: req.user.email,
      });
      return created(res, result);
    } catch (err) {
      if (err.code === 'PAYMENT_REQUIRED') {
        return error(res, err.message, 'PAYMENT_REQUIRED', 402, null, { redirectTo: err.redirectTo || '/pricing' });
      }
      if (err.code === 'NOT_FOUND') return error(res, err.message, 'NOT_FOUND', 404);
      if (err.code === 'BAD_REQUEST') return error(res, err.message, 'BAD_REQUEST', 400);
      return next(err);
    }
  },

  async getQuota(req, res, next) {
    try {
      const q = await MessagesService.getQuotaStatus(req.user.id);
      return success(res, {
        limit: q.total, used: q.used, remaining: q.remaining,
        windowDays: q.windowDays, plan: q.plan || null,
      });
    } catch (err) {
      return next(err);
    }
  },

  async contactedProperties(req, res, next) {
    try {
      const items = await MessagesService.contactedProperties(req.user.id);
      const data = await Promise.all(
        items.map(async ({ property, lastContactedAt }) => {
          const enriched = await PropertiesService.getById(property.id, req.user.id);
          return enriched ? { ...enriched, lastContactedAt } : null;
        })
      );
      return success(res, data.filter(Boolean));
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = MessagesController;
