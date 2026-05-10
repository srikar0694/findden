/**
 * Subscriptions service — orchestrates plan lookup, subscription create/update,
 * and the matching transaction record. All mutations that span multiple tables
 * run inside `withTransaction` so partial failure is impossible.
 *
 * One_time plans (billing_cycle = 'one_time', duration_days = NULL) result in
 * subscriptions with expires_at = NULL — the credits never lapse.
 */

const SubscriptionModel = require('../models/subscription.model');
const PlanModel = require('../models/plan.model');
const db = require('../config/database');

const SubscriptionsService = {
  async subscribe(userId, { planId, paymentRef }) {
    const plan = await PlanModel.findById(planId);
    if (!plan || !plan.is_active) {
      throw Object.assign(new Error('Plan not found or inactive'), { code: 'PLAN_NOT_FOUND', statusCode: 404 });
    }
    if (!paymentRef) {
      throw Object.assign(new Error('Payment reference required'), { code: 'PAYMENT_REQUIRED', statusCode: 402 });
    }

    return db.withTransaction(async (client) => {
      // Cancel any existing active subscription so the user only ever has one
      // active plan at a time. (Unused one_time credits are forfeited on switch
      // — adjust this rule here if product wants to merge balances.)
      await client.query(
        `UPDATE subscriptions SET status = 'cancelled'
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      const startsAt = new Date();
      const expiresAt = computeExpiry(startsAt, plan);

      const { rows: subRows } = await client.query(
        `INSERT INTO subscriptions (user_id, plan_id, starts_at, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, planId, startsAt.toISOString(), expiresAt]
      );
      const subscription = subRows[0];

      await client.query(
        `INSERT INTO transactions
           (user_id, subscription_id, amount, currency, status,
            payment_gateway, payment_ref, metadata)
         VALUES ($1, $2, $3, $4, 'success', 'razorpay', $5, $6::jsonb)`,
        [userId, subscription.id, plan.price, plan.currency,
         paymentRef, JSON.stringify({ plan_name: plan.name, plan_slug: plan.slug })]
      );

      return formatSubscription(subscription, plan);
    });
  },

  async getMySubscription(userId) {
    const sub = await SubscriptionModel.findActiveByUserId(userId);
    if (!sub) return null;
    const plan = await PlanModel.findById(sub.plan_id);
    return formatSubscription(sub, plan);
  },

  async getSubscriptionHistory(userId) {
    const subs = await SubscriptionModel.findByUserId(userId);
    if (subs.length === 0) return [];
    // Batch the plan lookups instead of N round-trips.
    const planIds = [...new Set(subs.map((s) => s.plan_id))];
    const { rows: plans } = await db.query(
      `SELECT * FROM plans WHERE id = ANY($1::text[])`, [planIds]
    );
    const planById = Object.fromEntries(plans.map((p) => [p.id, p]));
    return subs.map((s) => formatSubscription(s, planById[s.plan_id]));
  },

  async upgrade(subscriptionId, userId, { newPlanId, paymentRef }) {
    const sub = await SubscriptionModel.findById(subscriptionId);
    if (!sub || sub.user_id !== userId) {
      throw Object.assign(new Error('Subscription not found'), { code: 'NOT_FOUND', statusCode: 404 });
    }
    const newPlan = await PlanModel.findById(newPlanId);
    if (!newPlan || !newPlan.is_active) {
      throw Object.assign(new Error('New plan not found'), { code: 'PLAN_NOT_FOUND', statusCode: 404 });
    }
    if (!paymentRef) {
      throw Object.assign(new Error('Payment reference required for upgrade'), { code: 'PAYMENT_REQUIRED', statusCode: 402 });
    }

    return db.withTransaction(async (client) => {
      await client.query(
        `UPDATE subscriptions SET status = 'cancelled' WHERE id = $1`,
        [subscriptionId]
      );

      const startsAt = new Date();
      const expiresAt = computeExpiry(startsAt, newPlan);

      const { rows: subRows } = await client.query(
        `INSERT INTO subscriptions (user_id, plan_id, starts_at, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, newPlanId, startsAt.toISOString(), expiresAt]
      );
      const newSub = subRows[0];

      await client.query(
        `INSERT INTO transactions
           (user_id, subscription_id, amount, currency, status,
            payment_gateway, payment_ref, metadata)
         VALUES ($1, $2, $3, $4, 'success', 'razorpay', $5, $6::jsonb)`,
        [userId, newSub.id, newPlan.price, newPlan.currency,
         paymentRef, JSON.stringify({ plan_name: newPlan.name, plan_slug: newPlan.slug, upgrade: true })]
      );

      return formatSubscription(newSub, newPlan);
    });
  },

  async cancel(subscriptionId, userId) {
    const sub = await SubscriptionModel.findById(subscriptionId);
    if (!sub || sub.user_id !== userId) {
      throw Object.assign(new Error('Subscription not found'), { code: 'NOT_FOUND', statusCode: 404 });
    }
    const updated = await SubscriptionModel.update(subscriptionId, { status: 'cancelled' });
    const plan = await PlanModel.findById(sub.plan_id);
    return formatSubscription(updated, plan);
  },
};

/**
 * Recurring plans expire after `duration_days`. one_time plans never expire
 * (return null → stored as NULL in expires_at).
 */
function computeExpiry(startsAt, plan) {
  if (plan.billing_cycle === 'one_time' || plan.duration_days == null) return null;
  const exp = new Date(startsAt);
  exp.setDate(exp.getDate() + plan.duration_days);
  return exp.toISOString();
}

function formatSubscription(sub, plan) {
  if (!sub) return null;
  const unlockQuota = plan ? plan.unlock_quota : 0;
  const quotaRemaining = Math.max(0, unlockQuota - sub.quota_used);
  return {
    id: sub.id,
    userId: sub.user_id,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          tier: plan.tier,
          billingCycle: plan.billing_cycle,
          unlockQuota: plan.unlock_quota,
          price: Number(plan.price),
          currency: plan.currency,
          durationDays: plan.duration_days,
          features: plan.features,
        }
      : null,
    quotaUsed: sub.quota_used,
    quotaRemaining,
    startsAt: sub.starts_at,
    expiresAt: sub.expires_at,            // null for one_time plans
    neverExpires: sub.expires_at == null, // explicit flag for the UI
    status: sub.status,
    createdAt: sub.created_at,
  };
}

module.exports = SubscriptionsService;
