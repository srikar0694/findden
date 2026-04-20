const NotificationsService = require('../services/notifications.service');
const { success, created, error } = require('../utils/response');

const NotificationsController = {
  async requestCallback(req, res, next) {
    try {
      const result = await NotificationsService.notifyOwner({
        senderId: req.user.id,
        propertyId: req.params.propertyId,
        type: 'request_callback',
      });
      return created(res, result);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return error(res, err.message, 'NOT_FOUND', 404);
      if (err.code === 'OWNER_MISSING') return error(res, err.message, 'OWNER_MISSING', 410);
      return next(err);
    }
  },

  async sendMessage(req, res, next) {
    try {
      const result = await NotificationsService.notifyOwner({
        senderId: req.user.id,
        propertyId: req.params.propertyId,
        type: 'send_message',
        message: req.body.message,
      });
      return created(res, result);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return error(res, err.message, 'NOT_FOUND', 404);
      if (err.code === 'OWNER_MISSING') return error(res, err.message, 'OWNER_MISSING', 410);
      return next(err);
    }
  },

  /** Owner-side feed of notifications they've received. */
  inbox(req, res, next) {
    try {
      return success(res, NotificationsService.listForOwner(req.user.id));
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = NotificationsController;
