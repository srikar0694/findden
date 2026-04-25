const AdminService = require('../services/admin.service');
const { success } = require('../utils/response');

const AdminController = {
  listProperties(req, res, next) {
    try {
      const result = AdminService.listProperties(req.query);
      return success(res, result.data, result.meta);
    } catch (err) {
      return next(err);
    }
  },

  stats(req, res, next) {
    try {
      return success(res, AdminService.stats());
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = AdminController;
