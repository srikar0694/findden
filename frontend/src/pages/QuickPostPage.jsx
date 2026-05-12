import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { propertiesService } from '../services/properties.service';
import { useAuthStore } from '../store/authStore';
import LocationPicker from '../components/map/LocationPicker';
import PropertyPreview from '../components/property/PropertyPreview';
import ImageUploader from '../components/property/ImageUploader';
import VideoUploader from '../components/property/VideoUploader';
import Spinner from '../components/shared/Spinner';
import { listCountries, listStates, listCities, reconcileLocation } from '../utils/locations';

/**
 * QuickPostPage (CR §2 / Quick Post + Change Request)
 * ---------------------------------------------------
 * - Map defaults to current location.
 * - Live preview shown alongside the form.
 * - Address, country, state, city populated from the geocoded pin.
 * - CR — conditional fields: bedrooms / bathrooms / area_sqft / furnishing /
 *   room_sharing depending on the property_type.
 */
const PROPERTY_TYPES   = ['apartment', 'house', 'villa', 'plot', 'commercial', 'pg'];
const FURNISHING_TYPES = ['unfurnished', 'semi', 'furnished'];
const ROOM_SHARING_OPTIONS = ['single', 'double', 'triple', 'shared'];

const TYPES_WITH_BHK_BATH = ['apartment', 'house', 'villa'];
const TYPES_WITH_AREA     = ['apartment', 'house', 'villa', 'plot', 'commercial'];
const TYPES_WITH_FURN     = ['apartment', 'house', 'villa', 'pg'];
const TYPES_WITH_BATH     = ['apartment', 'house', 'villa', 'pg'];
const TYPES_WITH_ROOM_SH  = ['pg'];
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
    bathrooms: '',
    area_sqft: '',
    furnishing: 'unfurnished',
    room_sharing: '',
    listing_type: 'rent',
    latitude: '',
    longitude: '',
    address_line: '',
    country: 'India',
    city: '',
    state: '',
    pincode: '',
    images: [],
    video_url: '',
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

  const requiresBhk     = TYPES_WITH_BHK_BATH.includes(form.property_type);
  const showBathrooms   = TYPES_WITH_BATH.includes(form.property_type);
  const showArea        = TYPES_WITH_AREA.includes(form.property_type);
  const showFurnishing  = TYPES_WITH_FURN.includes(form.property_type);
  const showRoomSharing = TYPES_WITH_ROOM_SH.includes(form.property_type);

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
    if (!form.address_line.trim())   return flash('error', 'Street address is required.');
    if (!form.state || !form.city)   return flash('error', 'State and city are required.');
    if (!form.images || form.images.length < 1) return flash('error', 'Please upload at least one image.');
    if (requiresBhk && !form.bhk)    return flash('error', 'Bedrooms is required for this property type.');
    if (showArea && !form.area_sqft) return flash('error', 'Area (sqft) is required for this property type.');
    if (showFurnishing && !form.furnishing) return flash('error', 'Furnishing is required for this property type.');
    if (showRoomSharing && !form.room_sharing) return flash('error', 'Room sharing is required for PG listings.');

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
        address_line: form.address_line,
        country: form.country || 'India',
        city: form.city,
        state: form.state,
        pincode: form.pincode || undefined,
        bhk: requiresBhk && form.bhk ? parseInt(form.bhk, 10) : undefined,
        bathrooms: showBathrooms && form.bathrooms ? parseInt(form.bathrooms, 10) : undefined,
        area_sqft: showArea && form.area_sqft ? parseFloat(form.area_sqft) : undefined,
        furnishing: showFurnishing ? form.furnishing : undefined,
        room_sharing: showRoomSharing ? form.room_sharing : undefined,
        images: form.images.filter(Boolean),
        video_url: form.video_url || undefined,
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Bedrooms *</label>
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

          {/* 7. Area / Bathrooms / Furnishing / Room sharing — conditional per type */}
          <div className="grid grid-cols-2 gap-3">
            {showArea && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area (sqft) *</label>
                <input type="number" value={form.area_sqft} onChange={(e) => set('area_sqft', e.target.value)}
                  placeholder="1050" min={0} required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            {showBathrooms && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bathrooms <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input type="number" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)}
                  placeholder="2" min={0}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            {showFurnishing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Furnishing *</label>
                <select value={form.furnishing} onChange={(e) => set('furnishing', e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize">
                  {FURNISHING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
            {showRoomSharing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Sharing *</label>
                <select value={form.room_sharing} onChange={(e) => set('room_sharing', e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize">
                  <option value="">Select…</option>
                  {ROOM_SHARING_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* 8. Images — at least one required (CR) */}
          <div>
            <ImageUploader value={form.images} onChange={(imgs) => set('images', imgs)} max={10} />
            <p className="text-[11px] text-gray-500 mt-1">At least one image is required.</p>
          </div>

          {/* 9. Optional video — ≤300 MB (CR) */}
          <VideoUploader
            value={form.video_url || null}
            onChange={(url) => set('video_url', url || '')}
          />

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
