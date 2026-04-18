import { useState } from 'react';
import { usePropertyStore } from '../../store/propertyStore';

const LISTING_TYPES = [
  { value: '', label: 'Buy & Rent' },
  { value: 'sale', label: 'Buy' },
  { value: 'rent', label: 'Rent' },
];

const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'villa', label: 'Villa' },
  { value: 'plot', label: 'Plot' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'pg', label: 'PG' },
];

const BEDROOMS = [
  { value: '', label: 'Any BHK' },
  { value: '1', label: '1 BHK' },
  { value: '2', label: '2 BHK' },
  { value: '3', label: '3 BHK' },
  { value: '4', label: '4+ BHK' },
];

export default function FilterBar({ onFilterChange }) {
  const { activeFilters } = usePropertyStore();
  const [city, setCity] = useState('');

  const handleChange = (key, value) => {
    const updated = { ...activeFilters, [key]: value || undefined };
    Object.keys(updated).forEach((k) => { if (!updated[k]) delete updated[k]; });
    onFilterChange(updated);
  };

  const handleCitySearch = (e) => {
    if (e.key === 'Enter') {
      handleChange('city', city);
    }
  };

  const hasActiveFilters = Object.keys(activeFilters).some(
    (k) => !['swLat', 'swLng', 'neLat', 'neLng'].includes(k) && activeFilters[k]
  );

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex flex-wrap gap-2 items-center">
        {/* City search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search city… (Enter)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={handleCitySearch}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Listing type */}
        <select
          value={activeFilters.listingType || ''}
          onChange={(e) => handleChange('listingType', e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {LISTING_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Property type */}
        <select
          value={activeFilters.propertyType || ''}
          onChange={(e) => handleChange('propertyType', e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {PROPERTY_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Bedrooms */}
        <select
          value={activeFilters.bedrooms || ''}
          onChange={(e) => handleChange('bedrooms', e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {BEDROOMS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Price range */}
        <input
          type="number"
          placeholder="Min ₹"
          value={activeFilters.minPrice || ''}
          onChange={(e) => handleChange('minPrice', e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          placeholder="Max ₹"
          value={activeFilters.maxPrice || ''}
          onChange={(e) => handleChange('maxPrice', e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={() => { setCity(''); onFilterChange({}); }}
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
}
