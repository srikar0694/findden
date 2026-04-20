import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useWishlistStore } from '../store/wishlistStore';
import { contactsService } from '../services/contacts.service';
import { runCheckout } from '../services/razorpay';
import { formatCurrency, formatRent } from '../utils/formatCurrency';
import Spinner from '../components/shared/Spinner';
import { FadeIn, SlideUp, Stagger, Hover } from '../components/motion';

/**
 * Wishlist Page
 * -------------
 *  - Lists every property the user has favourited.
 *  - For locked properties: lets them add to a bulk-unlock cart.
 *  - For wishlisted+cart items: select a plan and pay via Razorpay,
 *    or pay per-property using the single tier.
 *  - Purchased contacts are revealed inline.
 */
export default function WishlistPage() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const items = useWishlistStore((s) => s.items);
  const cart = useWishlistStore((s) => s.cart);
  const loading = useWishlistStore((s) => s.loading);
  const fetchWishlist = useWishlistStore((s) => s.fetch);
  const removeWishlist = useWishlistStore((s) => s.remove);
  const addToCart = useWishlistStore((s) => s.addToCart);
  const removeFromCart = useWishlistStore((s) => s.removeFromCart);
  const clearCart = useWishlistStore((s) => s.clearCart);

  const [entitlement, setEntitlement] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchWishlist();
    refreshEntitlement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const refreshEntitlement = () =>
    contactsService.getEntitlement().then((res) => setEntitlement(res.data)).catch(() => {});

  const flash = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const lockedItems = useMemo(() => items.filter((w) => !w.isContactUnlocked), [items]);
  const unlockedItems = useMemo(() => items.filter((w) => w.isContactUnlocked), [items]);

  const cartItems = useMemo(
    () => items.filter((w) => cart.includes(w.propertyId) && !w.isContactUnlocked),
    [items, cart]
  );

  /** Pick the best plan slug for the current cart size. */
  const recommendedPlan = useMemo(() => {
    const n = cartItems.length;
    if (n <= 1) return 'single';
    if (n <= 10) return 'cart';
    return 'premium';
  }, [cartItems]);

  const handleRemove = async (propertyId) => {
    setBusyId(propertyId);
    const r = await removeWishlist(propertyId);
    if (r?.success === false) flash('error', r.error || 'Could not remove');
    setBusyId(null);
  };

  const handleSingleUnlock = async (propertyId) => {
    setBusyId(propertyId);
    try {
      // Use a remaining subscription slot if we have one.
      await contactsService.unlock(propertyId);
      flash('success', 'Contact unlocked!');
    } catch (err) {
      if (err.status === 402 || err.code === 'PAYMENT_REQUIRED') {
        try {
          await runCheckout({ planSlug: 'single', propertyIds: [propertyId], user });
          flash('success', 'Payment successful — contact unlocked.');
        } catch (e2) {
          if (e2.code !== 'CANCELLED') flash('error', e2.message || 'Payment failed');
        }
      } else {
        flash('error', err.message || 'Could not unlock');
      }
    } finally {
      setBusyId(null);
      await fetchWishlist();
      await refreshEntitlement();
    }
  };

  const handleBulkCheckout = async (planSlug) => {
    if (cartItems.length === 0) return;
    setBulkBusy(true);
    try {
      const propertyIds = cartItems.map((w) => w.propertyId);
      // For 'single' tier with multiple items, fall back to per-item charge
      // (the backend already enforces that a single-tier order must contain
      // exactly 1 propertyId).
      if (planSlug === 'single') {
        for (const pid of propertyIds) {
          // eslint-disable-next-line no-await-in-loop
          await runCheckout({ planSlug: 'single', propertyIds: [pid], user });
        }
      } else {
        await runCheckout({ planSlug, propertyIds, user });
      }
      flash('success', `Unlocked ${propertyIds.length} ${propertyIds.length === 1 ? 'contact' : 'contacts'}.`);
      clearCart();
    } catch (err) {
      if (err.code !== 'CANCELLED') flash('error', err.message || 'Payment failed');
    } finally {
      setBulkBusy(false);
      await fetchWishlist();
      await refreshEntitlement();
    }
  };

  if (loading && items.length === 0) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <SlideUp className="mb-8" whileInView={false}>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-rose-500">♥</span> My Wishlist
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Save properties you like, and unlock owner contacts in one shot.
        </p>
      </SlideUp>

      {/* Toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            className={`fixed top-20 right-6 z-40 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {feedback.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entitlement banner */}
      {entitlement?.subscription?.status === 'active' && (
        <FadeIn className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-6 flex justify-between items-center">
          <div>
            <div className="text-sm font-semibold text-emerald-800">
              {entitlement.subscription.planName || 'Active subscription'}
            </div>
            <div className="text-xs text-emerald-700 mt-0.5">
              {entitlement.unlocksRemaining} unlocks remaining this month
              {entitlement.subscription.endDate && ` · renews ${new Date(entitlement.subscription.endDate).toLocaleDateString()}`}
            </div>
          </div>
          <Link to="/pricing" className="text-xs text-emerald-700 hover:underline font-medium">
            Manage plan →
          </Link>
        </FadeIn>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <FadeIn className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-3">🏠</div>
          <h2 className="text-lg font-semibold text-gray-900">Your wishlist is empty</h2>
          <p className="text-sm text-gray-500 mt-1.5 mb-5">
            Browse listings and tap the ♡ to save them here for later.
          </p>
          <Link
            to="/search"
            className="inline-block bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Browse Properties
          </Link>
        </FadeIn>
      )}

      {/* Bulk-unlock cart strip */}
      {cartItems.length > 0 && (
        <FadeIn className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Unlock cart ({cartItems.length})
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Recommended:{' '}
                <span className="font-semibold capitalize">{recommendedPlan}</span> plan
                {recommendedPlan === 'cart' && ' — ₹20/property/month, max 10'}
                {recommendedPlan === 'premium' && ' — ₹500/month, max 30'}
                {recommendedPlan === 'single' && ' — ₹40 one-time'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBulkCheckout(recommendedPlan)}
                disabled={bulkBusy}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm disabled:opacity-60"
              >
                {bulkBusy ? <Spinner size="sm" className="py-0" /> : `Unlock all · ${recommendedPlan}`}
              </button>
              <button
                onClick={clearCart}
                disabled={bulkBusy}
                className="text-xs text-amber-700 hover:underline px-2"
              >
                Clear cart
              </button>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Locked section */}
      {lockedItems.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Locked ({lockedItems.length})
          </h2>
          <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-4" stagger={0.05}>
            {lockedItems.map((w) => (
              <Stagger.Item key={w.id}>
                <WishlistRow
                  w={w}
                  inCart={cart.includes(w.propertyId)}
                  busy={busyId === w.propertyId}
                  onAddCart={() => addToCart(w.propertyId)}
                  onRemoveCart={() => removeFromCart(w.propertyId)}
                  onUnlock={() => handleSingleUnlock(w.propertyId)}
                  onRemove={() => handleRemove(w.propertyId)}
                />
              </Stagger.Item>
            ))}
          </Stagger>
        </section>
      )}

      {/* Unlocked section */}
      {unlockedItems.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Unlocked ({unlockedItems.length})
          </h2>
          <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-4" stagger={0.05}>
            {unlockedItems.map((w) => (
              <Stagger.Item key={w.id}>
                <UnlockedRow
                  w={w}
                  busy={busyId === w.propertyId}
                  onRemove={() => handleRemove(w.propertyId)}
                />
              </Stagger.Item>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  );
}

// ---- Sub-components ----------------------------------------------------------

function WishlistRow({ w, inCart, busy, onAddCart, onRemoveCart, onUnlock, onRemove }) {
  const p = w.property || {};
  const priceStr = p.listingType === 'rent' ? formatRent(p.price) : formatCurrency(p.price);

  return (
    <Hover preset="card">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex">
        <Link to={`/property/${p.id}`} className="w-32 h-32 bg-gray-100 shrink-0">
          <img
            src={p.thumbnail || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200'}
            alt={p.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200'; }}
          />
        </Link>

        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
          <div>
            <Link to={`/property/${p.id}`} className="block">
              <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 hover:text-blue-700">
                {p.title}
              </h3>
            </Link>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
              📍 {p.city}, {p.state}
            </p>
            <p className="text-sm font-bold text-blue-700 mt-1">{priceStr}</p>
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <button
              onClick={onUnlock}
              disabled={busy}
              className="flex-1 min-w-[100px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-md disabled:opacity-60"
            >
              {busy ? '…' : '🔓 Unlock'}
            </button>
            {inCart ? (
              <button
                onClick={onRemoveCart}
                className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-amber-100 text-amber-700"
              >
                ✓ In Cart
              </button>
            ) : (
              <button
                onClick={onAddCart}
                className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100"
              >
                + Cart
              </button>
            )}
            <button
              onClick={onRemove}
              disabled={busy}
              title="Remove from wishlist"
              className="text-xs font-medium px-2 py-1.5 rounded-md text-rose-600 hover:bg-rose-50"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </Hover>
  );
}

function UnlockedRow({ w, busy, onRemove }) {
  const p = w.property || {};
  const priceStr = p.listingType === 'rent' ? formatRent(p.price) : formatCurrency(p.price);

  return (
    <Hover preset="card">
      <div className="bg-emerald-50/40 rounded-xl border border-emerald-200 overflow-hidden flex">
        <Link to={`/property/${p.id}`} className="w-32 h-32 bg-gray-100 shrink-0">
          <img
            src={p.thumbnail || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200'}
            alt={p.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200'; }}
          />
        </Link>

        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <Link to={`/property/${p.id}`} className="block flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 hover:text-blue-700">
                  {p.title}
                </h3>
              </Link>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                ✓ Unlocked
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">📍 {p.city}, {p.state}</p>
            <p className="text-sm font-bold text-blue-700 mt-1">{priceStr}</p>
          </div>

          <div className="flex items-center justify-between mt-2">
            <Link
              to={`/property/${p.id}`}
              className="text-xs text-emerald-700 hover:underline font-medium"
            >
              View contact details →
            </Link>
            <button
              onClick={onRemove}
              disabled={busy}
              title="Remove from wishlist"
              className="text-xs px-2 py-1 rounded-md text-rose-600 hover:bg-rose-50"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </Hover>
  );
}
