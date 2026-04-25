import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import FilterBar from '../components/filters/FilterBar';
import PropertyList from '../components/property/PropertyList';
import MapView from '../components/map/MapView';
import { usePropertyStore } from '../store/propertyStore';
import { Hover } from '../components/motion';

/**
 * SearchPage
 * ----------
 * Property search experience with three view modes:
 *   - "list"  : full-width list of property cards.
 *   - "map"   : full-width map.
 *   - "split" : side-by-side list + map (existing behaviour).
 *
 * The user can toggle between the three modes in the toolbar.
 * Sold-out badges are rendered automatically by <PropertyCard>; the backend
 * keeps them visible for 2 days then auto-filters them.
 */
const VIEW_MODES = [
  { id: 'list',  label: 'List',  icon: '📋' },
  { id: 'split', label: 'Split', icon: '🗺' },
  { id: 'map',   label: 'Map',   icon: '📍' },
];

export default function SearchPage() {
  const { fetchProperties, setFilters, setSelectedProperty, activeFilters } = usePropertyStore();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(params.get('view') || 'split');

  // Load on mount; pre-apply filters from URL (?propertyType=...&listingType=...&quick=1&verified=1).
  useEffect(() => {
    const initial = {
      propertyType: params.get('propertyType') || undefined,
      listingType:  params.get('listingType')  || undefined,
      city:         params.get('city')         || undefined,
      isQuickPost:  params.get('quick') === '1' ? true : undefined,
      verified:     params.get('verified') === '1' ? true : undefined,
    };
    const cleaned = Object.fromEntries(
      Object.entries(initial).filter(([, v]) => v != null)
    );
    if (Object.keys(cleaned).length) setFilters(cleaned);
    fetchProperties(cleaned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quickOnly = activeFilters.isQuickPost === true;
  const verifiedOnly = activeFilters.verified === true;

  const toggleQuickFilter = () => {
    const next = !quickOnly;
    const np = new URLSearchParams(params);
    if (next) np.set('quick', '1'); else np.delete('quick');
    setParams(np, { replace: true });
    const newFilters = { ...activeFilters, isQuickPost: next ? true : undefined };
    setFilters(newFilters);
    fetchProperties(newFilters);
  };

  const toggleVerifiedFilter = () => {
    const next = !verifiedOnly;
    const np = new URLSearchParams(params);
    if (next) np.set('verified', '1'); else np.delete('verified');
    setParams(np, { replace: true });
    const newFilters = { ...activeFilters, verified: next ? true : undefined };
    setFilters(newFilters);
    fetchProperties(newFilters);
  };

  const handleBoundsChange = useCallback(
    (bounds) => fetchProperties({ ...activeFilters, ...bounds }),
    [activeFilters, fetchProperties]
  );

  const handleFilterChange = useCallback(
    (filters) => {
      setFilters(filters);
      fetchProperties(filters);
    },
    [setFilters, fetchProperties]
  );

  const handleCardClick = useCallback((p) => setSelectedProperty(p.id), [setSelectedProperty]);
  const handleMarkerClick = useCallback((p) => {
    setSelectedProperty(p.id);
    const el = document.getElementById(`prop-card-${p.id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [setSelectedProperty]);

  const switchView = (next) => {
    setView(next);
    const np = new URLSearchParams(params);
    np.set('view', next);
    setParams(np, { replace: true });
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Toolbar: filters + view toggle */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2">
        <div className="flex-1 min-w-0"><FilterBar onFilterChange={handleFilterChange} /></div>

        {/* Quick + Verified toggles */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleQuickFilter}
            aria-pressed={quickOnly}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              quickOnly
                ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                : 'border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-600'
            }`}
          >
            ⚡ Quick
          </button>
          <button
            type="button"
            onClick={toggleVerifiedFilter}
            aria-pressed={verifiedOnly}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              verifiedOnly
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            ✓ Verified
          </button>
        </div>

        {/* View toggle */}
        <div className="hidden md:flex items-center bg-gray-100 rounded-xl p-1">
          {VIEW_MODES.map((m) => (
            <Hover key={m.id} preset="lift">
              <button
                onClick={() => switchView(m.id)}
                aria-pressed={view === m.id}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                  view === m.id ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {view === m.id && (
                  <motion.span
                    layoutId="view-toggle-pill"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative">{m.icon}</span>
                <span className="relative">{m.label}</span>
              </button>
            </Hover>
          ))}
        </div>
      </div>

      {/* Body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-1 overflow-hidden"
        >
          {/* List */}
          {(view === 'list' || view === 'split') && (
            <div className={`${
              view === 'list' ? 'w-full' : 'w-full md:w-2/5 lg:w-1/3'
            } flex flex-col border-r border-gray-200 overflow-hidden`}>
              <PropertyList
                onCardClick={handleCardClick}
                layout={view === 'list' ? 'grid' : 'column'}
              />
            </div>
          )}

          {/* Map */}
          {(view === 'map' || view === 'split') && (
            <div className={`${
              view === 'map' ? 'w-full' : 'hidden md:flex flex-1'
            } relative`}>
              <MapView onBoundsChange={handleBoundsChange} onMarkerClick={handleMarkerClick} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
