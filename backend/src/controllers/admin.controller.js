const AdminService = require('../services/admin.service');
const { success } = require('../utils/response');

const AdminController = {
  async listProperties(req, res, next) {
    try {
      const result = await AdminService.listProperties(req.query);
      return success(res, result.data, result.meta);
    } catch (err) {
      return next(err);
    }
  },

  async stats(req, res, next) {
    try {
      return success(res, await AdminService.stats());
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = AdminController;
