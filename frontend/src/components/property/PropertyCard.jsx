import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatRent } from '../../utils/formatCurrency';
import { timeAgo } from '../../utils/formatDate';
import { cardHover } from '../motion/variants';
import { useAuthStore } from '../../store/authStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { resolveImageUrl } from './ImageUploader';

const TYPE_LABELS = {
  apartment: 'Apartment', house: 'House', villa: 'Villa',
  plot: 'Plot', commercial: 'Commercial', pg: 'PG',
};

const FURNISHING_LABELS = { furnished: 'Furnished', semi: 'Semi-Furnished', unfurnished: 'Unfurnished' };

const TRANSIT_ICONS = { metro: '🚇', bus: '🚌', train: '🚆', airport: '✈️' };

export default function PropertyCard({ property, isSelected, onClick }) {
  const {
    id, title, propertyType, listingType, price, bedrooms, bathrooms,
    areaSqft, furnishing, city, state, addressLine, thumbnail, images,
    createdAt, viewsCount, status, nearestTransit, verified, isQuickPost,
  } = property;

  const { token } = useAuthStore();
  const navigate = useNavigate();
  const wishlistIds = useWishlistStore((s) => s.ids);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const isWishlisted = wishlistIds.has(id) || property.isWishlisted;

  const img = resolveImageUrl(thumbnail || images?.[0]) || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400';
  const priceStr = listingType === 'rent' ? formatRent(price) : formatCurrency(price);
  const isSold = status === 'sold' || status === 'rented';
  const topTransit = Array.isArray(nearestTransit) && nearestTransit.length
    ? [...nearestTransit].sort((a, b) => a.distanceKm - b.distanceKm)[0]
    : null;

  const handleHeartClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      navigate('/login');
      return;
    }
    await toggleWishlist(id);
  };

  return (
    <motion.div
      variants={cardHover}
      initial="rest"
      whileHover={isSold ? undefined : 'hover'}
      whileTap={isSold ? undefined : 'tap'}
      animate="rest"
      className="rounded-xl relative"
    >
      <Link
        to={`/property/${id}`}
        onClick={onClick}
        className={`block bg-white rounded-xl overflow-hidden border transition-colors duration-200 ${
          isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
        } ${isSold ? 'opacity-80' : ''}`}
      >
        {/* Image */}
        <div className="relative h-44 bg-gray-100 overflow-hidden">
          <img
            src={img}
            alt={title}
            className={`w-full h-full object-cover ${isSold ? 'grayscale-[40%]' : ''}`}
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400'; }}
          />
          <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap max-w-[calc(100%-3.5rem)]">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              listingType === 'sale' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              For {listingType === 'sale' ? 'Sale' : 'Rent'}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white text-gray-700 shadow-sm">
              {TYPE_LABELS[propertyType] || propertyType}
            </span>
            {isQuickPost && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">
                ⚡ Quick
              </span>
            )}
          </div>

          {/* Wishlist heart */}
          <button
            type="button"
            onClick={handleHeartClick}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className="absolute top-2 right-2 bg-white/90 backdrop-blur w-9 h-9 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-all"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isWishlisted ? 'filled' : 'empty'}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={`text-lg leading-none ${isWishlisted ? 'text-rose-500' : 'text-gray-400'}`}
              >
                {isWishlisted ? '♥' : '♡'}
              </motion.span>
            </AnimatePresence>
          </button>

          {/* Sold-out ribbon */}
          {isSold && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-red-600 text-white font-bold uppercase text-sm tracking-widest px-6 py-1.5 rounded-md -rotate-6 shadow-lg">
                Sold Out
              </div>
            </div>
          )}

          {viewsCount > 100 && !isSold && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
              👁 {viewsCount}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1 flex items-start gap-1">
              <span className="line-clamp-2">{title}</span>
              {verified && (
                <span
                  title="Verified by FindDen"
                  aria-label="Verified property"
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold leading-none shrink-0 mt-0.5"
                >
                  ✓
                </span>
              )}
            </h3>
            <span className="text-blue-700 font-bold text-sm whitespace-nowrap">{priceStr}</span>
          </div>

          {(bedrooms != null || areaSqft != null) && (
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {bedrooms != null && <span>🛏 {bedrooms} BHK</span>}
              {bathrooms != null && <span>🚿 {bathrooms}</span>}
              {areaSqft && <span>📐 {areaSqft.toLocaleString()} sqft</span>}
              {furnishing && <span className="text-gray-400">· {FURNISHING_LABELS[furnishing]}</span>}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-1.5 truncate">
            📍 {addressLine}, {city}, {state}
          </p>

          {/* Nearest public transport */}
          {topTransit && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md w-fit">
              <span>{TRANSIT_ICONS[topTransit.type] || '🚏'}</span>
              <span className="font-medium">{topTransit.name}</span>
              <span className="text-emerald-600">· {topTransit.distanceKm.toFixed(1)} km</span>
            </div>
          )}

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">{timeAgo(createdAt)}</span>
            <span className="text-xs font-medium text-blue-600">View Details →</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
