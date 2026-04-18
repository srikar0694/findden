import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { propertiesService } from '../services/properties.service';
import { formatCurrency, formatRent } from '../utils/formatCurrency';
import { formatDate, timeAgo } from '../utils/formatDate';
import Spinner from '../components/shared/Spinner';

const TYPE_LABELS = {
  apartment: 'Apartment', house: 'House', villa: 'Villa',
  plot: 'Plot', commercial: 'Commercial', pg: 'PG',
};

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
        ← Back to listings
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left / Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image gallery */}
          <div className="rounded-xl overflow-hidden bg-gray-100">
            <img
              src={property.images[activeImg] || property.thumbnail}
              alt={property.title}
              className="w-full h-72 object-cover"
              onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'; }}
            />
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
            <button className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors mb-2">
              📞 Request Callback
            </button>
            <button className="w-full border border-blue-600 text-blue-600 py-2.5 rounded-lg font-medium hover:bg-blue-50 transition-colors">
              💬 Send Message
            </button>
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
    </div>
  );
}
