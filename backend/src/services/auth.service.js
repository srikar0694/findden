const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/user.model');
const { jwt: jwtConfig } = require('../config/env');
const { BCRYPT_ROUNDS } = require('../config/constants');

const AuthService = {
  async register({ name, email, password, role, phone }) {
    // Phone is mandatory; email is optional. Make sure neither is already taken.
    if (phone && UserModel.findByPhone(phone)) {
      throw Object.assign(new Error('Phone number already registered'), { code: 'PHONE_TAKEN' });
    }
    if (email && UserModel.findByEmail(email)) {
      throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_TAKEN' });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = UserModel.create({
      id: uuidv4(),
      name,
      email: email || null,
      password_hash,
      role: role || 'buyer',
      phone,
      avatar_url: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}`,
      is_verified: false,
      provider: 'local',
    });

    const token = generateToken(user);
    return { user, token };
  },

  /**
   * Login accepts a single `identifier` that can be an email OR a phone number.
   * Resolves to a user in either table and verifies password.
   */
  async login({ identifier, password }) {
    const user = isEmail(identifier)
      ? UserModel.findByEmail(identifier)
      : UserModel.findByPhone(identifier);

    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
    }
    // Google-only accounts cannot use password login.
    if (!user.password_hash) {
      throw Object.assign(new Error('Please sign in with Google'), { code: 'USE_GOOGLE' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
    }

    const safeUser = UserModel.findById(user.id);
    const token = generateToken(safeUser);
    return { user: safeUser, token };
  },

  /**
   * Google OAuth flow — if an account exists for this email/googleId, reuse it;
   * otherwise provision a new account with provider="google" (no password).
   */
  async googleAuth({ email, name, googleId, avatar, role }) {
    let user = UserModel.findByGoogleId(googleId) || (email && UserModel.findByEmail(email));

    if (!user) {
      user = UserModel.create({
        id: uuidv4(),
        name,
        email: email || null,
        password_hash: null,
        role: role || 'buyer',
        phone: null,
        avatar_url: avatar || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}`,
        is_verified: true,
        provider: 'google',
        google_id: googleId,
      });
    } else if (!user.google_id) {
      // Link Google identity to existing local account.
      user = UserModel.update(user.id, { google_id: googleId, is_verified: true });
    }

    const safeUser = UserModel.findById(user.id);
    const token = generateToken(safeUser);
    return { user: safeUser, token };
  },

  getMe(userId) {
    return UserModel.findById(userId);
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = UserModel.findByIdWithPassword(userId);
    if (!user) throw new Error('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw Object.assign(new Error('Current password is incorrect'), { code: 'INVALID_CREDENTIALS' });

    const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    return UserModel.update(userId, { password_hash });
  },
};

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
}

module.exports = AuthService;
