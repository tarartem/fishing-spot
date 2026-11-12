import { describe, it, expect } from 'vitest';
import { parseGpsCoordinates } from '@/shared/utils/gps-coordinates';

describe('parseGpsCoordinates', () => {
  it('parses comma-separated decimal degrees (lat, lng)', () => {
    const res = parseGpsCoordinates('39.248, -0.935');
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(39.248, 4);
    expect(res?.lng).toBeCloseTo(-0.935, 4);
  });

  it('parses space-separated decimal degrees', () => {
    const res = parseGpsCoordinates('39.248 -0.935');
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(39.248, 4);
    expect(res?.lng).toBeCloseTo(-0.935, 4);
  });

  it('parses bracketed or parenthesized coordinates', () => {
    const res1 = parseGpsCoordinates('[39.248, -0.935]');
    expect(res1?.lat).toBeCloseTo(39.248, 4);
    expect(res1?.lng).toBeCloseTo(-0.935, 4);

    const res2 = parseGpsCoordinates('(39.248, -0.935)');
    expect(res2?.lat).toBeCloseTo(39.248, 4);
    expect(res2?.lng).toBeCloseTo(-0.935, 4);
  });

  it('parses cardinal directional decimal coordinates (e.g., 39.248° N, 0.935° W)', () => {
    const res = parseGpsCoordinates('39.248° N, 0.935° W');
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(39.248, 4);
    expect(res?.lng).toBeCloseTo(-0.935, 4);
  });

  it('parses DMS (degrees minutes seconds) formats', () => {
    // 39° 14' 52.8" N -> 39 + 14/60 + 52.8/3600 = 39.248
    // 0° 56' 06.0" W -> -(0 + 56/60 + 6/3600) = -0.935
    const res = parseGpsCoordinates(`39°14'52.8"N 0°56'06.0"W`);
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(39.248, 3);
    expect(res?.lng).toBeCloseTo(-0.935, 3);
  });

  it('rejects coordinates with latitude out of range (-90 to 90)', () => {
    expect(parseGpsCoordinates('95.123, -0.935')).toBeNull();
    expect(parseGpsCoordinates('-92.123, -0.935')).toBeNull();
  });

  it('rejects coordinates with longitude out of range (-180 to 180)', () => {
    expect(parseGpsCoordinates('39.248, 185.123')).toBeNull();
    expect(parseGpsCoordinates('39.248, -195.123')).toBeNull();
  });

  it('returns null for standard search text or place names', () => {
    expect(parseGpsCoordinates('Embalse de Cortes')).toBeNull();
    expect(parseGpsCoordinates('Valencia')).toBeNull();
    expect(parseGpsCoordinates('River Ebro')).toBeNull();
    expect(parseGpsCoordinates('')).toBeNull();
    expect(parseGpsCoordinates('12345')).toBeNull();
  });
});
