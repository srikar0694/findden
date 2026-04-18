import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { propertiesService } from '../services/properties.service';
import Spinner from '../components/shared/Spinner';

const PROPERTY_TYPES = ['apartment', 'house', 'villa', 'plot', 'commercial', 'pg'];
const LISTING_TYPES = ['sale', 'rent'];
const FURNISHING_TYPES = ['unfurnished', 'semi', 'furnished'];

const AMENITY_OPTIONS = [
  'parking', 'gym', 'pool', 'garden', 'lift', 'security',
  'power_backup', 'wifi', 'ac', 'clubhouse', 'playground',
];

export default function PostPropertyPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    property_type: 'apartment',
    listing_type: 'rent',
    price: '',
    price_negotiable: false,
    bedrooms: '',
    bathrooms: '',
    area_sqft: '',
    furnishing: 'unfurnished',
    floor: '',
    total_floors: '',
    address_line: '',
    city: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    amenities: [],
    available_from: '',
    images: [],
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleAmenity = (amenity) => {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(amenity)
        ? f.amenities.filter((a) => a !== amenity)
        : [...f.amenities, amenity],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        bedrooms: form.bedrooms ? parseInt(form.bedrooms, 10) : undefined,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms, 10) : undefined,
        area_sqft: form.area_sqft ? parseFloat(form.area_sqft) : undefined,
        floor: form.floor ? parseInt(form.floor, 10) : undefined,
        total_floors: form.total_floors ? parseInt(form.total_floors, 10) : undefined,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        images: form.images.filter(Boolean),
      };
      await propertiesService.create(payload);
      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'PAYMENT_REQUIRED') {
        setError('You need an active subscription or pay-per-listing to post. Please visit Pricing.');
      } else {
        setError(err.message || 'Failed to post property. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Post Your Property</h1>
      <p className="text-gray-500 text-sm mb-8">Fill in the details to list your property on FindDen.</p>

      {/* Step indicators */}
      <div className="flex gap-2 mb-8">
        {['Basic Info', 'Location', 'Details'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium ${step === i + 1 ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
            {i < 2 && <div className="w-8 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6 text-sm text-red-700">
          {error}
          {error.includes('subscription') && (
            <button onClick={() => navigate('/pricing')} className="ml-2 text-blue-600 underline">View Plans</button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <select value={form.property_type} onChange={(e) => set('property_type', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize">
                  {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listing Type</label>
                <select value={form.listing_type} onChange={(e) => set('listing_type', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize">
                  {LISTING_TYPES.map((t) => <option key={t} value={t}>For {t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Spacious 2BHK Apartment in Koramangala" required minLength={5}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                placeholder="Describe the property — key features, nearby landmarks, society name…"
                rows={4} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price ({form.listing_type === 'rent' ? '₹/month' : '₹ total'}) *
                </label>
                <input type="number" value={form.price} onChange={(e) => set('price', e.target.value)}
                  placeholder="e.g. 28000" required min={0}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.price_negotiable} onChange={(e) => set('price_negotiable', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Price Negotiable</span>
                </label>
              </div>
            </div>

            <button type="button" onClick={() => setStep(2)}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors">
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
              <input type="text" value={form.address_line} onChange={(e) => set('address_line', e.target.value)}
                placeholder="Block, society, landmark" required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)}
                  placeholder="Bangalore" required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <input type="text" value={form.state} onChange={(e) => set('state', e.target.value)}
                  placeholder="Karnataka" required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
              <input type="text" value={form.pincode} onChange={(e) => set('pincode', e.target.value)}
                placeholder="560034" required pattern="[0-9]{5,10}"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude *</label>
                <input type="number" value={form.latitude} onChange={(e) => set('latitude', e.target.value)}
                  placeholder="12.9352" required step="any"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude *</label>
                <input type="number" value={form.longitude} onChange={(e) => set('longitude', e.target.value)}
                  placeholder="77.6245" required step="any"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <p className="text-xs text-gray-400">💡 Tip: Find lat/lng from Google Maps (right-click → "What's here?")</p>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button type="button" onClick={() => setStep(3)}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Property Details */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                <input type="number" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)}
                  placeholder="2" min={0}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
                <input type="number" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)}
                  placeholder="2" min={0}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area (sqft)</label>
                <input type="number" value={form.area_sqft} onChange={(e) => set('area_sqft', e.target.value)}
                  placeholder="1050" min={0}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Furnishing</label>
                <select value={form.furnishing} onChange={(e) => set('furnishing', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize">
                  {FURNISHING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Available From</label>
                <input type="date" value={form.available_from} onChange={(e) => set('available_from', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
              <div className="flex flex-wrap gap-2">
                {AMENITY_OPTIONS.map((a) => (
                  <button key={a} type="button" onClick={() => toggleAmenity(a)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all capitalize ${
                      form.amenities.includes(a) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'
                    }`}>
                    {a.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-60">
                {submitting ? <Spinner size="sm" className="py-0" /> : '🚀 Post Property'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
