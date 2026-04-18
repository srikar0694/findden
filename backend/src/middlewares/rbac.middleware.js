const { forbidden } = require('../utils/response');

/**
 * Role-based access control middleware factory.
 * Usage: requireRole('admin', 'agent')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return forbidden(res, 'Authentication required');
  if (!roles.includes(req.user.role)) {
    return forbidden(res, `Access denied. Required roles: ${roles.join(', ')}`);
  }
  return next();
};

module.exports = { requireRole };
