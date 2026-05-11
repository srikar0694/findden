const SubscriptionModel = require('../models/subscription.model');
const PlanModel = require('../models/plan.model');
const ContactUnlockModel = require('../models/contactUnlock.model');
const { v4: uuidv4 } = require('uuid');

const PricingService = {
  async getEntitlement(userId) {
    const subscription = await SubscriptionModel.findActiveByUserId(userId);
    if (!subscription) return { hasSubscription: false };

    const plan = await PlanModel.findById(subscription.plan_id);
    const quota = plan?.unlock_quota || 0;
    const used = subscription.quota_used || 0;
    return {
      hasSubscription: true,
      subscription,
      plan,
      unlocksRemaining: Math.max(0, quota - used),
      unlocksTotal: quota,
      unlocksUsed: used,
      expiresAt: subscription.expires_at,
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
        ? 'Your monthly unlock quota is exhausted — upgrade or buy a single unlock.'
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
      throw Object.assign(new Error('Monthly unlock quota exhausted'), {
        code: 'QUOTA_EXCEEDED', statusCode: 402,
      });
    }
    const result = await SubscriptionModel.deductQuota(ent.subscription.id);
    if (!result) {
      throw Object.assign(new Error('Quota check failed — please retry'), {
        code: 'QUOTA_ERROR', statusCode: 402,
      });
    }
    return ContactUnlockModel.grant({
      id: uuidv4(),
      user_id: userId,
      property_id: propertyId,
      source: ent.plan.slug,
      subscription_id: ent.subscription.id,
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
