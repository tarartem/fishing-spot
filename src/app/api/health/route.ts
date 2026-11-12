import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/shared/app-version';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkDb = searchParams.get('check_db') === 'true';

  const healthData: Record<string, unknown> = {
    status: 'ok',
    service: 'fishing-spot',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'production',
  };

  if (checkDb && process.env.DATABASE_URL) {
    try {
      // Light check if DATABASE_URL is configured
      healthData.database = 'configured';
    } catch {
      healthData.database = 'error';
    }
  }

  return NextResponse.json(healthData, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
