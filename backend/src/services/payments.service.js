/**
 * Payments Service
 * ----------------------------------------------------------------------
 * Orchestrates Razorpay-backed checkout flows for the three pricing tiers:
 *
 *   1. Single Property  — ₹40 one-time, grants 1 contact unlock (optionally
 *                          bound to a specific propertyId at checkout time).
 *   2. Multi-Property   — ₹200 / month, 10 unlocks valid 30 days, can be
 *                          fed by a cart of property IDs.
 *   3. Premium Monthly  — ₹500 / month, 30 unlocks valid 30 days.
 *
 * Posting a property is **always free** and never touches this service.
 *
 * Flow:
 *   POST /payments/initiate  → creates a Razorpay order, returns { orderId,
 *                              amount, key } for Checkout widget.
 *   POST /payments/verify    → verifies HMAC signature, records transaction,
 *                              activates subscription / grants unlocks, and
 *                              (if a cart was provided) bulk-unlocks contacts.
 */

const { v4: uuidv4 } = require('uuid');
const TransactionModel = require('../models/transaction.model');
const PlanModel = require('../models/plan.model');
const SubscriptionModel = require('../models/subscription.model');
const ContactUnlockModel = require('../models/contactUnlock.model');
const RazorpayGateway = require('./razorpay.gateway');
const { paginate, applyPagination } = require('../utils/pagination');
const { PRICING } = require('../config/constants');

const PaymentsService = {
  /**
   * Resolve the plan + amount for a checkout intent.
   * Accepts either a planId OR a planSlug (single|cart|premium).
   */
  resolvePlan({ planId, planSlug }) {
    let plan = null;
    if (planId) plan = PlanModel.findById(planId);
    if (!plan && planSlug) plan = PlanModel.findBySlug(planSlug);
    if (!plan || !plan.is_active) {
      throw Object.assign(new Error('Plan not found or inactive'), {
        code: 'NOT_FOUND', statusCode: 404,
      });
    }
    return plan;
  },

  /**
   * Step 1 of checkout — create a Razorpay order.
   *
   * @param {string} userId
   * @param {object} body
   *   - planId or planSlug    (required)
   *   - propertyIds: string[] (optional — used by Single & Cart tiers to
   *                            pre-bind the unlock(s) on verify).
   */
  async initiatePayment(userId, body) {
    const { planId, planSlug, propertyIds = [] } = body;
    const plan = this.resolvePlan({ planId, planSlug });

    // For the Single tier we accept exactly one property ID (optional —
    // user can also unlock later by clicking on any one property).
    if (plan.slug === 'single' && propertyIds.length > 1) {
      throw Object.assign(new Error('Single tier accepts at most one property'), {
        code: 'VALIDATION_ERROR', statusCode: 422,
      });
    }
    // Cart tier: cap at the plan quota.
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
      notes: {
        userId,
        planId: plan.id,
        planSlug: plan.slug,
        propertyIds: propertyIds.join(','),
      },
    });

    // Pre-record a PENDING transaction so we have audit trail even if
    // checkout is abandoned.
    TransactionModel.create({
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
      metadata: {
        planSlug: plan.slug,
        propertyIds,
        sandbox: order._sandbox === true,
      },
    });

    return {
      orderId: order.id,
      amount: order.amount,           // paise
      currency: order.currency,
      key: RazorpayGateway.getKeyId(),
      planId: plan.id,
      planSlug: plan.slug,
      planName: plan.name,
      sandbox: order._sandbox === true,
      // The frontend uses these to render the Checkout pre-fill / receipt.
      receipt: order.receipt,
    };
  },

  /**
   * Step 2 of checkout — verify Razorpay signature and activate entitlements.
   *
   * @param {string} userId
   * @param {object} body
   *   - razorpay_order_id     (required)
   *   - razorpay_payment_id   (required)
   *   - razorpay_signature    (required)
   *   - propertyIds: string[] (optional — overrides what was sent at initiate)
   */
  async verifyPayment(userId, body) {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      propertyIds: propertyIdsOverride,
    } = body;

    const ok = RazorpayGateway.verifyPaymentSignature({ orderId, paymentId, signature });
    if (!ok) {
      // Mark pending tx as failed (best effort).
      const pending = TransactionModel.findByPaymentRef(orderId);
      if (pending) TransactionModel.update(pending.id, { status: 'failed' });
      throw Object.assign(new Error('Invalid payment signature'), {
        code: 'PAYMENT_FAILED', statusCode: 402,
      });
    }

    const pending = TransactionModel.findByPaymentRef(orderId);
    if (!pending || pending.user_id !== userId) {
      throw Object.assign(new Error('Order not found for this user'), {
        code: 'NOT_FOUND', statusCode: 404,
      });
    }
    if (pending.status === 'success') {
      // Idempotent — return the previously-issued result.
      return { alreadyVerified: true, transactionId: pending.id };
    }

    const plan = PlanModel.findBySlug(pending.metadata?.planSlug)
              || PlanModel.findById(pending.metadata?.planId);
    if (!plan) {
      throw Object.assign(new Error('Plan no longer available'), {
        code: 'NOT_FOUND', statusCode: 404,
      });
    }

    const propertyIds = Array.isArray(propertyIdsOverride) && propertyIdsOverride.length
      ? propertyIdsOverride
      : (pending.metadata?.propertyIds || []);

    // ---- Activate entitlement -------------------------------------------------
    let subscription = null;
    const grantedUnlocks = [];

    if (plan.billing_cycle === 'monthly') {
      // Create a fresh subscription with full quota.
      const days = plan.duration_days || 30;
      subscription = SubscriptionModel.create({
        id: uuidv4(),
        user_id: userId,
        plan_id: plan.id,
        starts_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
        payment_ref: paymentId,
      });

      // Pre-unlock any cart-bound properties (counts against quota).
      for (const pid of propertyIds.slice(0, plan.unlock_quota)) {
        const unlock = ContactUnlockModel.grant({
          id: uuidv4(),
          user_id: userId,
          property_id: pid,
          source: plan.slug,
          subscription_id: subscription.id,
          transaction_id: pending.id,
        });
        SubscriptionModel.deductQuota(subscription.id, plan.unlock_quota);
        grantedUnlocks.push(unlock);
      }
    } else {
      // One-time single-property unlock.
      const pid = propertyIds[0];
      if (pid) {
        const unlock = ContactUnlockModel.grant({
          id: uuidv4(),
          user_id: userId,
          property_id: pid,
          source: 'single',
          subscription_id: null,
          transaction_id: pending.id,
        });
        grantedUnlocks.push(unlock);
      }
      // If no propertyId was given at checkout, the credit is held as a
      // floating "single-unlock" entitlement and consumed on first request.
    }

    // ---- Mark transaction success --------------------------------------------
    const updated = TransactionModel.update(pending.id, {
      status: 'success',
      subscription_id: subscription?.id || null,
      payment_ref: paymentId,
      property_id: propertyIds[0] || null,
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

  getHistory(userId, query) {
    const { rows, total } = TransactionModel.findByUserId(userId, 1000, 0);
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
