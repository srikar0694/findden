import { useCallback, useEffect } from 'react';
import FilterBar from '../components/filters/FilterBar';
import PropertyList from '../components/property/PropertyList';
import MapView from '../components/map/MapView';
import { usePropertyStore } from '../store/propertyStore';

export default function HomePage() {
  const { fetchProperties, setFilters, setSelectedProperty, activeFilters } = usePropertyStore();

  // Initial load — fetch all active properties
  useEffect(() => {
    fetchProperties();
  }, []);

  const handleBoundsChange = useCallback(
    (bounds) => {
      fetchProperties({ ...activeFilters, ...bounds });
    },
    [activeFilters, fetchProperties]
  );

  const handleFilterChange = useCallback(
    (filters) => {
      setFilters(filters);
      fetchProperties(filters);
    },
    [setFilters, fetchProperties]
  );

  const handleCardClick = useCallback(
    (property) => {
      setSelectedProperty(property.id);
    },
    [setSelectedProperty]
  );

  const handleMarkerClick = useCallback(
    (property) => {
      setSelectedProperty(property.id);
      // Scroll list to that card
      const el = document.getElementById(`prop-card-${property.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [setSelectedProperty]
  );

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Filter bar */}
      <FilterBar onFilterChange={handleFilterChange} />

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Property List */}
        <div className="w-full md:w-2/5 lg:w-1/3 flex flex-col border-r border-gray-200 overflow-hidden">
          <PropertyList onCardClick={handleCardClick} />
        </div>

        {/* Right: Map */}
        <div className="hidden md:flex flex-1 relative">
          <MapView onBoundsChange={handleBoundsChange} onMarkerClick={handleMarkerClick} />
        </div>
      </div>
    </div>
  );
}
