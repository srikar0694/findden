import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India
const DEFAULT_ZOOM = 5;
const ZOOM_WHEN_LOCATED = 16;

/**
 * LocationPicker
 * Asks the user for their current location (with permission), drops a
 * draggable pin, reverse-geocodes the result to fill address fields, and
 * surfaces a "Confirm location" button per CR §1.1.
 *
 * Props
 *   value: { latitude, longitude, address_line, city, state, pincode }
 *   onChange(value)
 *   onConfirm()  optional — fired when user clicks "Confirm location"
 */
export default function LocationPicker({ value = {}, onChange, onConfirm }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const mapRef = useRef(null);
  const [status, setStatus] = useState('');   // info banner text
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const hasPin = value.latitude != null && value.longitude != null;
  const center = hasPin
    ? { lat: Number(value.latitude), lng: Number(value.longitude) }
    : DEFAULT_CENTER;

  const reverseGeocode = useCallback(async (lat, lng) => {
    if (!window.google?.maps) return null;
    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== 'OK' || !results || results.length === 0) {
          resolve(null);
          return;
        }
        const first = results[0];
        const components = first.address_components || [];
        const get = (...types) => {
          const c = components.find((cmp) => types.every((t) => cmp.types.includes(t)));
          return c ? c.long_name : '';
        };
        resolve({
          address_line: first.formatted_address || '',
          city:    get('locality') || get('administrative_area_level_2'),
          state:   get('administrative_area_level_1'),
          pincode: get('postal_code'),
        });
      });
    });
  }, []);

  const updatePin = useCallback(async (lat, lng) => {
    setConfirmed(false);
    let extras = {};
    try {
      const geo = await reverseGeocode(lat, lng);
      if (geo) extras = geo;
    } catch { /* ignore */ }
    onChange({ ...value, ...extras, latitude: lat, longitude: lng });
  }, [onChange, reverseGeocode, value]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("Your browser doesn't support location services.");
      return;
    }
    setBusy(true);
    setStatus('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await updatePin(latitude, longitude);
        if (mapRef.current) {
          mapRef.current.panTo({ lat: latitude, lng: longitude });
          mapRef.current.setZoom(ZOOM_WHEN_LOCATED);
        }
        setStatus('Pin set to your current location — drag it to refine.');
        setBusy(false);
      },
      (err) => {
        setBusy(false);
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — drop the pin manually instead.'
            : 'Could not get your location. Drop the pin manually instead.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [updatePin]);

  // On first load, if no pin is set, prompt the user to share location.
  useEffect(() => {
    if (!hasPin && isLoaded) {
      setStatus('Click "Use my location" or drop the pin on the map.');
    }
  }, [isLoaded, hasPin]);

  if (loadError) {
    return (
      <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg p-3">
        Map failed to load. Check your Google Maps API key.
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className="border border-gray-200 bg-gray-50 text-gray-500 text-sm rounded-lg p-3">
        Loading map…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          📍 {busy ? 'Locating…' : 'Use my location'}
        </button>
        {hasPin && (
          <button
            type="button"
            onClick={() => { setConfirmed(true); onConfirm && onConfirm(); }}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              confirmed ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {confirmed ? '✓ Confirmed' : 'Confirm location'}
          </button>
        )}
        {hasPin && (
          <span className="text-xs text-gray-500">
            {Number(value.latitude).toFixed(5)}, {Number(value.longitude).toFixed(5)}
          </span>
        )}
      </div>

      {status && <p className="text-xs text-gray-500">{status}</p>}

      <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 280 }}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={hasPin ? ZOOM_WHEN_LOCATED : DEFAULT_ZOOM}
          onLoad={(map) => { mapRef.current = map; }}
          onClick={(e) => updatePin(e.latLng.lat(), e.latLng.lng())}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          {hasPin && (
            <MarkerF
              position={{ lat: Number(value.latitude), lng: Number(value.longitude) }}
              draggable
              onDragEnd={(e) => updatePin(e.latLng.lat(), e.latLng.lng())}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
