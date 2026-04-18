const db = require('../config/database');

const TABLE = 'transactions';

const TransactionModel = {
  findById: (id) => db.findById(TABLE, id),

  findByUserId: (userId, limit = 10, offset = 0) => {
    const all = db
      .findWhere(TABLE, (t) => t.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows: all.slice(offset, offset + limit), total: all.length };
  },

  findByPaymentRef: (ref) => db.findOne(TABLE, (t) => t.payment_ref === ref),

  create: (data) =>
    db.insert(TABLE, {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),

  update: (id, partial) => db.updateById(TABLE, id, partial),

  sumByUserId: (userId) =>
    db
      .findWhere(TABLE, (t) => t.user_id === userId && t.status === 'success')
      .reduce((sum, t) => sum + t.amount, 0),
};

module.exports = TransactionModel;
