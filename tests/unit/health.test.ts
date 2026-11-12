import { describe, it, expect } from 'vitest';
import { GET, HEAD } from '@/app/api/health/route';
import { APP_VERSION } from '@/shared/app-version';

describe('GET /api/health', () => {
  it('returns status ok, version, uptime, and cache-control headers', async () => {
    const req = new Request('http://localhost:3000/api/health');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('fishing-spot');
    expect(data.version).toBe(APP_VERSION);
    expect(typeof data.timestamp).toBe('string');
    expect(typeof data.uptimeSeconds).toBe('number');
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('HEAD /api/health returns 200 with empty body', async () => {
    const res = await HEAD();
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});
