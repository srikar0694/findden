import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { plansService } from '../services/plans.service';
import { contactsService } from '../services/contacts.service';
import { runCheckout } from '../services/razorpay';
import { useAuthStore } from '../store/authStore';
import Spinner from '../components/shared/Spinner';
import { FadeIn, SlideUp, Stagger, Hover } from '../components/motion';

/**
 * PricingPage (CR §1)
 * --------------------
 * Three fixed tiers — all monthly with 30-day expiry:
 *   • ₹9   — unlock 1 property in a month
 *   • ₹100 — unlock up to 12 properties in a month
 *   • ₹500 — unlock up to 65 properties in a month
 *
 * Clicking a plan launches the Razorpay checkout via `runCheckout(...)`,
 * which initiates → opens Razorpay → verifies signature → records the
 * transaction + subscription in our DB. On success the user lands on the
 * dashboard with their fresh entitlement.
 */
export default function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);   // planSlug currently checking out
  // CR — full aggregated entitlement (every active sub + total balance)
  const [entitlement, setEntitlement] = useState(null);
  const [toast, setToast] = useState(null);     // { type, text }
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const flash = (type, text, ms = 4000) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), ms);
  };

  const refreshEntitlement = () =>
    contactsService.getEntitlement().then((res) => setEntitlement(res.data)).catch(() => {});

  useEffect(() => {
    plansService.getAll()
      .then((res) => {
        const data = Array.isArray(res) ? res : res.data || [];
        setPlans(data.filter((p) => p.isActive !== false));
        setLoading(false);
      })
      .catch(() => { setPlans([]); setLoading(false); });
    if (token) refreshEntitlement();
  }, [token]);

  // If we landed here from the property page (e.g. ?from=unlock), surface a banner.
  const fromUnlock = params.get('from') === 'unlock';

  const byTier = useMemo(() => {
    const out = {};
    plans.forEach((p) => { out[p.tier || p.slug] = p; });
    return out;
  }, [plans]);

  const tiers = [byTier.single, byTier.bundle, byTier.pro].filter(Boolean);

  const handleSubscribe = async (plan) => {
    if (!token) {
      navigate('/login?next=/pricing');
      return;
    }
    setPaying(plan.slug);
    try {
      const result = await runCheckout({ planSlug: plan.slug, user });
      flash('success', `Payment successful — ${plan.name} is now active.`);
      // Refresh the active-plan banner so the user can see their new balance
      // stacked on top of any existing plans before we navigate away.
      await refreshEntitlement();
      setTimeout(() => navigate('/dashboard'), 800);
      return result;
    } catch (err) {
      if (err.code === 'CANCELLED') {
        flash('error', 'Payment cancelled.');
      } else {
        flash('error', err.message || 'Payment failed. Please try again.');
      }
    } finally {
      setPaying(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 relative">
      {/* Toast (success / error) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <SlideUp className="text-center mb-10" whileInView={false}>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Simple, Transparent Pricing
        </h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Pick a plan to unlock contact details. Every plan is valid for 30 days
          from purchase — unlock the included number of properties any time within
          the month.
        </p>
        {fromUnlock && (
          <div className="mt-4 inline-block bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-full px-4 py-2">
            🔒 You need an active plan to unlock contact details — pick one below.
          </div>
        )}
      </SlideUp>

      {/* CR — Active entitlement banner. Stacks every plan the user holds and
          shows the aggregated remaining unlocks. Helps them decide whether
          they actually need to buy more. */}
      {entitlement && entitlement.hasSubscription && (
        <FadeIn className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-5 mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">Your active plan(s)</p>
              <p className="text-2xl font-bold mt-1">
                {entitlement.unlocksRemaining}
                <span className="text-sm font-normal text-blue-100"> / {entitlement.unlocksTotal} unlocks left</span>
              </p>
              <p className="text-blue-100 text-xs mt-1">
                {entitlement.unlocksUsed} used so far · stacked from{' '}
                {(entitlement.subscriptions || []).length} active subscription
                {(entitlement.subscriptions || []).length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-white/20 hover:bg-white/30 text-sm font-medium px-4 py-2 rounded-lg shrink-0"
            >
              View dashboard →
            </button>
          </div>

          {/* Per-plan breakdown */}
          {(entitlement.subscriptions || []).length > 0 && (
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {entitlement.subscriptions.map((s) => (
                <li key={s.subscription.id} className="bg-white/10 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{s.plan?.name || 'Plan'}</p>
                    <p className="text-blue-100 text-[11px]">
                      {s.unlocksRemaining}/{s.unlocksTotal} left
                      {s.expiresAt && ` · expires ${new Date(s.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </FadeIn>
      )}

      {/* Three plan cards */}
      <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16" stagger={0.1}>
        {tiers.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            paying={paying === plan.slug}
            onSubscribe={() => handleSubscribe(plan)}
          />
        ))}
      </Stagger>

      {/* FAQ */}
      <FadeIn whileInView className="border-t border-gray-200 pt-10">
        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Frequently Asked Questions</h2>
        <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-6" stagger={0.08}>
          {[
            ['How does monthly expiry work?', 'Your unlocks are valid for 30 days from purchase. You can unlock any property within that window — unused unlocks expire at the end of the month.'],
            ['Can I upgrade later?', 'Yes — purchase any plan and the new entitlement replaces the old one. Unused unlocks from the previous plan are forfeited.'],
            ['Is the payment secure?', 'All payments are processed via Razorpay with bank-level encryption. We never store your card details.'],
            ['Do plans auto-renew?', 'No. You only pay when you choose to renew — there is no auto-charge.'],
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

function PlanCard({ plan, paying, onSubscribe }) {
  const isHighlight = !!plan.highlight;
  const quota = plan.unlockQuota ?? plan.unlock_quota ?? 0;
  return (
    <Stagger.Item>
      <Hover preset="card" className="h-full">
        <div className={`relative rounded-2xl border-2 p-6 h-full flex flex-col ${
          isHighlight
            ? 'border-blue-500 bg-gradient-to-br from-white to-blue-50 shadow-lg shadow-blue-100'
            : 'border-gray-200 bg-white'
        }`}>
          {isHighlight && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
              MOST POPULAR
            </div>
          )}
          <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
          <p className="text-gray-500 text-sm mt-1">{plan.tagline || plan.description}</p>

          <div className="mt-5 mb-6">
            <span className={`text-4xl font-bold ${isHighlight ? 'text-blue-700' : 'text-gray-900'}`}>
              ₹{Number(plan.price).toLocaleString()}
            </span>
            <span className="text-gray-500 text-sm"> / month</span>
            <p className="text-xs text-gray-500 mt-1">
              Unlock up to <strong>{quota}</strong> propert{quota === 1 ? 'y' : 'ies'} within 30 days
            </p>
          </div>

          <ul className="space-y-2.5 mb-6 flex-1">
            {(plan.features || []).map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 font-bold mt-0.5">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Hover preset="lift">
            <button
              onClick={onSubscribe}
              disabled={paying}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-shadow ${
                isHighlight
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {paying ? <Spinner size="sm" className="py-0" /> : `Subscribe · ₹${plan.price}`}
            </button>
          </Hover>
        </div>
      </Hover>
    </Stagger.Item>
  );
}
