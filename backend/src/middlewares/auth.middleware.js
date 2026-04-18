const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');
const { unauthorized } = require('../utils/response');
const db = require('../config/database');

/**
 * Verify JWT from Authorization header.
 * Attaches req.user = { id, email, role } on success.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'No token provided');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    // Verify user still exists
    const user = db.findById('users', decoded.id);
    if (!user) return unauthorized(res, 'User no longer exists');
    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return unauthorized(res, 'Token expired');
    return unauthorized(res, 'Invalid token');
  }
};

/**
 * Optional auth — attaches user if token present, but doesn't block if absent.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = db.findById('users', decoded.id);
    if (user) req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
  } catch {
    // ignore
  }
  return next();
};

module.exports = { authenticate, optionalAuth };
