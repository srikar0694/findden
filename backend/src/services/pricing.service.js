const SubscriptionModel = require('../models/subscription.model');
const PlanModel = require('../models/plan.model');
const ContactUnlockModel = require('../models/contactUnlock.model');
const { v4: uuidv4 } = require('uuid');

const PricingService = {
  /**
   * Aggregated entitlement across every active subscription the user holds.
   * Buying a second plan stacks on top of the first — the headline balance
   * is the sum of remaining quotas. The `subscriptions` array surfaces each
   * underlying plan so the UI can show "Starter (1 left) + Cart (12 left)".
   */
  async getEntitlement(userId) {
    const subs = await SubscriptionModel.findAllActiveByUserId(userId);
    if (subs.length === 0) return { hasSubscription: false, subscriptions: [] };

    const planIds = [...new Set(subs.map((s) => s.plan_id))];
    const plans = await Promise.all(planIds.map((id) => PlanModel.findById(id)));
    const planById = Object.fromEntries(plans.filter(Boolean).map((p) => [p.id, p]));

    let unlocksTotal = 0;
    let unlocksUsed = 0;
    const items = subs.map((s) => {
      const plan = planById[s.plan_id];
      const quota = plan?.unlock_quota || 0;
      const used  = s.quota_used || 0;
      unlocksTotal += quota;
      unlocksUsed  += used;
      return {
        subscription: s,
        plan,
        unlocksRemaining: Math.max(0, quota - used),
        unlocksTotal: quota,
        unlocksUsed: used,
        expiresAt: s.expires_at,
      };
    });

    const unlocksRemaining = Math.max(0, unlocksTotal - unlocksUsed);
    // Primary = earliest-expiring sub with quota left — that's the one we'll
    // burn through first. Falls back to the first item if nothing has quota.
    const primary = items.find((i) => i.unlocksRemaining > 0) || items[0];

    return {
      hasSubscription: true,
      // Aggregated headline numbers
      unlocksRemaining,
      unlocksTotal,
      unlocksUsed,
      // Per-plan breakdown so the UI can list every active plan
      subscriptions: items,
      // Back-compat: keep the "primary" plan exposed for the existing
      // dashboard / headline UI that only knows about one subscription.
      subscription: primary?.subscription,
      plan: primary?.plan,
      expiresAt: primary?.expiresAt,
    };
  },

  async checkContactAccess(userId, propertyId) {
    if (await ContactUnlockModel.hasUnlock(userId, propertyId)) {
      return { method: 'already_unlocked' };
    }
    const ent = await PricingService.getEntitlement(userId);
    if (ent.hasSubscription && ent.unlocksRemaining > 0) {
      return { method: 'deduct_subscription', entitlement: ent };
    }
    return {
      method: 'payment_required',
      reason: ent.hasSubscription
        ? 'Your unlock balance is exhausted — buy another plan or upgrade.'
        : 'Purchase a plan to view contact details.',
    };
  },

  async consumeSubscriptionForUnlock(userId, propertyId, transactionId = null) {
    const ent = await PricingService.getEntitlement(userId);
    if (!ent.hasSubscription) {
      throw Object.assign(new Error('No active subscription'), {
        code: 'PAYMENT_REQUIRED', statusCode: 402,
      });
    }
    if (ent.unlocksRemaining <= 0) {
      throw Object.assign(new Error('Unlock balance exhausted'), {
        code: 'QUOTA_EXCEEDED', statusCode: 402,
      });
    }

    // Burn quota from the earliest-expiring subscription that still has any —
    // FIFO so timed plans get consumed before perpetual credits, and the
    // soonest-to-lapse plan is used first within each tier.
    const target = ent.subscriptions.find((i) => i.unlocksRemaining > 0);
    if (!target) {
      throw Object.assign(new Error('Unlock balance exhausted'), {
        code: 'QUOTA_EXCEEDED', statusCode: 402,
      });
    }
    const result = await SubscriptionModel.deductQuota(target.subscription.id);
    if (!result) {
      throw Object.assign(new Error('Quota check failed — please retry'), {
        code: 'QUOTA_ERROR', statusCode: 402,
      });
    }
    return ContactUnlockModel.grant({
      id: uuidv4(),
      user_id: userId,
      property_id: propertyId,
      source: target.plan?.slug || 'subscription',
      subscription_id: target.subscription.id,
      transaction_id: transactionId,
    });
  },

  async consumeSubscriptionForMany(userId, propertyIds) {
    const unlocked = [];
    const needsPayment = [];
    for (const pid of propertyIds) {
      if (await ContactUnlockModel.hasUnlock(userId, pid)) { unlocked.push(pid); continue; }
      const ent = await PricingService.getEntitlement(userId);
      if (!ent.hasSubscription || ent.unlocksRemaining <= 0) {
        needsPayment.push(pid);
        continue;
      }
      await PricingService.consumeSubscriptionForUnlock(userId, pid);
      unlocked.push(pid);
    }
    return { unlocked, needsPayment };
  },

  /** Used by the dashboard subscription summary tab. */
  async getSubscriptionSummary(userId) {
    return PricingService.getEntitlement(userId);
  },
};

module.exports = PricingService;
