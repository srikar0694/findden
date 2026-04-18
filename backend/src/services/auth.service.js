const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/user.model');
const { jwt: jwtConfig } = require('../config/env');
const { BCRYPT_ROUNDS } = require('../config/constants');

const AuthService = {
  async register({ name, email, password, role, phone }) {
    const existing = UserModel.findByEmail(email);
    if (existing) throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_TAKEN' });

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = UserModel.create({
      id: uuidv4(),
      name,
      email,
      password_hash,
      role: role || 'buyer',
      phone: phone || null,
      avatar_url: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}`,
      is_verified: false,
    });

    const token = generateToken(user);
    return { user, token };
  },

  async login({ email, password }) {
    const user = UserModel.findByEmail(email);
    if (!user) throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS' });

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

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
}

module.exports = AuthService;
