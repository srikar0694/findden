/**
 * Geo utility functions.
 * Replaces PostGIS functions with JavaScript equivalents for JSON-based data.
 */

/**
 * Check if a point (lat, lng) is within a bounding box.
 * @param {number} lat - Point latitude
 * @param {number} lng - Point longitude
 * @param {number} swLat - South-West latitude
 * @param {number} swLng - South-West longitude
 * @param {number} neLat - North-East latitude
 * @param {number} neLng - North-East longitude
 */
function isInBounds(lat, lng, swLat, swLng, neLat, neLng) {
  return (
    lat >= swLat &&
    lat <= neLat &&
    lng >= swLng &&
    lng <= neLng
  );
}

/**
 * Calculate the Haversine distance between two geo-coordinates (in km).
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

module.exports = { isInBounds, haversineDistance };
