const { v4: uuidv4 } = require('uuid');
const SubscriptionModel = require('../models/subscription.model');
const PlanModel = require('../models/plan.model');
const TransactionModel = require('../models/transaction.model');

const SubscriptionsService = {
  async subscribe(userId, { planId, paymentRef }) {
    const plan = PlanModel.findById(planId);
    if (!plan || !plan.is_active) {
      throw Object.assign(new Error('Plan not found or inactive'), { code: 'PLAN_NOT_FOUND', statusCode: 404 });
    }

    // Verify payment (simulated)
    if (!paymentRef) {
      throw Object.assign(new Error('Payment reference required'), { code: 'PAYMENT_REQUIRED', statusCode: 402 });
    }

    // Cancel any existing active subscription
    const existing = SubscriptionModel.findActiveByUserId(userId);
    if (existing) {
      SubscriptionModel.update(existing.id, { status: 'cancelled' });
    }

    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.duration_days);

    const subscription = SubscriptionModel.create({
      id: uuidv4(),
      user_id: userId,
      plan_id: planId,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    // Record transaction
    TransactionModel.create({
      id: uuidv4(),
      user_id: userId,
      subscription_id: subscription.id,
      property_id: null,
      amount: plan.price,
      currency: plan.currency,
      type: 'subscription',
      status: 'success',
      payment_gateway: 'razorpay',
      payment_ref: paymentRef,
      metadata: { plan_name: plan.name },
    });

    return formatSubscription(subscription, plan);
  },

  getMySubscription(userId) {
    const sub = SubscriptionModel.findActiveByUserId(userId);
    if (!sub) return null;
    const plan = PlanModel.findById(sub.plan_id);
    return formatSubscription(sub, plan);
  },

  getSubscriptionHistory(userId) {
    const subs = SubscriptionModel.findByUserId(userId);
    return subs
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((s) => formatSubscription(s, PlanModel.findById(s.plan_id)));
  },

  async upgrade(subscriptionId, userId, { newPlanId, paymentRef }) {
    const sub = SubscriptionModel.findById(subscriptionId);
    if (!sub || sub.user_id !== userId) {
      throw Object.assign(new Error('Subscription not found'), { code: 'NOT_FOUND', statusCode: 404 });
    }

    const newPlan = PlanModel.findById(newPlanId);
    if (!newPlan || !newPlan.is_active) {
      throw Object.assign(new Error('New plan not found'), { code: 'PLAN_NOT_FOUND', statusCode: 404 });
    }

    if (!paymentRef) {
      throw Object.assign(new Error('Payment reference required for upgrade'), { code: 'PAYMENT_REQUIRED', statusCode: 402 });
    }

    // Cancel old subscription
    SubscriptionModel.update(subscriptionId, { status: 'cancelled' });

    // Create new subscription
    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + newPlan.duration_days);

    const newSub = SubscriptionModel.create({
      id: uuidv4(),
      user_id: userId,
      plan_id: newPlanId,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    TransactionModel.create({
      id: uuidv4(),
      user_id: userId,
      subscription_id: newSub.id,
      property_id: null,
      amount: newPlan.price,
      currency: newPlan.currency,
      type: 'subscription',
      status: 'success',
      payment_gateway: 'razorpay',
      payment_ref: paymentRef,
      metadata: { plan_name: newPlan.name, upgrade: true },
    });

    return formatSubscription(newSub, newPlan);
  },

  cancel(subscriptionId, userId) {
    const sub = SubscriptionModel.findById(subscriptionId);
    if (!sub || sub.user_id !== userId) {
      throw Object.assign(new Error('Subscription not found'), { code: 'NOT_FOUND', statusCode: 404 });
    }
    const updated = SubscriptionModel.update(subscriptionId, { status: 'cancelled' });
    const plan = PlanModel.findById(sub.plan_id);
    return formatSubscription(updated, plan);
  },
};

function formatSubscription(sub, plan) {
  if (!sub) return null;
  const quotaRemaining = plan ? Math.max(0, plan.quota - sub.quota_used) : 0;
  return {
    id: sub.id,
    userId: sub.user_id,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          quota: plan.quota,
          price: plan.price,
          currency: plan.currency,
          durationDays: plan.duration_days,
        }
      : null,
    quotaUsed: sub.quota_used,
    quotaRemaining,
    startsAt: sub.starts_at,
    expiresAt: sub.expires_at,
    status: sub.status,
    createdAt: sub.created_at,
  };
}

module.exports = SubscriptionsService;
