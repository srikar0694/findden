import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { propertiesService } from '../services/properties.service';
import { useAuthStore } from '../store/authStore';
import LocationPicker from '../components/map/LocationPicker';
import PropertyPreview from '../components/property/PropertyPreview';
import Spinner from '../components/shared/Spinner';
import { listCountries, listStates, listCities, reconcileLocation } from '../utils/locations';

/**
 * QuickPostPage (CR §2 / Quick Post)
 * -----------------------------------
 * - Map defaults to current location; "use my location" / "confirm
 *   location" buttons removed.
 * - Live preview shown alongside the form.
 * - Address, country, state, city are populated from the geocoded pin
 *   (country/state/city as cascading dropdowns).
 * - Toast popup for success / error; success ⇒ redirect to /search.
 */
const PROPERTY_TYPES = ['apartment', 'house', 'villa', 'plot', 'commercial', 'pg'];
const BHK_REQUIRED_TYPES = ['apartment', 'house', 'villa'];
const BHK_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function QuickPostPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { type, text }

  const flash = (type, text, ms = 3500) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), ms);
  };

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
    country: 'India',
    city: '',
    state: '',
    pincode: '',
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const setMany = (patch) => setForm((f) => ({ ...f, ...patch }));

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

  const countryOptions = useMemo(() => listCountries(), []);
  const stateOptions   = useMemo(() => listStates(form.country), [form.country]);
  const cityOptions    = useMemo(() => listCities(form.country, form.state), [form.country, form.state]);

  const handleLocationChange = (v) => {
    const r = reconcileLocation({
      country: v.country ?? form.country,
      state:   v.state   ?? form.state,
      city:    v.city    ?? form.city,
    });
    setMany({
      latitude:     v.latitude     ?? form.latitude,
      longitude:    v.longitude    ?? form.longitude,
      address_line: v.address_line ?? form.address_line,
      pincode:      v.pincode      ?? form.pincode,
      country: r.country,
      state:   r.state,
      city:    r.city,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      navigate('/login');
      return;
    }
    if (!form.owner_name.trim())     return flash('error', 'Owner name is required.');
    if (!form.contact_phone.trim())  return flash('error', 'Phone is required for a quick post.');
    if (!form.latitude || !form.longitude) {
      return flash('error', 'Please drop a pin on the map for your property.');
    }
    if (!form.price)                 return flash('error', 'Price is required.');
    if (requiresBhk && !form.bhk)    return flash('error', 'BHK is required for this property type.');

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
        country: form.country || 'India',
        city: form.city || undefined,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
        bhk: requiresBhk && form.bhk ? parseInt(form.bhk, 10) : undefined,
      };
      await propertiesService.quickCreate(payload);
      flash('success', 'Quick post created — redirecting to search…', 1500);
      setTimeout(() => navigate('/search?quick=1'), 1100);
    } catch (err) {
      if (err.code === 'PAYMENT_REQUIRED') {
        flash('error', 'You need an active subscription to post. Redirecting to pricing…');
        setTimeout(() => navigate('/pricing?from=post'), 1200);
      } else {
        flash('error', err.message || 'Could not post property. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const locationValue = {
    latitude: form.latitude,
    longitude: form.longitude,
    address_line: form.address_line,
    country: form.country,
    city: form.city,
    state: form.state,
    pincode: form.pincode,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Toast (success / error popup) */}
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

      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">⚡</span>
        <h1 className="text-2xl font-bold text-gray-900">Quick Property Post</h1>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Just the essentials — you can complete the rest later.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT — form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
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

          {/* 2. Location pin (auto-defaults to current location) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location Pin *</label>
            <p className="text-xs text-gray-500 mb-2">
              The map defaults to your current location. Click or drag the pin to refine.
            </p>
            <LocationPicker value={locationValue} onChange={handleLocationChange} />
          </div>

          {/* 2b. Address auto-populated; cascading country/state/city dropdowns */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={form.address_line}
              onChange={(e) => set('address_line', e.target.value)}
              placeholder="Auto-filled from the pin — edit to refine"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
              <select
                value={form.country}
                onChange={(e) => setMany({ country: e.target.value, state: '', city: '' })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                {form.country && !countryOptions.includes(form.country) && (
                  <option value={form.country}>{form.country}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                value={form.state}
                onChange={(e) => setMany({ state: e.target.value, city: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select state…</option>
                {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                {form.state && !stateOptions.includes(form.state) && (
                  <option value={form.state}>{form.state}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <select
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select city…</option>
                {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                {form.city && !cityOptions.includes(form.city) && (
                  <option value={form.city}>{form.city}</option>
                )}
              </select>
            </div>
          </div>

          {/* 3. Phone */}
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
          </div>

          {/* 4. Price + listing */}
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
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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

        {/* RIGHT — live preview */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <PropertyPreview form={form} compact />
          </div>
        </aside>
      </div>
    </div>
  );
}
