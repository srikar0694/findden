const db = require('../config/database');

const TABLE = 'subscriptions';

const SubscriptionModel = {
  findById: (id) => db.findById(TABLE, id),

  findByUserId: (userId) => db.findWhere(TABLE, (s) => s.user_id === userId),

  /** Returns the most recent active subscription for a user */
  findActiveByUserId: (userId) => {
    const now = new Date().toISOString();
    const actives = db.findWhere(
      TABLE,
      (s) => s.user_id === userId && s.status === 'active' && s.expires_at > now
    );
    // Sort by expires_at desc and return the latest
    actives.sort((a, b) => new Date(b.expires_at) - new Date(a.expires_at));
    return actives[0] || null;
  },

  create: (data) =>
    db.insert(TABLE, {
      ...data,
      quota_used: 0,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),

  update: (id, partial) => db.updateById(TABLE, id, partial),

  /** Increment quota_used by 1 atomically; fails if quota would be exceeded */
  deductQuota: (subscriptionId, planQuota) => {
    const sub = db.findById(TABLE, subscriptionId);
    if (!sub) return { success: false, reason: 'Subscription not found' };
    if (sub.status !== 'active') return { success: false, reason: 'Subscription not active' };
    if (new Date(sub.expires_at) <= new Date()) return { success: false, reason: 'Subscription expired' };
    if (sub.quota_used >= planQuota) return { success: false, reason: 'Quota exceeded' };

    const updated = db.updateById(TABLE, subscriptionId, {
      quota_used: sub.quota_used + 1,
    });
    return { success: true, subscription: updated };
  },

  expireStale: () => {
    const now = new Date().toISOString();
    return db.update(
      TABLE,
      (s) => s.status === 'active' && s.expires_at <= now,
      { status: 'expired' }
    );
  },
};

module.exports = SubscriptionModel;
