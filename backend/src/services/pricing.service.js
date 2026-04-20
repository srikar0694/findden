/**
 * Contact Access & Pricing Engine
 * ----------------------------------------------------------------------
 * Single source of truth for the rule:
 *   "Posting a property is FREE.
 *    To view a seller's contact details, a buyer must either
 *      (a) hold a persistent per-property unlock, or
 *      (b) have an active subscription with quota remaining — which,
 *          when spent, grants (a) for that property going forward."
 *
 * This service never touches HTTP; it's pure domain logic.
 */

const SubscriptionModel = require('../models/subscription.model');
const PlanModel = require('../models/plan.model');
const ContactUnlockModel = require('../models/contactUnlock.model');
const { v4: uuidv4 } = require('uuid');

const PricingService = {
  /**
   * Return the caller's current entitlement snapshot.
   * Used by dashboards & the Unlock Contact button.
   */
  getEntitlement(userId) {
    const subscription = SubscriptionModel.findActiveByUserId(userId);
    if (!subscription) return { hasSubscription: false };

    const plan = PlanModel.findById(subscription.plan_id);
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

  /**
   * Decide how a contact request for `propertyId` should be satisfied.
   *
   *   { method: 'already_unlocked' }           → user already paid for this one
   *   { method: 'deduct_subscription', plan }  → active sub has quota remaining
   *   { method: 'payment_required',   reason } → user must purchase (Single / Cart / Premium)
   *
   * This method does NOT mutate state; it's a pure decision function.
   */
  checkContactAccess(userId, propertyId) {
    if (ContactUnlockModel.hasUnlock(userId, propertyId)) {
      return { method: 'already_unlocked' };
    }
    const ent = PricingService.getEntitlement(userId);
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

  /**
   * Consume one slot of the user's subscription quota and persist a
   * permanent per-property unlock.  Atomic: if the quota check fails we
   * never create the unlock row.
   */
  consumeSubscriptionForUnlock(userId, propertyId, transactionId = null) {
    const ent = PricingService.getEntitlement(userId);
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
    const result = SubscriptionModel.deductQuota(ent.subscription.id, ent.plan.unlock_quota);
    if (!result.success) {
      throw Object.assign(new Error(result.reason), {
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

  /**
   * Batch variant used from the Wishlist "Unlock all" flow.
   * Returns { unlocked, needsPayment } where `needsPayment` is the subset
   * of propertyIds that couldn't be served from the current quota.
   */
  consumeSubscriptionForMany(userId, propertyIds) {
    const unlocked = [];
    const needsPayment = [];
    for (const pid of propertyIds) {
      if (ContactUnlockModel.hasUnlock(userId, pid)) { unlocked.push(pid); continue; }
      const ent = PricingService.getEntitlement(userId);
      if (!ent.hasSubscription || ent.unlocksRemaining <= 0) {
        needsPayment.push(pid);
        continue;
      }
      PricingService.consumeSubscriptionForUnlock(userId, pid);
      unlocked.push(pid);
    }
    return { unlocked, needsPayment };
  },
};

module.exports = PricingService;
