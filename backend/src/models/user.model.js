const db = require('../config/database');

const TABLE = 'users';

const UserModel = {
  findAll: () => db.findAll(TABLE).map(omitPassword),

  findById: (id) => {
    const u = db.findById(TABLE, id);
    return u ? omitPassword(u) : null;
  },

  findByIdWithPassword: (id) => db.findById(TABLE, id),

  findByEmail: (email) => db.findOne(TABLE, (u) => u.email === email.toLowerCase()),

  create: (data) => {
    const row = db.insert(TABLE, {
      ...data,
      email: data.email.toLowerCase(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return omitPassword(row);
  },

  update: (id, partial) => {
    const updated = db.updateById(TABLE, id, partial);
    return updated ? omitPassword(updated) : null;
  },

  delete: (id) => db.deleteById(TABLE, id),
};

function omitPassword(user) {
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = UserModel;
