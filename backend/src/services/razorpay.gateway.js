/**
 * Razorpay Gateway Adapter
 * ----------------------------------------------------------------------
 * Wraps the Razorpay REST API with a narrow, testable interface.
 *
 * - If the `razorpay` npm package is available, it is used (production path).
 * - Otherwise, a sandbox fallback generates Razorpay-shaped order IDs so
 *   local dev / CI continues to work without external calls.
 * - Signature verification uses Node's built-in `crypto` module and is
 *   identical in both modes, so checkout flows can be exercised end-to-end.
 *
 * The adapter deliberately exposes only three methods — `createOrder`,
 * `verifyPaymentSignature`, and `getKeyId` — so the rest of the app has
 * no knowledge of Razorpay internals.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const logger = require('../utils/logger');

let razorpayClient = null;
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  const Razorpay = require('razorpay');
  if (env.razorpay.keyId && env.razorpay.keySecret) {
    razorpayClient = new Razorpay({
      key_id: env.razorpay.keyId,
      key_secret: env.razorpay.keySecret,
    });
    logger.info('[Razorpay] SDK loaded — live gateway enabled');
  }
} catch (e) {
  logger.info('[Razorpay] SDK unavailable — using sandbox order generator');
}

const RazorpayGateway = {
  /**
   * Return whether the live SDK is wired.
   */
  isLive() {
    return razorpayClient != null;
  },

  /**
   * Return the publishable key used by the frontend Checkout widget.
   */
  getKeyId() {
    return env.razorpay.keyId;
  },

  /**
   * Create an order with the gateway.
   * Amount MUST be in paise (smallest currency unit).
   *
   * @param {object} opts
   * @param {number} opts.amount  - Amount in INR (will be multiplied by 100 here).
   * @param {string} opts.currency - ISO currency code; defaults to "INR".
   * @param {string} opts.receipt  - Your internal receipt/order ref.
   * @param {object} opts.notes    - Arbitrary key/value metadata.
   * @returns {Promise<{id:string, amount:number, currency:string, receipt:string}>}
   */
  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    if (!(amount > 0)) {
      throw Object.assign(new Error('Amount must be positive'), {
        code: 'VALIDATION_ERROR', statusCode: 422,
      });
    }
    const amountPaise = Math.round(amount * 100);

    if (razorpayClient) {
      const order = await razorpayClient.orders.create({
        amount: amountPaise,
        currency,
        receipt: receipt || `rcpt_${Date.now()}`,
        notes,
      });
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      };
    }

    // Sandbox fallback — emit a Razorpay-shaped order object.
    const id = `order_${uuidv4().replace(/-/g, '').substring(0, 14)}`;
    return {
      id,
      amount: amountPaise,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      status: 'created',
      _sandbox: true,
    };
  },

  /**
   * Verify the HMAC SHA256 signature returned by Razorpay Checkout.
   * Signature = HMAC(keySecret, `${orderId}|${paymentId}`).
   *
   * In sandbox mode, the frontend sends a locally-computed signature using
   * the same secret; the check is therefore real crypto in both modes.
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    if (!orderId || !paymentId || !signature) return false;
    const expected = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    // Constant-time compare to avoid timing side channels.
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  },

  /**
   * Internal helper used by the sandbox Checkout button on the frontend
   * to stamp a valid signature for a test payment.  This is only exposed
   * when live SDK is NOT connected.
   */
  sandboxSign({ orderId, paymentId }) {
    if (razorpayClient) {
      throw Object.assign(new Error('sandboxSign is not available in live mode'), {
        code: 'FORBIDDEN', statusCode: 403,
      });
    }
    return crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  },
};

module.exports = RazorpayGateway;
