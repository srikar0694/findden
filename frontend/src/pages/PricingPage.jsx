import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { plansService } from '../services/plans.service';
import { paymentsService } from '../services/payments.service';
import { dashboardService } from '../services/dashboard.service';
import { useAuthStore } from '../store/authStore';
import Spinner from '../components/shared/Spinner';
import { FadeIn, SlideUp, Stagger, Hover } from '../components/motion';

/**
 * PricingPage
 * -----------
 * Three tiers (per updated requirements):
 *   1. Single Property        — one-time ₹ payment per listing.
 *   2. Multi-Property Bundle  — cart of up to 10 properties, ₹200 / property / month.
 *   3. Pro Monthly            — flat ₹500 for up to 30 properties / month.
 *
 * A live cart picker lets users choose N (1..10) and see the bundle total
 * update in real time; above 10, we recommend the Pro tier.
 */
export default function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [currentSub, setCurrentSub] = useState(null);
  const [cartSize, setCartSize] = useState(3);
  const { token } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    plansService.getAll().then((res) => {
      console.log('Plans API response:', res);
      // Handle both response formats: array directly or {data: [...]}
      const plansData = Array.isArray(res) ? res : res.data || [];
      console.log('Plans data:', plansData);
      // Drop legacy/inactive plans
      const activePlans = plansData.filter((p) => p.isActive !== false); // Show plans unless explicitly inactive
      console.log('Active plans:', activePlans);
      console.log('Plans by tier:', activePlans.map(p => ({ id: p.id, name: p.name, tier: p.tier, slug: p.slug, isActive: p.isActive })));
      setPlans(activePlans);
      setLoading(false);
    }).catch((err) => {
      console.error('Error fetching plans:', err);
      setPlans([]);
      setLoading(false);
    });
    if (token) {
      dashboardService.getSubscription().then((res) => setCurrentSub(res.data)).catch(() => {});
    }
  }, [token]);

  const byTier = useMemo(() => {
    const out = {};
    plans.forEach((p) => { out[p.tier || p.slug] = p; });
    return out;
  }, [plans]);

  const single = byTier.single;
  const bundle = byTier.bundle;
  const pro = byTier.pro;

  // Bundle quote: ₹200 × cartSize, capped at bundle quota. Above cap, recommend Pro.
  const bundleCap   = bundle?.max_cart_items ?? bundle?.quota ?? 10;
  const perUnit     = bundle?.per_unit_price ?? 20;
  const bundleTotal = Math.min(cartSize, bundleCap) * perUnit;
  const overCap     = cartSize > bundleCap;
  const recommendPro = overCap || (pro && cartSize >= 3 && pro.price < bundleTotal);

  const handleSubscribe = async (plan) => {
    if (!token) return navigate('/login');
    setSubscribing(plan.id);
    try {
      const initRes = await paymentsService.initiatePayment({ type: 'subscription', planId: plan.id });
      const order = initRes.data;
      const simulatedPaymentRef = `rzp_pay_sim_${Date.now()}`;
      await paymentsService.verifyPayment({
        paymentId: simulatedPaymentRef,
        orderId: order.orderId,
        signature: 'simulated_signature',
        type: 'subscription',
        planId: plan.id,
      });
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
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <SlideUp className="text-center mb-10" whileInView={false}>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Simple, Transparent Pricing
        </h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Choose the plan that fits you — list a single property, bundle up to 10 at ₹200 each,
          or go Pro with up to 30 listings a month.
        </p>
      </SlideUp>

      {/* Plan cards */}
      <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16" stagger={0.1}>
        {/* 1. Single Property */}
        {single && (
          <Stagger.Item>
            <Hover preset="card" className="h-full">
              <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 h-full flex flex-col">
                <h3 className="text-xl font-bold text-gray-900">{single.name}</h3>
                <p className="text-gray-500 text-sm mt-1">One-time payment per property</p>

                <div className="mt-5 mb-6">
                  <span className="text-4xl font-bold text-gray-900">₹{single.price.toLocaleString()}</span>
                  <span className="text-gray-500 text-sm"> / property</span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  <FeatureLi>List 1 property</FeatureLi>
                  <FeatureLi>Valid for 30 days</FeatureLi>
                  <FeatureLi>No subscription required</FeatureLi>
                  <FeatureLi>Standard listing visibility</FeatureLi>
                </ul>

                <Hover preset="lift">
                  <button
                    onClick={() => handleSubscribe(single)}
                    disabled={subscribing === single.id}
                    className="w-full py-3 rounded-xl font-semibold text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                  >
                    {subscribing === single.id ? <Spinner size="sm" className="py-0" /> : 'Buy Single'}
                  </button>
                </Hover>
              </div>
            </Hover>
          </Stagger.Item>
        )}

        {/* 2. Multi-Property Bundle — interactive cart */}
        {bundle && (
          <Stagger.Item>
            <Hover preset="card" className="h-full">
              <div className="relative bg-gradient-to-br from-white to-blue-50 rounded-2xl border-2 border-blue-500 p-6 shadow-lg shadow-blue-100 h-full flex flex-col">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  MOST POPULAR
                </div>
                <h3 className="text-xl font-bold text-gray-900">{bundle.name}</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Add multiple properties to your cart — price drops per unit.
                </p>

                <div className="mt-5 mb-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={bundleTotal}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                    >
                      <span className="text-4xl font-bold text-blue-700">
                        ₹{bundleTotal.toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-sm"> / month</span>
                    </motion.div>
                  </AnimatePresence>
                  <p className="text-xs text-gray-500 mt-1">
                    ₹{perUnit}/property × <strong>{Math.min(cartSize, bundleCap)}</strong>
                    {overCap && <span className="text-amber-600"> (cap at {bundleCap})</span>}
                  </p>
                </div>

                {/* Cart size picker */}
                <div className="mb-6">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Properties in cart: <strong>{cartSize}</strong>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    value={cartSize}
                    onChange={(e) => setCartSize(parseInt(e.target.value, 10))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                    <span>1</span><span>{bundleCap}</span><span>15</span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  <FeatureLi>Up to {bundleCap} properties in cart</FeatureLi>
                  <FeatureLi>₹{perUnit} per property per month</FeatureLi>
                  <FeatureLi>Priority listing visibility</FeatureLi>
                  <FeatureLi>Analytics dashboard</FeatureLi>
                </ul>

                <Hover preset="lift">
                  <button
                    onClick={() => handleSubscribe(bundle)}
                    disabled={subscribing === bundle.id}
                    className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 transition-shadow"
                  >
                    {subscribing === bundle.id ? <Spinner size="sm" className="py-0" /> : `Subscribe · ₹${bundleTotal}/mo`}
                  </button>
                </Hover>
              </div>
            </Hover>
          </Stagger.Item>
        )}

        {/* 3. Pro Monthly */}
        {pro && (
          <Stagger.Item>
            <Hover preset="card" className="h-full">
              <div className={`relative bg-white rounded-2xl border-2 p-6 h-full flex flex-col transition-colors ${
                recommendPro ? 'border-amber-400 shadow-amber-100 shadow-md' : 'border-gray-200'
              }`}>
                {recommendPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                    BEST VALUE FOR YOU
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900">{pro.name}</h3>
                <p className="text-gray-500 text-sm mt-1">Flat-rate monthly plan for power sellers</p>

                <div className="mt-5 mb-6">
                  <span className="text-4xl font-bold text-gray-900">₹{pro.price.toLocaleString()}</span>
                  <span className="text-gray-500 text-sm"> / month</span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  <FeatureLi>Up to {pro.quota} properties/month</FeatureLi>
                  <FeatureLi>Top-of-search placement</FeatureLi>
                  <FeatureLi>Advanced analytics dashboard</FeatureLi>
                  <FeatureLi>Dedicated account support</FeatureLi>
                </ul>

                <Hover preset="lift">
                  <button
                    onClick={() => handleSubscribe(pro)}
                    disabled={subscribing === pro.id}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                      recommendPro
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {subscribing === pro.id ? <Spinner size="sm" className="py-0" /> : 'Go Pro'}
                  </button>
                </Hover>
              </div>
            </Hover>
          </Stagger.Item>
        )}
      </Stagger>

      {/* FAQ */}
      <FadeIn whileInView className="border-t border-gray-200 pt-10">
        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Frequently Asked Questions</h2>
        <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-6" stagger={0.08}>
          {[
            ['How does the cart work for the bundle plan?', 'Add up to 10 properties to your cart; you pay ₹20 per property per month. It\'s ideal for small agencies.'],
            ['When should I switch to Pro?', 'If you post more than ~3 properties a month, Pro (₹500 flat for up to 30 listings) is the better deal.'],
            ['Can I mix plans?', 'Absolutely. You can pay ₹299 once to list a single property without any subscription at all.'],
            ['Is the payment secure?', 'All payments are processed via Razorpay with bank-level encryption. We never store your card details.'],
          ].map(([q, a]) => (
            <Stagger.Item key={q}>
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 text-sm mb-1.5">{q}</h4>
                <p className="text-gray-600 text-sm leading-relaxed">{a}</p>
              </div>
            </Stagger.Item>
          ))}
        </Stagger>
      </FadeIn>
    </div>
  );
}

function FeatureLi({ children }) {
  return (
    <li className="flex items-center gap-2 text-sm text-gray-700">
      <span className="text-green-500 font-bold">✓</span>
      <span>{children}</span>
    </li>
  );
}
