const DashboardService = require('../services/dashboard.service');
const { success } = require('../utils/response');

const DashboardController = {
  async getSummary(req, res, next) {
    try {
      const data = await DashboardService.getSummary(req.user.id);
      return success(res, data);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = DashboardController;
