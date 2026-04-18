const { v4: uuidv4 } = require('uuid');
const TransactionModel = require('../models/transaction.model');
const PlanModel = require('../models/plan.model');
const { razorpay } = require('../config/env');
const { paginate, applyPagination } = require('../utils/pagination');

const PaymentsService = {
  /**
   * Initiate a payment order.
   * In production, this calls Razorpay/Stripe to create an order.
   * Here we simulate an order ID.
   */
  initiatePayment(userId, { type, planId, propertyId }) {
    let amount = 0;
    let description = '';

    if (type === 'subscription' && planId) {
      const plan = PlanModel.findById(planId);
      if (!plan) throw Object.assign(new Error('Plan not found'), { code: 'NOT_FOUND', statusCode: 404 });
      amount = plan.price;
      description = `FindDen ${plan.name} Subscription`;
    } else if (type === 'pay_per_listing') {
      const payPerListingPlan = PlanModel.findById('plan-pay-per-listing-004');
      amount = payPerListingPlan ? payPerListingPlan.price : 299;
      description = 'FindDen Pay Per Listing';
    } else {
      throw Object.assign(new Error('Invalid payment type'), { code: 'VALIDATION_ERROR', statusCode: 422 });
    }

    // Simulate Razorpay order creation
    const orderId = `rzp_order_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    return {
      orderId,
      amount,
      currency: 'INR',
      description,
      key: razorpay.keyId,
      prefill: { name: '', email: '' },
    };
  },

  /**
   * Verify a payment callback from the gateway.
   * Simulated: any non-empty paymentId + orderId is considered successful.
   */
  verifyPayment(userId, { paymentId, orderId, signature, type, planId, propertyId }) {
    // In production: verify HMAC signature from Razorpay
    if (!paymentId || !orderId) {
      throw Object.assign(new Error('Payment verification failed'), { code: 'PAYMENT_FAILED', statusCode: 402 });
    }

    // Return the payment reference to use in subscribe/create-property calls
    return { paymentRef: paymentId, orderId, verified: true };
  },

  getHistory(userId, query) {
    const { page, limit, offset, meta } = paginate(query, 0);
    const { rows, total } = TransactionModel.findByUserId(userId, 1000, 0);
    const { meta: realMeta } = paginate(query, total);
    const paginated = applyPagination(rows, offset, limit);
    return {
      data: paginated.map(formatTransaction),
      meta: realMeta,
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
    createdAt: t.created_at,
  };
}

module.exports = PaymentsService;
