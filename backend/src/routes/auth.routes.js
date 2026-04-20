const express = require('express');
const Joi = require('joi');
const AuthController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { authLimiter } = require('../middlewares/rateLimiter');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

// Phone is MANDATORY, email is OPTIONAL (see updated requirements).
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required(),
  email: Joi.string().email().allow('', null).optional(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid(...USER_ROLES.filter((r) => r !== 'admin')).default('buyer'),
});

// Login accepts a single `identifier` (email or phone) + password.
const loginSchema = Joi.object({
  identifier: Joi.string().required(),
  password: Joi.string().required(),
});

// Google OAuth login — frontend sends the Google ID token (or simulated profile).
const googleAuthSchema = Joi.object({
  idToken: Joi.string().allow('', null).optional(),
  email: Joi.string().email().required(),
  name: Joi.string().min(1).required(),
  googleId: Joi.string().required(),
  avatar: Joi.string().uri().allow('', null).optional(),
  role: Joi.string().valid(...USER_ROLES.filter((r) => r !== 'admin')).default('buyer'),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.post('/google', authLimiter, validate(googleAuthSchema), AuthController.googleAuth);
router.get('/me', authenticate, AuthController.getMe);
router.post('/change-password', authenticate, validate(changePasswordSchema), AuthController.changePassword);

module.exports = router;
