const { v4: uuidv4 } = require('uuid');
const TransactionModel = require('../models/transaction.model');
const PlanModel = require('../models/plan.model');
const SubscriptionModel = require('../models/subscription.model');
const ContactUnlockModel = require('../models/contactUnlock.model');
const RazorpayGateway = require('./razorpay.gateway');
const { paginate, applyPagination } = require('../utils/pagination');
const { PRICING } = require('../config/constants');

const PaymentsService = {
  async resolvePlan({ planId, planSlug }) {
    let plan = null;
    if (planId) plan = await PlanModel.findById(planId);
    if (!plan && planSlug) plan = await PlanModel.findBySlug(planSlug);
    if (!plan || !plan.is_active) {
      throw Object.assign(new Error('Plan not found or inactive'), {
        code: 'NOT_FOUND', statusCode: 404,
      });
    }
    return plan;
  },

  async initiatePayment(userId, body) {
    const { planId, planSlug, propertyIds = [] } = body;
    const plan = await this.resolvePlan({ planId, planSlug });

    // CR — payment is for the SUBSCRIPTION. `propertyIds` is optional and
    // only used as a UX shortcut to auto-grant unlocks at verify time
    // (e.g. the wishlist "pay & unlock these N" flow). Users can subscribe
    // first and unlock properties later via /api/contacts/unlock/:id.
    if (plan.unlock_quota && propertyIds.length > plan.unlock_quota) {
      throw Object.assign(
        new Error(`Plan capacity is ${plan.unlock_quota} property unlock(s)`),
        { code: 'VALIDATION_ERROR', statusCode: 422 }
      );
    }

    const order = await RazorpayGateway.createOrder({
      amount: plan.price,
      currency: plan.currency || PRICING.currency,
      receipt: `findden_${plan.slug}_${Date.now()}`,
      notes: { userId, planId: plan.id, planSlug: plan.slug, propertyIds: propertyIds.join(',') },
    });

    await TransactionModel.create({
      id: uuidv4(),
      user_id: userId,
      subscription_id: null,
      // CR — transactions stay decoupled from properties; the subscription is
      // the entitlement and any unlocks reference it via contact_unlocks.
      property_id: null,
      amount: plan.price,
      currency: plan.currency || PRICING.currency,
      type: plan.billing_cycle === 'one_time' ? 'one_time' : 'subscription',
      status: 'pending',
      payment_gateway: 'razorpay',
      payment_ref: order.id,
      metadata: { planSlug: plan.slug, propertyIds, sandbox: order._sandbox === true },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: RazorpayGateway.getKeyId(),
      planId: plan.id,
      planSlug: plan.slug,
      planName: plan.name,
      sandbox: order._sandbox === true,
      receipt: order.receipt,
    };
  },

  async verifyPayment(userId, body) {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      propertyIds: propertyIdsOverride,
    } = body;

    const ok = RazorpayGateway.verifyPaymentSignature({ orderId, paymentId, signature });
    if (!ok) {
      const pending = await TransactionModel.findByPaymentRef(orderId);
      if (pending) await TransactionModel.update(pending.id, { status: 'failed' });
      throw Object.assign(new Error('Invalid payment signature'), {
        code: 'PAYMENT_FAILED', statusCode: 402,
      });
    }

    const pending = await TransactionModel.findByPaymentRef(orderId);
    if (!pending || pending.user_id !== userId) {
      throw Object.assign(new Error('Order not found for this user'), {
        code: 'NOT_FOUND', statusCode: 404,
      });
    }
    if (pending.status === 'success') {
      return { alreadyVerified: true, transactionId: pending.id };
    }

    const plan = await PlanModel.findBySlug(pending.metadata?.planSlug)
              || await PlanModel.findById(pending.metadata?.planId);
    if (!plan) {
      throw Object.assign(new Error('Plan no longer available'), {
        code: 'NOT_FOUND', statusCode: 404,
      });
    }

    const propertyIds = Array.isArray(propertyIdsOverride) && propertyIdsOverride.length
      ? propertyIdsOverride
      : (pending.metadata?.propertyIds || []);

    // CR — every plan creates its own subscription row. Buying additional
    // plans STACKS the balance — prior active subscriptions are left alone
    // and their remaining quota continues to count. See
    // `PricingService.getEntitlement` for the aggregation logic.
    const days = plan.duration_days || 30;
    const subscription = await SubscriptionModel.create({
      id: uuidv4(),
      user_id: userId,
      plan_id: plan.id,
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    });

    const grantedUnlocks = [];
    for (const pid of propertyIds.slice(0, plan.unlock_quota || 0)) {
      const unlock = await ContactUnlockModel.grant({
        id: uuidv4(),
        user_id: userId,
        property_id: pid,
        source: plan.slug,
        subscription_id: subscription.id,
        transaction_id: pending.id,
      });
      await SubscriptionModel.deductQuota(subscription.id);
      grantedUnlocks.push(unlock);
    }

    // Backfill subscription_id so the ledger row links to the entitlement it paid for.
    const updated = await TransactionModel.update(pending.id, {
      status: 'success',
      payment_ref: paymentId,
      subscription_id: subscription.id,
    });

    return {
      verified: true,
      transactionId: updated.id,
      planId: plan.id,
      planSlug: plan.slug,
      subscription,
      unlocks: grantedUnlocks,
    };
  },

  async getHistory(userId, query) {
    const { rows, total } = await TransactionModel.findByUserId(userId, 1000, 0);
    const { page, limit, offset, meta } = paginate(query, total);
    const paginated = applyPagination(rows, offset, limit);
    return {
      data: paginated.map(formatTransaction),
      meta: { ...meta, page, limit },
    };
  },
};

function formatTransaction(t) {
  return {
    id: t.id,
    userId: t.user_id,
    subscriptionId: t.subscription_id,
    propertyId: t.property_id,
    amount: t.amount,
    currency: t.currency,
    type: t.type,
    status: t.status,
    paymentGateway: t.payment_gateway,
    paymentRef: t.payment_ref,
    metadata: t.metadata || {},
    createdAt: t.created_at,
  };
}

module.exports = PaymentsService;
