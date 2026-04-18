import { useCallback, useRef, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { usePropertyStore } from '../../store/propertyStore';
import { debounce } from '../../utils/debounce';
import { formatCurrency, formatRent } from '../../utils/formatCurrency';
import { Link } from 'react-router-dom';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Default center: India
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const DEFAULT_ZOOM = 5;

const mapContainerStyle = { width: '100%', height: '100%' };

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
};

export default function MapView({ onBoundsChange, onMarkerClick }) {
  const { properties, selectedPropertyId } = usePropertyStore();
  const mapRef = useRef(null);
  const [activeMarker, setActiveMarker] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Debounced bounds handler — 400ms after the user stops panning
  const debouncedBoundsChange = useCallback(
    debounce((map) => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      onBoundsChange({
        swLat: sw.lat(),
        swLng: sw.lng(),
        neLat: ne.lat(),
        neLng: ne.lng(),
      });
    }, 400),
    [onBoundsChange]
  );

  const onLoad = useCallback(
    (map) => {
      mapRef.current = map;
    },
    []
  );

  const onIdle = useCallback(() => {
    if (mapRef.current) debouncedBoundsChange(mapRef.current);
  }, [debouncedBoundsChange]);

  // Pan to selected property
  useEffect(() => {
    if (selectedPropertyId && mapRef.current) {
      const prop = properties.find((p) => p.id === selectedPropertyId);
      if (prop) {
        mapRef.current.panTo({ lat: prop.latitude, lng: prop.longitude });
        mapRef.current.setZoom(14);
        setActiveMarker(prop.id);
      }
    }
  }, [selectedPropertyId, properties]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-100 gap-4 text-gray-500">
        <span className="text-4xl">🗺️</span>
        <p className="text-sm font-medium">Map failed to load</p>
        <p className="text-xs text-center px-8">Check your Google Maps API key in <code>.env</code></p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">🗺️</div>
          <p className="text-sm">Loading map…</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      options={mapOptions}
      onLoad={onLoad}
      onIdle={onIdle}
    >
      {properties.map((property) => (
        <MarkerF
          key={property.id}
          position={{ lat: property.latitude, lng: property.longitude }}
          title={property.title}
          icon={{
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
              createPriceMarker(property, property.id === selectedPropertyId)
            )}`,
            anchor: { x: 40, y: 20 },
          }}
          onClick={() => {
            setActiveMarker(property.id);
            onMarkerClick && onMarkerClick(property);
          }}
        />
      ))}

      {activeMarker && (() => {
        const prop = properties.find((p) => p.id === activeMarker);
        if (!prop) return null;
        return (
          <InfoWindowF
            position={{ lat: prop.latitude, lng: prop.longitude }}
            onCloseClick={() => setActiveMarker(null)}
          >
            <div className="max-w-xs">
              {prop.thumbnail && (
                <img
                  src={prop.thumbnail}
                  alt={prop.title}
                  className="w-full h-28 object-cover rounded-t-md mb-2"
                />
              )}
              <div className="px-1">
                <p className="font-semibold text-sm text-gray-900 leading-tight">{prop.title}</p>
                <p className="text-blue-600 font-bold text-sm mt-0.5">
                  {prop.listingType === 'rent' ? formatRent(prop.price) : formatCurrency(prop.price)}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">📍 {prop.city}</p>
                <Link
                  to={`/property/${prop.id}`}
                  className="block mt-2 text-center text-xs text-white bg-blue-600 hover:bg-blue-700 py-1 rounded transition-colors"
                >
                  View Details
                </Link>
              </div>
            </div>
          </InfoWindowF>
        );
      })()}
    </GoogleMap>
  );
}

function createPriceMarker(property, isSelected) {
  const label =
    property.listingType === 'rent'
      ? `₹${Math.round(property.price / 1000)}K/mo`
      : property.price >= 10000000
      ? `₹${(property.price / 10000000).toFixed(1)}Cr`
      : `₹${(property.price / 100000).toFixed(0)}L`;

  const bg = isSelected ? '#1d4ed8' : '#2563eb';
  const textColor = '#ffffff';
  const width = 80;
  const height = 28;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="1" y="1" width="${width - 2}" height="${height - 6}" rx="4" fill="${bg}" stroke="white" stroke-width="1.5"/>
      <polygon points="${width / 2 - 5},${height - 6} ${width / 2 + 5},${height - 6} ${width / 2},${height}" fill="${bg}"/>
      <text x="${width / 2}" y="${height / 2 - 1}" font-family="Arial,sans-serif" font-size="10" font-weight="bold"
        fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${label}</text>
    </svg>
  `;
}
