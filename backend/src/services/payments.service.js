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

    if (plan.slug === 'single' && propertyIds.length > 1) {
      throw Object.assign(new Error('Single tier accepts at most one property'), {
        code: 'VALIDATION_ERROR', statusCode: 422,
      });
    }
    if (plan.slug === 'cart' && propertyIds.length > plan.unlock_quota) {
      throw Object.assign(
        new Error(`Cart capacity is ${plan.unlock_quota} properties`),
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
      property_id: propertyIds[0] || null,
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

    let subscription = null;
    const grantedUnlocks = [];

    if (plan.billing_cycle === 'monthly') {
      const days = plan.duration_days || 30;
      subscription = await SubscriptionModel.create({
        id: uuidv4(),
        user_id: userId,
        plan_id: plan.id,
        starts_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      });

      for (const pid of propertyIds.slice(0, plan.unlock_quota)) {
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
    } else {
      const pid = propertyIds[0];
      if (pid) {
        const unlock = await ContactUnlockModel.grant({
          id: uuidv4(),
          user_id: userId,
          property_id: pid,
          source: 'single',
          subscription_id: null,
          transaction_id: pending.id,
        });
        grantedUnlocks.push(unlock);
      }
    }

    const updated = await TransactionModel.update(pending.id, {
      status: 'success',
      payment_ref: paymentId,
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
