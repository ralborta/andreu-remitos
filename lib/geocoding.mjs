function requireKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    throw new Error("Falta GOOGLE_MAPS_API_KEY en el entorno del backend");
  }
  return key;
}

async function googleGet(path, params) {
  const key = requireKey();
  const url = new URL(`https://maps.googleapis.com/maps/api/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("key", key);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Maps HTTP ${res.status}`);
  }
  return res.json();
}

function parseGeocodeResult(result) {
  const { lat, lng } = result.geometry.location;
  return {
    formattedAddress: result.formatted_address,
    lat,
    lng,
    placeId: result.place_id,
    locationType: result.geometry.location_type,
    partial: result.geometry.location_type === "APPROXIMATE",
  };
}

export async function geocodeAddress(address, { region = "ar", language = "es" } = {}) {
  const data = await googleGet("geocode/json", {
    address: address.trim(),
    region,
    language,
  });

  if (data.status === "ZERO_RESULTS") {
    throw new Error("No se encontró la dirección");
  }
  if (data.status !== "OK") {
    throw new Error(data.error_message || `Geocoding: ${data.status}`);
  }

  return parseGeocodeResult(data.results[0]);
}

export async function reverseGeocode(lat, lng, { language = "es" } = {}) {
  const data = await googleGet("geocode/json", {
    latlng: `${lat},${lng}`,
    language,
  });

  if (data.status === "ZERO_RESULTS") {
    return {
      formattedAddress: `${lat}, ${lng}`,
      lat,
      lng,
      placeId: null,
      locationType: "GEOMETRIC_CENTER",
      partial: true,
    };
  }
  if (data.status !== "OK") {
    throw new Error(data.error_message || `Reverse geocoding: ${data.status}`);
  }

  const parsed = parseGeocodeResult(data.results[0]);
  return { ...parsed, lat, lng };
}

export async function autocompleteAddress(input, { country = "ar", language = "es" } = {}) {
  const q = input.trim();
  if (q.length < 3) return [];

  const data = await googleGet("place/autocomplete/json", {
    input: q,
    components: `country:${country}`,
    language,
    types: "address",
  });

  if (data.status === "ZERO_RESULTS") return [];
  if (data.status !== "OK") {
    throw new Error(data.error_message || `Autocomplete: ${data.status}`);
  }

  return (data.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? "",
  }));
}

export async function placeDetails(placeId, { language = "es" } = {}) {
  const data = await googleGet("place/details/json", {
    place_id: placeId,
    fields: "formatted_address,geometry,place_id,name",
    language,
  });

  if (data.status !== "OK") {
    throw new Error(data.error_message || `Place details: ${data.status}`);
  }

  const r = data.result;
  const { lat, lng } = r.geometry.location;
  return {
    formattedAddress: r.formatted_address,
    name: r.name,
    lat,
    lng,
    placeId: r.place_id,
    locationType: r.geometry.location_type ?? "ROOFTOP",
    partial: false,
  };
}

export function parseCoordInput(raw) {
  const t = raw.trim();
  const m = t.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
