import PropertyCard from './PropertyCard';
import Spinner from '../shared/Spinner';
import { usePropertyStore } from '../../store/propertyStore';
import { Stagger } from '../motion';

export default function PropertyList({ onCardClick }) {
  const { properties, loading, error, total } = usePropertyStore();

  if (loading && properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <Spinner size="lg" />
        <p className="text-sm">Loading properties…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <span className="text-4xl">⚠️</span>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!loading && properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <span className="text-5xl">🏠</span>
        <p className="text-sm font-medium">No properties found</p>
        <p className="text-xs">Try adjusting your filters or map view</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Count */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-xs text-gray-500 font-medium">
          {total} {total === 1 ? 'property' : 'properties'} found
        </span>
      </div>

      {/* Cards (staggered entry animation) */}
      <div className="flex-1 overflow-y-auto p-3">
        <Stagger className="space-y-3" stagger={0.05} whileInView={false}>
          {properties.map((property) => (
            <Stagger.Item key={property.id}>
              <PropertyCard
                property={property}
                onClick={() => onCardClick && onCardClick(property)}
              />
            </Stagger.Item>
          ))}
        </Stagger>
        {loading && <Spinner className="py-4" />}
      </div>
    </div>
  );
}
