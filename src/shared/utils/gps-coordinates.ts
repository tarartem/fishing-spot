/**
 * Utility for parsing user-entered GPS coordinates into { lat, lng }.
 * Supports decimal degrees, bracketed coordinates, cardinal notation (N/S/E/W), and DMS.
 */

export interface ParsedGpsLocation {
  lat: number;
  lng: number;
  formattedLabel: string;
}

/**
 * Parses DMS (e.g. 39°14'52.8"N or 0°56'06"W) into decimal degrees.
 */
function parseDmsComponent(str: string): { value: number; hemisphere: string } | null {
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+(?:([0-9.]+)["]?\s*)?([NSEWnsew])/;
  const match = str.match(dmsRegex);
  if (!match) return null;

  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = match[3] ? parseFloat(match[3]) : 0;
  const hemisphere = match[4].toUpperCase();

  let dec = degrees + minutes / 60 + seconds / 3600;
  if (hemisphere === 'S' || hemisphere === 'W') {
    dec = -dec;
  }
  return { value: dec, hemisphere };
}

export function parseGpsCoordinates(input: string): ParsedGpsLocation | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Check for DMS notation (e.g. 39°14'52.8"N 0°56'06.0"W)
  if (/[NSEWnsew]/.test(trimmed) && /[°'"]/.test(trimmed)) {
    const parts = trimmed.split(/[,;\s]+(?=[0-9])/);
    if (parts.length >= 2) {
      const c1 = parseDmsComponent(parts[0]);
      const c2 = parseDmsComponent(parts.slice(1).join(' '));
      if (c1 && c2) {
        let lat = c1.value;
        let lng = c2.value;
        if (c1.hemisphere === 'E' || c1.hemisphere === 'W') {
          // Lon first
          lng = c1.value;
          lat = c2.value;
        }
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return {
            lat,
            lng,
            formattedLabel: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          };
        }
      }
    }
  }

  // 2. Check for Cardinal Decimal Notation (e.g. 39.248° N, 0.935° W or 39.248N 0.935W)
  const cardinalRegex =
    /^\(?\[?\s*([0-9.]+)\s*°?\s*([NSns])\s*[,;\s]+\s*([0-9.]+)\s*°?\s*([EWew])\s*\]?\)?$/;
  const cardinalMatch = trimmed.match(cardinalRegex);
  if (cardinalMatch) {
    let lat = parseFloat(cardinalMatch[1]);
    if (cardinalMatch[2].toUpperCase() === 'S') lat = -lat;
    let lng = parseFloat(cardinalMatch[3]);
    if (cardinalMatch[4].toUpperCase() === 'W') lng = -lng;

    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        lat,
        lng,
        formattedLabel: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
    }
  }

  // 3. Check for standard Decimal Degrees: e.g. 39.248, -0.935 or [39.248, -0.935] or 39.248 -0.935
  const cleanStr = trimmed.replace(/^[\[\(]/, '').replace(/[\]\)]$/, '').trim();
  // Split by comma or space
  let latStr = '';
  let lngStr = '';

  if (cleanStr.includes(',')) {
    const tokens = cleanStr.split(',').map((t) => t.trim());
    if (tokens.length === 2) {
      latStr = tokens[0];
      lngStr = tokens[1];
    }
  } else if (cleanStr.includes(';')) {
    const tokens = cleanStr.split(';').map((t) => t.trim());
    if (tokens.length === 2) {
      latStr = tokens[0];
      lngStr = tokens[1];
    }
  } else {
    const tokens = cleanStr.split(/\s+/).map((t) => t.trim());
    if (tokens.length === 2) {
      latStr = tokens[0];
      lngStr = tokens[1];
    }
  }

  if (latStr && lngStr) {
    // Ensure both are pure floating numbers
    if (/^[+-]?[0-9]+(?:\.[0-9]+)?$/.test(latStr) && /^[+-]?[0-9]+(?:\.[0-9]+)?$/.test(lngStr)) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return {
          lat,
          lng,
          formattedLabel: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        };
      }
    }
  }

  return null;
}
