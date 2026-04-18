const DashboardService = require('../services/dashboard.service');
const { success } = require('../utils/response');

const DashboardController = {
  getSummary(req, res, next) {
    try {
      const data = DashboardService.getSummary(req.user.id);
      return success(res, data);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = DashboardController;
