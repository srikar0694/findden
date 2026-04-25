import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { propertiesService } from '../services/properties.service';
import { useAuthStore } from '../store/authStore';
import LocationPicker from '../components/map/LocationPicker';
import Spinner from '../components/shared/Spinner';

/**
 * QuickPostPage
 * -------------
 * Implements CR §2 (Quick Property Post).
 *
 * Field order (per the change request):
 *   1. Owner Name           — pre-populated from profile, editable
 *   2. Location pin (map)   — current-location prompt, draggable marker
 *   3. Phone                — mandatory; pre-populated, editable
 *   4. Price                — mandatory
 *   5. Property Type        — apartment / house / villa / plot / commercial / pg
 *   6. BHK                  — only when property type is "house" (or apartment / villa)
 *
 * Submits to POST /properties/quick which sets `is_quick_post = true` so the
 * property can be filtered into the dedicated Quick listings view.
 */

const PROPERTY_TYPES = ['apartment', 'house', 'villa', 'plot', 'commercial', 'pg'];
const BHK_REQUIRED_TYPES = ['apartment', 'house', 'villa'];
const BHK_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function QuickPostPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    owner_name: '',
    contact_phone: '',
    contact_email: '',
    price: '',
    property_type: 'apartment',
    bhk: '',
    listing_type: 'rent',
    latitude: '',
    longitude: '',
    address_line: '',
    city: '',
    state: '',
    pincode: '',
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const setMany = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Pre-populate from profile on mount (CR §2.4 + §2.2 + §2.3).
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      owner_name:    f.owner_name    || user.name  || '',
      contact_phone: f.contact_phone || user.phone || '',
      contact_email: f.contact_email || user.email || '',
    }));
  }, [user]);

  const requiresBhk = BHK_REQUIRED_TYPES.includes(form.property_type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      navigate('/login');
      return;
    }
    setError('');

    // Hard guards (the form already enforces these via `required`, but be safe).
    if (!form.owner_name.trim())     return setError('Owner name is required.');
    if (!form.contact_phone.trim())  return setError('Phone is required for a quick post.');
    if (!form.latitude || !form.longitude) {
      return setError('Please drop a pin on the map for your property.');
    }
    if (!form.price)                 return setError('Price is required.');
    if (requiresBhk && !form.bhk)    return setError('BHK is required for this property type.');

    setSubmitting(true);
    try {
      const payload = {
        owner_name: form.owner_name.trim(),
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim() || undefined,
        price: parseFloat(form.price),
        property_type: form.property_type,
        listing_type: form.listing_type,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        address_line: form.address_line || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
        bhk: requiresBhk && form.bhk ? parseInt(form.bhk, 10) : undefined,
      };
      const res = await propertiesService.quickCreate(payload);
      const newId = res?.data?.id;
      navigate(newId ? `/property/${newId}` : '/search?quick=1');
    } catch (err) {
      if (err.code === 'PAYMENT_REQUIRED') {
        setError('You need an active subscription or pay-per-listing to post. Please visit Pricing.');
      } else {
        setError(err.message || 'Could not post property. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const locationValue = {
    latitude: form.latitude,
    longitude: form.longitude,
    address_line: form.address_line,
    city: form.city,
    state: form.state,
    pincode: form.pincode,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">⚡</span>
        <h1 className="text-2xl font-bold text-gray-900">Quick Property Post</h1>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Just the essentials — you can complete the rest later.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6 text-sm text-red-700">
          {error}
          {error.includes('subscription') && (
            <button
              type="button"
              onClick={() => navigate('/pricing')}
              className="ml-2 text-blue-600 underline"
            >
              View Plans
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Owner Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
          <input
            type="text"
            value={form.owner_name}
            onChange={(e) => set('owner_name', e.target.value)}
            placeholder="Full name"
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Pre-filled from your profile · editable
          </p>
        </div>

        {/* 2. Location pin */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location Pin *</label>
          <p className="text-xs text-gray-500 mb-2">
            Allow location access to drop the pin automatically, then drag to refine.
          </p>
          <LocationPicker
            value={locationValue}
            onChange={(v) =>
              setMany({
                latitude:     v.latitude     ?? form.latitude,
                longitude:    v.longitude    ?? form.longitude,
                address_line: v.address_line ?? form.address_line,
                city:         v.city         ?? form.city,
                state:        v.state        ?? form.state,
                pincode:      v.pincode      ?? form.pincode,
              })
            }
          />
        </div>

        {/* 3. Phone (mandatory) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
          <input
            type="tel"
            value={form.contact_phone}
            onChange={(e) => set('contact_phone', e.target.value)}
            placeholder="9876543210"
            required
            pattern="[0-9+\-\s]{7,20}"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {!user?.phone && (
            <p className="mt-1 text-[11px] text-amber-600">
              We need a phone number for buyers to reach you. We'll save this to your profile.
            </p>
          )}
        </div>

        {/* 4. Price */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price ({form.listing_type === 'rent' ? '₹/month' : '₹ total'}) *
            </label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              placeholder="e.g. 28000"
              required
              min={0}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">For</label>
            <select
              value={form.listing_type}
              onChange={(e) => set('listing_type', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize"
            >
              <option value="rent">Rent</option>
              <option value="sale">Sale</option>
            </select>
          </div>
        </div>

        {/* 5. Property Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property Type *</label>
          <select
            value={form.property_type}
            onChange={(e) => set('property_type', e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize"
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* 6. BHK — only for house-like types */}
        {requiresBhk && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">BHK *</label>
            <div className="flex flex-wrap gap-2">
              {BHK_OPTIONS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => set('bhk', String(b))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    String(form.bhk) === String(b)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600 hover:border-blue-400'
                  }`}
                >
                  {b} BHK
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Optional email */}
        <details className="group">
          <summary className="cursor-pointer text-xs text-blue-600 hover:underline list-none">
            <span className="group-open:hidden">+ Add email (optional)</span>
            <span className="hidden group-open:inline">− Hide email</span>
          </summary>
          <div className="mt-2">
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </details>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white py-2.5 rounded-lg font-semibold text-sm transition-colors"
        >
          {submitting ? <Spinner size="sm" className="py-0" /> : '⚡ Quick Post'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-2">
          Want to add photos, amenities, area &amp; more details?{' '}
          <button
            type="button"
            onClick={() => navigate('/post-property')}
            className="text-blue-600 hover:underline"
          >
            Use the full post flow →
          </button>
        </p>
      </form>
    </div>
  );
}
