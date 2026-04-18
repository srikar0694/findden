const AuthService = require('../services/auth.service');
const { success, created, error } = require('../utils/response');

const AuthController = {
  async register(req, res, next) {
    try {
      const { user, token } = await AuthService.register(req.body);
      return created(res, { user, token });
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') return error(res, err.message, 'EMAIL_TAKEN', 409);
      return next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { user, token } = await AuthService.login(req.body);
      return success(res, { user, token });
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') return error(res, err.message, 'INVALID_CREDENTIALS', 401);
      return next(err);
    }
  },

  getMe(req, res, next) {
    try {
      const user = AuthService.getMe(req.user.id);
      return success(res, user);
    } catch (err) {
      return next(err);
    }
  },

  async changePassword(req, res, next) {
    try {
      await AuthService.changePassword(req.user.id, req.body);
      return success(res, { message: 'Password changed successfully' });
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') return error(res, err.message, 'INVALID_CREDENTIALS', 401);
      return next(err);
    }
  },
};

module.exports = AuthController;
