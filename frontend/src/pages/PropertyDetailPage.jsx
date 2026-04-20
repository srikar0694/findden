import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { propertiesService } from '../services/properties.service';
import { contactsService } from '../services/contacts.service';
import { notificationsService } from '../services/notifications.service';
import { formatCurrency, formatRent } from '../utils/formatCurrency';
import { formatDate, timeAgo } from '../utils/formatDate';
import Spinner from '../components/shared/Spinner';
import { useAuthStore } from '../store/authStore';
import { useWishlistStore } from '../store/wishlistStore';
import { runCheckout } from '../services/razorpay';

const TYPE_LABELS = {
  apartment: 'Apartment', house: 'House', villa: 'Villa',
  plot: 'Plot', commercial: 'Commercial', pg: 'PG',
};

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const wishlistIds = useWishlistStore((s) => s.ids);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const addToCart = useWishlistStore((s) => s.addToCart);
  const cart = useWishlistStore((s) => s.cart);

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);

  // Modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Inline action feedback
  const [calling, setCalling] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [feedback, setFeedback] = useState(null); // {type:'success'|'error', text}

  const refresh = () => propertiesService.getById(id).then((res) => setProperty(res.data));

  useEffect(() => {
    setLoading(true);
    propertiesService.getById(id)
      .then((res) => setProperty(res.data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div className="flex justify-center items-center h-96"><Spinner size="lg" /></div>;
  if (!property) return null;

  const priceStr = property.listingType === 'rent'
    ? formatRent(property.price)
    : formatCurrency(property.price);

  const isWishlisted = wishlistIds.has(id) || property.isWishlisted;
  const isInCart = cart.includes(id);
  const isUnlocked = property.isContactUnlocked;
  const isOwner = property.isOwner;

  const flash = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const requireAuth = () => {
    if (!token) {
      navigate('/login');
      return false;
    }
    return true;
  };

  const handleToggleWishlist = async () => {
    if (!requireAuth()) return;
    const result = await toggleWishlist(id);
    if (result?.success === false) flash('error', result.error || 'Wishlist update failed');
    refresh();
  };

  const handleRequestCallback = async () => {
    if (!requireAuth()) return;
    setCalling(true);
    try {
      const res = await notificationsService.requestCallback(id);
      const ch = res.data?.channels || [];
      const list = ch.length ? ch.map((c) => c.toUpperCase()).join(' + ') : 'no available channel';
      flash('success', `Callback request sent to the owner via ${list}.`);
    } catch (err) {
      flash('error', err.message || 'Could not send callback request');
    } finally {
      setCalling(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    setSendingMessage(true);
    try {
      const res = await notificationsService.sendMessage(id, messageText.trim());
      const ch = res.data?.channels || [];
      const list = ch.length ? ch.map((c) => c.toUpperCase()).join(' + ') : 'no available channel';
      flash('success', `Message sent to the owner via ${list}.`);
      setShowMessageModal(false);
      setMessageText('');
    } catch (err) {
      flash('error', err.message || 'Could not send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUnlockContact = async () => {
    if (!requireAuth()) return;
    setUnlocking(true);
    try {
      // Try to use a subscription slot first.
      await contactsService.unlock(id);
      flash('success', 'Contact unlocked!');
      await refresh();
    } catch (err) {
      // 402 => no subscription / no slots. Send through Razorpay single purchase.
      if (err.status === 402 || err.code === 'PAYMENT_REQUIRED') {
        try {
          await runCheckout({ planSlug: 'single', propertyIds: [id], user });
          flash('success', 'Payment successful — contact unlocked.');
          await refresh();
        } catch (e2) {
          if (e2.code !== 'CANCELLED') flash('error', e2.message || 'Payment failed');
        }
      } else {
        flash('error', err.message || 'Could not unlock contact');
      }
    } finally {
      setUnlocking(false);
    }
  };

  const handleAddToCart = () => {
    if (!requireAuth()) return;
    addToCart(id);
    flash('success', 'Added to unlock-cart. Visit your wishlist to checkout in bulk.');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
        ← Back to listings
      </button>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left / Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image gallery */}
          <div className="rounded-xl overflow-hidden bg-gray-100 relative">
            <img
              src={property.images[activeImg] || property.thumbnail}
              alt={property.title}
              className="w-full h-72 object-cover"
              onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'; }}
            />

            {/* Wishlist heart on the gallery */}
            {!isOwner && (
              <button
                type="button"
                onClick={handleToggleWishlist}
                className="absolute top-3 right-3 bg-white/90 backdrop-blur w-11 h-11 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all"
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isWishlisted ? 'filled' : 'empty'}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`text-xl leading-none ${isWishlisted ? 'text-rose-500' : 'text-gray-500'}`}
                  >
                    {isWishlisted ? '♥' : '♡'}
                  </motion.span>
                </AnimatePresence>
              </button>
            )}

            {property.images.length > 1 && (
              <div className="flex gap-2 p-2">
                {property.images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    onClick={() => setActiveImg(i)}
                    className={`h-16 w-20 object-cover rounded cursor-pointer border-2 transition-all ${
                      i === activeImg ? 'border-blue-500' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Title & Price */}
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                property.listingType === 'sale' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}>
                For {property.listingType === 'sale' ? 'Sale' : 'Rent'}
              </span>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {TYPE_LABELS[property.propertyType]}
              </span>
              {isWishlisted && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-rose-50 text-rose-600">
                  ♥ In wishlist
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{property.title}</h1>
            <p className="text-3xl font-bold text-blue-700 mt-1">{priceStr}</p>
            {property.priceNegotiable && (
              <span className="text-xs text-green-600 font-medium">✓ Price negotiable</span>
            )}
          </div>

          {/* Key Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {property.bedrooms != null && (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl">🛏</div>
                <div className="text-sm font-semibold mt-1">{property.bedrooms} Bedroom{property.bedrooms !== 1 ? 's' : ''}</div>
              </div>
            )}
            {property.bathrooms != null && (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl">🚿</div>
                <div className="text-sm font-semibold mt-1">{property.bathrooms} Bathroom{property.bathrooms !== 1 ? 's' : ''}</div>
              </div>
            )}
            {property.areaSqft && (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl">📐</div>
                <div className="text-sm font-semibold mt-1">{property.areaSqft.toLocaleString()} sqft</div>
              </div>
            )}
            {property.furnishing && (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl">🪑</div>
                <div className="text-sm font-semibold mt-1 capitalize">{property.furnishing}</div>
              </div>
            )}
            {property.floor != null && (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl">🏢</div>
                <div className="text-sm font-semibold mt-1">Floor {property.floor} / {property.totalFloors}</div>
              </div>
            )}
          </div>

          {/* Description */}
          {property.description && (
            <div>
              <h2 className="text-lg font-semibold mb-2">About this property</h2>
              <p className="text-gray-600 text-sm leading-relaxed">{property.description}</p>
            </div>
          )}

          {/* Amenities */}
          {property.amenities?.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((a) => (
                  <span key={a} className="bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full capitalize">
                    {a.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Contact card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Contact Agent</h3>

            {/* Contact reveal area */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm space-y-1">
              {property.contact?.name && (
                <div className="flex justify-between text-gray-700">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium">{property.contact.name}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700">
                <span className="text-gray-500">Phone</span>
                <span className={`font-medium ${isUnlocked ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {property.contact?.phone || '—'}
                </span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span className="text-gray-500">Email</span>
                <span className={`font-medium ${isUnlocked ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {property.contact?.email || '—'}
                </span>
              </div>
              {!isUnlocked && !isOwner && (
                <p className="text-[11px] text-gray-500 pt-1.5 italic">
                  Contact details are masked. Unlock to reveal.
                </p>
              )}
            </div>

            {/* Action buttons */}
            {isOwner ? (
              <div className="text-xs text-gray-500 italic">You own this listing.</div>
            ) : (
              <>
                {!isUnlocked && (
                  <button
                    onClick={handleUnlockContact}
                    disabled={unlocking}
                    className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors mb-2 disabled:opacity-60"
                  >
                    {unlocking ? <Spinner size="sm" className="py-0" /> : '🔓 Unlock Contact (₹40)'}
                  </button>
                )}

                <button
                  onClick={handleRequestCallback}
                  disabled={calling}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors mb-2 disabled:opacity-60"
                >
                  {calling ? <Spinner size="sm" className="py-0" /> : '📞 Request Callback'}
                </button>

                <button
                  onClick={() => requireAuth() && setShowMessageModal(true)}
                  className="w-full border border-blue-600 text-blue-600 py-2.5 rounded-lg font-medium hover:bg-blue-50 transition-colors mb-2"
                >
                  💬 Send Message
                </button>

                {/* Wishlist controls */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={handleToggleWishlist}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                      isWishlisted
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {isWishlisted ? '♥ Wishlisted' : '♡ Wishlist'}
                  </button>
                  {!isUnlocked && (
                    <button
                      onClick={handleAddToCart}
                      disabled={isInCart}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        isInCart
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      {isInCart ? '✓ In Cart' : '+ Unlock Cart'}
                    </button>
                  )}
                </div>

                {cart.length > 0 && (
                  <Link
                    to="/wishlist"
                    className="block text-center mt-3 text-xs text-blue-600 font-medium hover:underline"
                  >
                    Review unlock cart ({cart.length}) →
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Property info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">Property Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Location</span>
                <span className="text-gray-900 text-right ml-2 font-medium">{property.city}, {property.state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pincode</span>
                <span className="text-gray-900 font-medium">{property.pincode}</span>
              </div>
              {property.availableFrom && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Available From</span>
                  <span className="text-gray-900 font-medium">{formatDate(property.availableFrom)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Posted</span>
                <span className="text-gray-900 font-medium">{timeAgo(property.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Views</span>
                <span className="text-gray-900 font-medium">{property.viewsCount?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 text-sm mb-2">Location</h3>
            <p className="text-xs text-gray-600 mb-2">📍 {property.addressLine}, {property.city}</p>
            <a
              href={`https://www.google.com/maps?q=${property.latitude},${property.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Open in Google Maps →
            </a>
          </div>
        </div>
      </div>

      {/* Send Message Modal */}
      <AnimatePresence>
        {showMessageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !sendingMessage && setShowMessageModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Send a message</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    The owner will receive this {(user?.email && user?.phone) ? 'via Email + SMS' : user?.email ? 'via Email' : user?.phone ? 'via SMS' : 'via available channels'}.
                  </p>
                </div>
                <button
                  onClick={() => !sendingMessage && setShowMessageModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={`Hi, I'm interested in ${property.title}. Could you share more details about availability and visit timings?`}
                rows={5}
                maxLength={2000}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1">
                <span>The owner will see your name, email and phone.</span>
                <span>{messageText.length}/2000</span>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowMessageModal(false)}
                  disabled={sendingMessage}
                  className="px-4 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !messageText.trim()}
                  className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {sendingMessage ? <Spinner size="sm" className="py-0" /> : 'Send'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
