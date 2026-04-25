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
        return error(res, err.message, 'PAYMENT_REQUIRED', 402, null, {
          redirectTo: err.redirectTo || '/pricing',
        });
      }
      if (err.code === 'NOT_FOUND') {
        return error(res, err.message, 'NOT_FOUND', 404);
      }
      if (err.code === 'BAD_REQUEST') {
        return error(res, err.message, 'BAD_REQUEST', 400);
      }
      return next(err);
    }
  },

  getQuota(req, res, next) {
    try {
      const q = MessagesService.getQuotaStatus(req.user.id);
      // Normalize the shape for the frontend (UI uses `limit` / `plan` keys).
      return success(res, {
        limit: q.total,
        used: q.used,
        remaining: q.remaining,
        windowDays: q.windowDays,
        plan: q.plan || null,
      });
    } catch (err) {
      return next(err);
    }
  },

  contactedProperties(req, res, next) {
    try {
      const items = MessagesService.contactedProperties(req.user.id);
      const data = items
        .map(({ property, lastContactedAt }) => {
          const enriched = PropertiesService.getById(property.id, req.user.id);
          return enriched ? { ...enriched, lastContactedAt } : null;
        })
        .filter(Boolean);
      return success(res, data);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = MessagesController;
