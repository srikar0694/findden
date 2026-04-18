/**
 * Pricing Engine — Core business logic for listing monetisation.
 * This service is the single source of truth for quota and payment decisions.
 * Never call this logic from the frontend.
 */

const SubscriptionModel = require('../models/subscription.model');
const PlanModel = require('../models/plan.model');
const TransactionModel = require('../models/transaction.model');

const PricingService = {
  /**
   * Determine if a user can post a listing and via which mechanism.
   * Returns: { canPost, method: 'subscription'|'pay_per_listing'|'none', subscription, reason }
   */
  async checkPostingEligibility(userId, paymentRef = null) {
    const subscription = SubscriptionModel.findActiveByUserId(userId);

    if (subscription) {
      const plan = PlanModel.findById(subscription.plan_id);
      if (!plan) return { canPost: false, method: 'none', reason: 'Plan not found' };

      const remaining = plan.quota - subscription.quota_used;
      if (remaining > 0) {
        return { canPost: true, method: 'subscription', subscription, plan, remaining };
      }
      // Quota exhausted — check if they want to pay per listing
      if (paymentRef) {
        return { canPost: true, method: 'pay_per_listing', subscription: null };
      }
      return {
        canPost: false,
        method: 'none',
        reason: 'Subscription quota exhausted. Please upgrade or pay per listing.',
      };
    }

    // No active subscription
    if (paymentRef) {
      return { canPost: true, method: 'pay_per_listing', subscription: null };
    }

    return {
      canPost: false,
      method: 'none',
      reason: 'No active subscription. Please subscribe or pay per listing.',
    };
  },

  /**
   * Deduct one listing slot from the user's active subscription.
   */
  async deductSubscriptionQuota(subscriptionId, planId) {
    const plan = PlanModel.findById(planId);
    if (!plan) throw new Error('Plan not found');
    const result = SubscriptionModel.deductQuota(subscriptionId, plan.quota);
    if (!result.success) throw Object.assign(new Error(result.reason), { code: 'QUOTA_ERROR' });
    return result.subscription;
  },

  /**
   * Verify a pay-per-listing payment reference.
   * In production, this calls the payment gateway SDK.
   * Here we simulate success for non-empty refs.
   */
  async verifyPayPerListingPayment(paymentRef, userId, propertyId) {
    if (!paymentRef) throw new Error('Payment reference is required for pay-per-listing');

    // Simulate gateway verification
    const payPerListingPlan = PlanModel.findById('plan-pay-per-listing-004');
    const amount = payPerListingPlan ? payPerListingPlan.price : 299;

    const transaction = TransactionModel.create({
      id: require('uuid').v4(),
      user_id: userId,
      subscription_id: null,
      property_id: propertyId,
      amount,
      currency: 'INR',
      type: 'pay_per_listing',
      status: 'success',
      payment_gateway: 'razorpay',
      payment_ref: paymentRef,
      metadata: { verified_at: new Date().toISOString() },
    });

    return transaction;
  },

  /**
   * Get subscription summary for a user (for dashboard).
   */
  getSubscriptionSummary(userId) {
    const sub = SubscriptionModel.findActiveByUserId(userId);
    if (!sub) return null;
    const plan = PlanModel.findById(sub.plan_id);
    return {
      ...sub,
      plan,
      quota_remaining: plan ? plan.quota - sub.quota_used : 0,
    };
  },
};

module.exports = PricingService;
