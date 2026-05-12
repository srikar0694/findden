const WishlistService = require('../services/wishlist.service');
const { success, created, error } = require('../utils/response');

const WishlistController = {
  async list(req, res, next) {
    try {
      return success(res, await WishlistService.list(req.user.id));
    } catch (err) {
      return next(err);
    }
  },

  async add(req, res, next) {
    try {
      const { propertyId, notes } = req.body;
      const row = await WishlistService.add(req.user.id, propertyId, notes);
      return created(res, row);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return error(res, err.message, 'NOT_FOUND', 404);
      if (err.code === 'LIMIT_REACHED') return error(res, err.message, 'LIMIT_REACHED', 409);
      return next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await WishlistService.remove(req.user.id, req.params.propertyId);
      return success(res, { removed: deleted });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = WishlistController;
