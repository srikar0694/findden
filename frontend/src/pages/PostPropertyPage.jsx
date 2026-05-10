import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { propertiesService } from '../services/properties.service';
import Spinner from '../components/shared/Spinner';
import LocationPicker from '../components/map/LocationPicker';
import ImageUploader from '../components/property/ImageUploader';
import PropertyPreview from '../components/property/PropertyPreview';
import { useAuthStore } from '../store/authStore';
import { listCountries, listStates, listCities, reconcileLocation } from '../utils/locations';

const PROPERTY_TYPES = ['apartment', 'house', 'villa', 'plot', 'commercial', 'pg'];
const LISTING_TYPES = ['sale', 'rent'];
const FURNISHING_TYPES = ['unfurnished', 'semi', 'furnished'];

const AMENITY_OPTIONS = [
  'parking', 'gym', 'pool', 'garden', 'lift', 'security',
  'power_backup', 'wifi', 'ac', 'clubhouse', 'playground',
];

/**
 * PostPropertyPage (CR §1.2)
 * --------------------------
 * - Live preview alongside the form.
 * - description + pincode are no longer required.
 * - Map auto-defaults to current location; "use my location" + "confirm
 *   location" buttons removed.
 * - country / state / city are dropdowns, defaulted from the geocode and
 *   cascading (country ⇒ state list, state ⇒ city list).
 * - Toast popup for success/error; success ⇒ redirect to /search.
 */
export default function PostPropertyPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { type:'success'|'error', text }

  const flash = (type, text, ms = 3500) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), ms);
  };

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
    country: 'India',
    city: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    amenities: [],
    available_from: '',
    images: [],
    contact_name: '',
    contact_phone: '',
    contact_email: '',
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const setMany = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Pre-populate contact details from the signed-in user — editable.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      contact_name:  f.contact_name  || user.name  || '',
      contact_phone: f.contact_phone || user.phone || '',
      contact_email: f.contact_email || user.email || '',
    }));
  }, [user]);

  const toggleAmenity = (amenity) => {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(amenity)
        ? f.amenities.filter((a) => a !== amenity)
        : [...f.amenities, amenity],
    }));
  };

  // ─── Cascading dropdown options ─────────────────────────────────────────
  const countryOptions = useMemo(() => listCountries(), []);
  const stateOptions   = useMemo(() => listStates(form.country), [form.country]);
  const cityOptions    = useMemo(() => listCities(form.country, form.state), [form.country, form.state]);

  const handleCountryChange = (country) => {
    // Reset state/city to keep cascade consistent.
    setMany({ country, state: '', city: '' });
  };
  const handleStateChange = (state) => {
    setMany({ state, city: '' });
  };

  // When the LocationPicker reverse-geocodes, reconcile country/state/city
  // against our curated dataset so the dropdowns show the canonical names.
  const handleLocationChange = (v) => {
    const reconciled = reconcileLocation({
      country: v.country ?? form.country,
      state:   v.state   ?? form.state,
      city:    v.city    ?? form.city,
    });
    setMany({
      latitude:     v.latitude     ?? form.latitude,
      longitude:    v.longitude    ?? form.longitude,
      address_line: v.address_line ?? form.address_line,
      pincode:      v.pincode      ?? form.pincode,
      country: reconciled.country,
      state:   reconciled.state,
      city:    reconciled.city,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
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
        // Send empty strings as undefined so backend treats them as missing.
        description: form.description?.trim() || undefined,
        pincode: form.pincode?.trim() || undefined,
        address_line: form.address_line?.trim() || undefined,
      };
      await propertiesService.create(payload);
      flash('success', 'Property posted successfully! Redirecting…', 1500);
      // CR §1.2.7 — on success, take the user to the search page.
      setTimeout(() => navigate('/search'), 1100);
    } catch (err) {
      // CR §1.2.7 — on error, stay on the page and show a popup.
      if (err.code === 'PAYMENT_REQUIRED') {
        flash('error', 'You need an active subscription to post. Redirecting to pricing…');
        setTimeout(() => navigate('/pricing?from=post'), 1200);
      } else {
        flash('error', err.message || 'Failed to post property. Please try again.');
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

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Post Your Property</h1>
      <p className="text-gray-500 text-sm mb-8">Fill in the details to list your property on FindDen.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT — form */}
        <div className="lg:col-span-2">
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

                {/* CR §1.2.2 — description is no longer required. */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
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

                {/* Contact details — pre-populated, fully editable */}
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">Contact details</h3>
                    <span className="text-xs text-gray-400">Pre-filled from your profile · editable</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Owner Name *</label>
                      <input type="text" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                      <input type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)}
                        required pattern="[0-9+\-\s]{7,20}"
                        placeholder="9876543210"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pin your property on the map *</label>
                  <p className="text-xs text-gray-500 mb-2">
                    The map defaults to your current location. Click or drag the pin to refine —
                    the address fields below auto-fill from the pin.
                  </p>
                  <LocationPicker value={locationValue} onChange={handleLocationChange} />
                </div>

                {/* CR §1.2.2 — try to prepopulate address from the map. */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input type="text" value={form.address_line} onChange={(e) => set('address_line', e.target.value)}
                    placeholder="Block, society, landmark"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* CR §1.2.4 / §1.2.5 / §1.2.6 — country / state / city dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                    <select value={form.country} onChange={(e) => handleCountryChange(e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      {form.country && !countryOptions.includes(form.country) && (
                        <option value={form.country}>{form.country}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <select value={form.state} onChange={(e) => handleStateChange(e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="">Select state…</option>
                      {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      {form.state && !stateOptions.includes(form.state) && (
                        <option value={form.state}>{form.state}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <select value={form.city} onChange={(e) => set('city', e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="">Select city…</option>
                      {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      {form.city && !cityOptions.includes(form.city) && (
                        <option value={form.city}>{form.city}</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* CR §1.2.2 — pincode is no longer required. */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pincode <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input type="text" value={form.pincode} onChange={(e) => set('pincode', e.target.value)}
                    placeholder="560034" pattern="[0-9]{5,10}"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors">
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={!form.latitude || !form.longitude || !form.city || !form.state}
                    title={!form.latitude || !form.longitude ? 'Please drop a pin first' : (!form.city || !form.state ? 'Please pick state and city' : '')}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
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

                <ImageUploader value={form.images} onChange={(imgs) => set('images', imgs)} max={10} />

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

        {/* RIGHT — live preview (CR §1.2.1) */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <PropertyPreview form={form} />
          </div>
        </aside>
      </div>
    </div>
  );
}
