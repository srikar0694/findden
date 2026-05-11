const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');
const { unauthorized } = require('../utils/response');
const UserModel = require('../models/user.model');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'No token provided');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = await UserModel.findById(decoded.id);
    if (!user) return unauthorized(res, 'User no longer exists');
    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return unauthorized(res, 'Token expired');
    return unauthorized(res, 'Invalid token');
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = await UserModel.findById(decoded.id);
    if (user) req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
  } catch {
    // ignore
  }
  return next();
};

module.exports = { authenticate, optionalAuth };
