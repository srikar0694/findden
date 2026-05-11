import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India
const DEFAULT_ZOOM = 5;
const ZOOM_WHEN_LOCATED = 16;

/**
 * LocationPicker (CR §1.2 / §2.1)
 * --------------------------------
 * - On mount, asks the browser for the user's current location and drops
 *   the pin there automatically (the "Use my location" button is gone).
 * - The "Confirm location" button is also gone — the address fields
 *   prepopulate as soon as the pin lands and the parent uses them directly.
 * - Reverse-geocodes the pin to fill { address_line, country, city, state, pincode }.
 *
 * Props
 *   value: { latitude, longitude, address_line, country, city, state, pincode }
 *   onChange(value)
 */
export default function LocationPicker({ value = {}, onChange }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const mapRef = useRef(null);
  const autoLocatedRef = useRef(false);
  const [status, setStatus] = useState('');

  const hasPin = value.latitude != null && value.longitude != null && value.latitude !== '' && value.longitude !== '';
  const center = hasPin
    ? { lat: Number(value.latitude), lng: Number(value.longitude) }
    : DEFAULT_CENTER;

  const reverseGeocode = useCallback(async (lat, lng) => {
    // Try Google Maps Geocoder first
    if (window.google?.maps) {
      const googleResult = await new Promise((resolve) => {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, st) => {
          if (st !== 'OK' || !results || results.length === 0) { resolve(null); return; }
          const first = results[0];
          const components = first.address_components || [];
          const get = (...types) => {
            const c = components.find((cmp) => types.every((t) => cmp.types.includes(t)));
            return c ? c.long_name : '';
          };
          resolve({
            address_line: first.formatted_address || '',
            country: get('country'),
            // Try progressively coarser levels if locality is absent
            city:    get('locality') || get('administrative_area_level_3') || get('administrative_area_level_2'),
            state:   get('administrative_area_level_1'),
            pincode: get('postal_code'),
          });
        });
      });
      // Only use the Google result if it has meaningful data
      if (googleResult?.country) return googleResult;
    }

    // Fallback: Nominatim (OpenStreetMap) — works without a paid API key
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en-US,en' } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const a = data.address || {};
      return {
        address_line: data.display_name || '',
        country: a.country || '',
        state:   a.state || '',
        city:    a.city || a.town || a.municipality || a.village || a.suburb || '',
        pincode: a.postcode || '',
      };
    } catch {
      return null;
    }
  }, []);

  const updatePin = useCallback(async (lat, lng) => {
    let extras = {};
    try {
      const geo = await reverseGeocode(lat, lng);
      if (geo) extras = geo;
    } catch { /* ignore */ }
    onChange({ ...value, ...extras, latitude: lat, longitude: lng });
  }, [onChange, reverseGeocode, value]);

  // CR §1.2.3 / §2.1 — auto-default to the user's current location on mount.
  useEffect(() => {
    if (!isLoaded || autoLocatedRef.current || hasPin) return;
    autoLocatedRef.current = true;
    if (!navigator.geolocation) {
      setStatus("Your browser doesn't support location services — drop the pin manually.");
      return;
    }
    setStatus('Getting your current location…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await updatePin(latitude, longitude);
        if (mapRef.current) {
          mapRef.current.panTo({ lat: latitude, lng: longitude });
          mapRef.current.setZoom(ZOOM_WHEN_LOCATED);
        }
        setStatus('Pin set to your current location — drag or click the map to refine.');
      },
      () => {
        setStatus('Location permission denied — click on the map to drop the pin.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

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
      {hasPin && (
        <div className="text-xs text-gray-500">
          📍 {Number(value.latitude).toFixed(5)}, {Number(value.longitude).toFixed(5)}
        </div>
      )}
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
