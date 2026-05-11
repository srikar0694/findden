const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/user.model');
const { jwt: jwtConfig } = require('../config/env');
const { BCRYPT_ROUNDS } = require('../config/constants');

const AuthService = {
  async register({ name, email, password, role, phone }) {
    if (phone && await UserModel.findByPhone(phone)) {
      throw Object.assign(new Error('Phone number already registered'), { code: 'PHONE_TAKEN' });
    }
    if (email && await UserModel.findByEmail(email)) {
      throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_TAKEN' });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await UserModel.create({
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

  async login({ identifier, password }) {
    const user = isEmail(identifier)
      ? await UserModel.findByEmail(identifier)
      : await UserModel.findByPhone(identifier);

    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
    }
    // Google-only accounts cannot use password login.
    const withPw = await UserModel.findByIdWithPassword(user.id);
    if (!withPw.password_hash) {
      throw Object.assign(new Error('Please sign in with Google'), { code: 'USE_GOOGLE' });
    }

    const valid = await bcrypt.compare(password, withPw.password_hash);
    if (!valid) {
      throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
    }

    const safeUser = await UserModel.findById(user.id);
    const token = generateToken(safeUser);
    return { user: safeUser, token };
  },

  async googleAuth({ email, name, googleId, avatar, picture, phone, role }) {
    const avatarUrl = avatar || picture
      || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}`;

    let user = await UserModel.findByGoogleId(googleId);
    if (!user && email) user = await UserModel.findByEmail(email);

    // Phone may collide with an existing local account — only attach it if free.
    let safePhone = null;
    if (phone) {
      const owner = await UserModel.findByPhone(phone);
      if (!owner || (user && owner.id === user.id)) safePhone = phone;
    }

    if (!user) {
      user = await UserModel.create({
        id: uuidv4(),
        name,
        email: email || null,
        password_hash: null,
        role: role || 'buyer',
        phone: safePhone,
        avatar_url: avatarUrl,
        is_verified: true,
        provider: 'google',
        google_id: googleId,
      });
    } else {
      const patch = {};
      if (!user.google_id) patch.google_id = googleId;
      if (!user.is_verified) patch.is_verified = true;
      if (!user.phone && safePhone) patch.phone = safePhone;
      if (!user.avatar_url && avatarUrl) patch.avatar_url = avatarUrl;
      if (Object.keys(patch).length) user = await UserModel.update(user.id, patch);
    }

    const safeUser = await UserModel.findById(user.id);
    const token = generateToken(safeUser);
    return { user: safeUser, token };
  },

  async getMe(userId) {
    return UserModel.findById(userId);
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await UserModel.findByIdWithPassword(userId);
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
