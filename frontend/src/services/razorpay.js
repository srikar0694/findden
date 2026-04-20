/**
 * Razorpay Checkout helper — loads the Razorpay widget on demand and
 * returns a Promise that resolves with the payment event (order_id,
 * payment_id, signature) once the user completes the flow.
 *
 * In dev / sandbox mode (when the backend returns `sandbox: true`),
 * we skip loading the Razorpay widget and instead:
 *   1. Generate a fake payment_id client-side.
 *   2. Ask /api/payments/sandbox-sign for a real HMAC over (order|payment).
 *   3. Pretend the user clicked Pay.
 * This lets the full checkout + entitlement flow run offline, end-to-end,
 * while still exercising the real signature-verify path on the server.
 */

import { paymentsService } from './payments.service';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptLoading = null;

function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = RAZORPAY_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error('Failed to load Razorpay Checkout script'));
    document.body.appendChild(s);
  });
  return scriptLoading;
}

/**
 * Launch checkout for an already-created Razorpay order.
 *
 * @param {object} order - server response from POST /payments/initiate
 * @param {object} user  - current user (for prefill)
 * @returns {Promise<{razorpay_order_id, razorpay_payment_id, razorpay_signature}>}
 */
export async function openRazorpayCheckout(order, user = {}) {
  // --- Sandbox short-circuit --------------------------------------------
  if (order.sandbox) {
    const paymentId = `pay_sbx_${Math.random().toString(36).slice(2, 14)}`;
    const { data } = await paymentsService.sandboxSign({
      orderId: order.orderId,
      paymentId,
    });
    // Let the caller see a tiny delay so the UI can show a spinner.
    await new Promise((r) => setTimeout(r, 400));
    return {
      razorpay_order_id: order.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: data.signature,
      _sandbox: true,
    };
  }

  // --- Real Razorpay Checkout --------------------------------------------
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      name: 'FindDen',
      description: order.planName || 'FindDen Plan',
      order_id: order.orderId,
      prefill: {
        name: user.name || '',
        email: user.email || '',
        contact: user.phone || '',
      },
      theme: { color: '#2563eb' },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(Object.assign(new Error('Payment cancelled'), { code: 'CANCELLED' })),
      },
    });
    rzp.on('payment.failed', (resp) =>
      reject(Object.assign(new Error(resp.error?.description || 'Payment failed'), { code: 'FAILED' })),
    );
    rzp.open();
  });
}

/**
 * End-to-end checkout: initiate → open Razorpay → verify → return server result.
 *
 * @param {object} opts
 *   - planSlug | planId  (required)
 *   - propertyIds: []    (optional — pre-bind unlocks)
 *   - user               (current auth user, for prefill)
 * @returns { planSlug, subscription, unlocks, transactionId }
 */
export async function runCheckout({ planSlug, planId, propertyIds = [], user }) {
  const { data: order } = await paymentsService.initiatePayment({
    planSlug,
    planId,
    propertyIds,
  });
  const rzpEvent = await openRazorpayCheckout(order, user || {});
  const { data: verified } = await paymentsService.verifyPayment({
    ...rzpEvent,
    propertyIds,
  });
  return { ...verified, order, sandbox: !!order.sandbox };
}
