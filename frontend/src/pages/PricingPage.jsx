import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { plansService } from '../services/plans.service';
import { paymentsService } from '../services/payments.service';
import { dashboardService } from '../services/dashboard.service';
import { useAuthStore } from '../store/authStore';
import Spinner from '../components/shared/Spinner';

export default function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [currentSub, setCurrentSub] = useState(null);
  const { token, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    plansService.getAll().then((res) => {
      setPlans(res.data.filter((p) => p.id !== 'plan-pay-per-listing-004'));
      setLoading(false);
    });
    if (token) {
      dashboardService.getSubscription().then((res) => setCurrentSub(res.data)).catch(() => {});
    }
  }, [token]);

  const handleSubscribe = async (plan) => {
    if (!token) return navigate('/login');
    setSubscribing(plan.id);
    try {
      // Initiate payment
      const initRes = await paymentsService.initiatePayment({ type: 'subscription', planId: plan.id });
      const order = initRes.data;

      // Simulate payment flow (in production, open Razorpay SDK here)
      const simulatedPaymentRef = `rzp_pay_sim_${Date.now()}`;

      // Verify payment
      await paymentsService.verifyPayment({
        paymentId: simulatedPaymentRef,
        orderId: order.orderId,
        signature: 'simulated_signature',
        type: 'subscription',
        planId: plan.id,
      });

      // Subscribe
      await dashboardService.subscribe({ planId: plan.id, paymentRef: simulatedPaymentRef });
      navigate('/dashboard');
    } catch (err) {
      alert(err.message || 'Subscription failed. Please try again.');
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Simple, Transparent Pricing</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Post your properties on FindDen and reach thousands of potential buyers and renters across India.
        </p>
      </div>

      {/* Pay-per-listing banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8 flex items-center gap-4">
        <span className="text-3xl">💡</span>
        <div>
          <h3 className="font-semibold text-amber-900">No subscription? No problem.</h3>
          <p className="text-amber-700 text-sm mt-0.5">
            Post individual listings at <strong>₹299 per property</strong> (valid 30 days). Pay only when you need it.
          </p>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {plans.map((plan, i) => {
          const isCurrentPlan = currentSub?.planId === plan.id;
          const isPro = plan.name === 'Pro';
          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl border-2 p-6 shadow-sm transition-all ${
                isPro ? 'border-blue-500 shadow-blue-100 shadow-md' : 'border-gray-200'
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">₹{plan.price.toLocaleString()}</span>
                <span className="text-gray-500 text-sm">/{plan.durationDays} days</span>
              </div>

              <ul className="space-y-2.5 mb-6">
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Post up to <strong>{plan.quota} listings</strong></span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Valid for {plan.durationDays} days</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>Priority listing visibility</span>
                </li>
                {i >= 1 && (
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Analytics dashboard</span>
                  </li>
                )}
                {i >= 2 && (
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Dedicated account manager</span>
                  </li>
                )}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={subscribing === plan.id || isCurrentPlan}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  isCurrentPlan
                    ? 'bg-green-50 text-green-700 border border-green-300 cursor-default'
                    : isPro
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {subscribing === plan.id ? (
                  <Spinner size="sm" className="py-0" />
                ) : isCurrentPlan ? (
                  '✓ Current Plan'
                ) : (
                  `Get ${plan.name}`
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="border-t border-gray-200 pt-10">
        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Frequently Asked Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            ['What happens when my quota runs out?', 'You can upgrade to a higher plan or pay ₹299 per additional listing. Your existing listings stay active until they expire.'],
            ['Can I cancel my subscription?', 'Yes, you can cancel anytime from your dashboard. Your quota remains usable until the plan expiry date.'],
            ['Can I list multiple property types?', 'Yes! Your quota covers apartments, houses, villas, plots, commercial spaces, and PGs.'],
            ['Is the payment secure?', 'All payments are processed via Razorpay with bank-level encryption. We never store your card details.'],
          ].map(([q, a]) => (
            <div key={q} className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-1.5">{q}</h4>
              <p className="text-gray-600 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
