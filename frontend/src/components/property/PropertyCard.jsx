import { Link } from 'react-router-dom';
import { formatCurrency, formatRent } from '../../utils/formatCurrency';
import { timeAgo } from '../../utils/formatDate';

const TYPE_LABELS = {
  apartment: 'Apartment', house: 'House', villa: 'Villa',
  plot: 'Plot', commercial: 'Commercial', pg: 'PG',
};

const FURNISHING_LABELS = { furnished: 'Furnished', semi: 'Semi-Furnished', unfurnished: 'Unfurnished' };

export default function PropertyCard({ property, isSelected, onClick }) {
  const {
    id, title, propertyType, listingType, price, bedrooms, bathrooms,
    areaSqft, furnishing, city, state, addressLine, thumbnail, images,
    createdAt, viewsCount,
  } = property;

  const img = thumbnail || images?.[0] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400';
  const priceStr = listingType === 'rent' ? formatRent(price) : formatCurrency(price);

  return (
    <Link
      to={`/property/${id}`}
      onClick={onClick}
      className={`block bg-white rounded-xl overflow-hidden border transition-all duration-200 hover:shadow-md ${
        isSelected ? 'border-blue-500 shadow-md ring-2 ring-blue-200' : 'border-gray-200'
      }`}
    >
      {/* Image */}
      <div className="relative h-44 bg-gray-100 overflow-hidden">
        <img
          src={img}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400'; }}
        />
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            listingType === 'sale' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
          }`}>
            For {listingType === 'sale' ? 'Sale' : 'Rent'}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white text-gray-700 shadow-sm">
            {TYPE_LABELS[propertyType] || propertyType}
          </span>
        </div>
        {viewsCount > 100 && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            👁 {viewsCount}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">{title}</h3>
          <span className="text-blue-700 font-bold text-sm whitespace-nowrap">{priceStr}</span>
        </div>

        {/* Stats */}
        {(bedrooms != null || areaSqft != null) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {bedrooms != null && <span>🛏 {bedrooms} BHK</span>}
            {bathrooms != null && <span>🚿 {bathrooms}</span>}
            {areaSqft && <span>📐 {areaSqft.toLocaleString()} sqft</span>}
            {furnishing && <span className="text-gray-400">· {FURNISHING_LABELS[furnishing]}</span>}
          </div>
        )}

        {/* Location */}
        <p className="text-xs text-gray-500 mt-1.5 truncate">
          📍 {addressLine}, {city}, {state}
        </p>

        {/* Footer */}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-400">{timeAgo(createdAt)}</span>
          <span className="text-xs font-medium text-blue-600">View Details →</span>
        </div>
      </div>
    </Link>
  );
}
