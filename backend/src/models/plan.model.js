const db = require('../config/database');

const TABLE = 'plans';

const PlanModel = {
  findAll: () => db.findAll(TABLE),
  findActive: () => db.findWhere(TABLE, (p) => p.is_active),
  findById: (id) => db.findById(TABLE, id),
  findBySlug: (slug) => db.findOne(TABLE, (p) => p.slug === slug),
  findByTier: (tier) => db.findOne(TABLE, (p) => p.tier === tier),
  create: (data) =>
    db.insert(TABLE, { ...data, created_at: new Date().toISOString() }),
  update: (id, partial) => db.updateById(TABLE, id, partial),
};

module.exports = PlanModel;
