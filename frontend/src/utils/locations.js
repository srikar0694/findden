/**
 * locations.js
 * ------------
 * Lightweight curated dataset for the Country → State → City cascading
 * dropdowns on the post-property forms (CR §1.2.5 / §1.2.6).
 *
 * Goal: ship a usable, India-first list without pulling in a multi-MB
 * worldwide dataset. Anything not in this list is still accepted via the
 * "Other (type your own)" affordance the parent component renders.
 *
 * To extend a country, add it to COUNTRIES with a `states` map of
 * { stateName: [city1, city2, ...] }.
 */

export const COUNTRIES = {
  India: {
    code: 'IN',
    states: {
      'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Nellore'],
      'Delhi': ['New Delhi', 'Dwarka', 'Saket', 'Rohini', 'Karol Bagh'],
      'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
      'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
      'Haryana': ['Gurgaon', 'Faridabad', 'Panipat', 'Karnal', 'Ambala'],
      'Karnataka': ['Bangalore', 'Mysore', 'Mangalore', 'Hubli', 'Belgaum'],
      'Kerala': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam'],
      'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad'],
      'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
      'Odisha': ['Bhubaneswar', 'Cuttack', 'Puri', 'Rourkela'],
      'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Mohali', 'Patiala'],
      'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
      'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
      'Telangana': ['Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad'],
      'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Ghaziabad', 'Agra', 'Varanasi'],
      'West Bengal': ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur', 'Asansol'],
    },
  },

  'United States': {
    code: 'US',
    states: {
      'California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento'],
      'New York': ['New York City', 'Buffalo', 'Rochester', 'Albany', 'Syracuse'],
      'Texas': ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth'],
      'Florida': ['Miami', 'Orlando', 'Tampa', 'Jacksonville'],
      'Illinois': ['Chicago', 'Springfield', 'Naperville', 'Peoria'],
      'Washington': ['Seattle', 'Spokane', 'Tacoma', 'Bellevue'],
    },
  },

  'United Kingdom': {
    code: 'GB',
    states: {
      'England': ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Bristol', 'Leeds'],
      'Scotland': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'],
      'Wales': ['Cardiff', 'Swansea', 'Newport'],
      'Northern Ireland': ['Belfast', 'Derry', 'Lisburn'],
    },
  },

  'Canada': {
    code: 'CA',
    states: {
      'Ontario': ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton'],
      'Quebec':  ['Montreal', 'Quebec City', 'Laval'],
      'British Columbia': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby'],
      'Alberta': ['Calgary', 'Edmonton', 'Red Deer'],
    },
  },

  'United Arab Emirates': {
    code: 'AE',
    states: {
      'Dubai':     ['Dubai'],
      'Abu Dhabi': ['Abu Dhabi', 'Al Ain'],
      'Sharjah':   ['Sharjah'],
      'Ajman':     ['Ajman'],
    },
  },

  'Singapore': {
    code: 'SG',
    states: { 'Singapore': ['Singapore'] },
  },

  'Australia': {
    code: 'AU',
    states: {
      'New South Wales': ['Sydney', 'Newcastle', 'Wollongong'],
      'Victoria':        ['Melbourne', 'Geelong'],
      'Queensland':      ['Brisbane', 'Gold Coast', 'Cairns'],
      'Western Australia': ['Perth', 'Fremantle'],
    },
  },
};

export function listCountries() {
  return Object.keys(COUNTRIES);
}

export function listStates(country) {
  if (!country || !COUNTRIES[country]) return [];
  return Object.keys(COUNTRIES[country].states);
}

export function listCities(country, state) {
  if (!country || !state) return [];
  const c = COUNTRIES[country];
  if (!c || !c.states[state]) return [];
  return c.states[state];
}

// Common alternate names returned by geocoders that differ from our canonical list.
const CITY_ALIASES = {
  'bengaluru': 'Bangalore',
  'gurugram': 'Gurgaon',
  'bombay': 'Mumbai',
  'calcutta': 'Kolkata',
  'madras': 'Chennai',
  'vishakhapatnam': 'Visakhapatnam',
  'vishakapatnam': 'Visakhapatnam',
};

/**
 * Best-effort match for a country/state/city tuple coming back from the
 * reverse geocoder so the dropdowns can default to a sensible value.
 * Returns the canonical names from our dataset (or the originals if no match).
 */
export function reconcileLocation({ country, state, city }) {
  const countries = listCountries();
  const matchedCountry =
    countries.find((c) => c.toLowerCase() === (country || '').toLowerCase()) ||
    (country && country.includes('United States') ? 'United States' : null) ||
    country ||
    'India';

  const states = listStates(matchedCountry);
  const matchedState =
    states.find((s) => s.toLowerCase() === (state || '').toLowerCase()) ||
    state ||
    '';

  const cities = listCities(matchedCountry, matchedState);
  const lowerCity = (city || '').toLowerCase();
  const aliasedCity = CITY_ALIASES[lowerCity];
  const matchedCity =
    cities.find((c) => c.toLowerCase() === lowerCity) ||
    (aliasedCity && cities.includes(aliasedCity) ? aliasedCity : null) ||
    city ||
    '';

  return { country: matchedCountry, state: matchedState, city: matchedCity };
}
