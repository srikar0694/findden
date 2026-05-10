import { resolveImageUrl } from './ImageUploader';

/**
 * PropertyPreview (CR §1.2.1 / §2.2)
 * -----------------------------------
 * Compact, live-updating preview of the form values as the user fills out
 * the post-property pages. Mirrors the look of `PropertyCard` so what the
 * user sees here is what their listing will look like in search.
 *
 * @param {object} form  The current form state (snake_case keys, as built
 *                       by the post pages).
 */
export default function PropertyPreview({ form = {}, compact = false }) {
  const {
    title, description, property_type, listing_type,
    price, price_negotiable, bedrooms, bathrooms, area_sqft,
    furnishing, address_line, country, city, state, pincode,
    images = [],
    contact_name, contact_phone, contact_email,
    bhk, owner_name,
  } = form;

  const priceLabel = price
    ? `₹${Number(price).toLocaleString()}${listing_type === 'rent' ? ' / mo' : ''}`
    : '—';

  const cover = images && images[0] ? resolveImageUrl(images[0]) : null;
  const beds = bhk || bedrooms;
  const locationStr = [city, state, country].filter(Boolean).join(', ');

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 text-xs font-semibold text-blue-700 uppercase tracking-wide">
        Live preview
      </div>

      {cover ? (
        <img src={cover} alt="" className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400 text-sm">
          No photo yet
        </div>
      )}

      <div className="p-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {listing_type && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              listing_type === 'sale' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>For {listing_type}</span>
          )}
          {property_type && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
              {property_type}
            </span>
          )}
          {furnishing && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 capitalize">
              {furnishing}
            </span>
          )}
        </div>

        <h3 className="text-base font-semibold text-gray-900 line-clamp-2">
          {title || 'Your listing title will show here'}
        </h3>

        <p className="text-lg font-bold text-blue-700">
          {priceLabel}
          {price_negotiable && <span className="text-xs text-gray-500 font-normal ml-1">· Negotiable</span>}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
          {beds && <span>🛏 {beds} BHK</span>}
          {bathrooms && <span>🛁 {bathrooms} bath</span>}
          {area_sqft && <span>📐 {area_sqft} sqft</span>}
        </div>

        <p className="text-xs text-gray-500 line-clamp-2">
          📍 {address_line || locationStr || 'Location will appear once you drop a pin'}
        </p>
        {locationStr && address_line && (
          <p className="text-[11px] text-gray-400">{locationStr}{pincode ? ` · ${pincode}` : ''}</p>
        )}

        {!compact && description && (
          <p className="text-xs text-gray-600 line-clamp-3 pt-1 border-t border-gray-100">
            {description}
          </p>
        )}

        {(contact_name || owner_name || contact_phone || contact_email) && (
          <div className="pt-2 border-t border-gray-100 text-xs text-gray-500">
            <p className="font-medium text-gray-700">{contact_name || owner_name || 'Owner'}</p>
            {contact_phone && <p>📞 {contact_phone}</p>}
            {contact_email && <p>✉️ {contact_email}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
