import { NextResponse } from 'next/server';
import { resolveSessionFromHeaders } from '@/shared/auth/tier-gating';
import { getWaterBodyById } from '@/shared/db/store';
import { applyCommunityRestrictionReport } from '@/modules/restrictions/restriction-service';
import type { RestrictionStatus } from '@/shared/types/domain';

export async function POST(request: Request) {
  const session = resolveSessionFromHeaders(request.headers);
  if (!session.isAuthenticated) {
    return NextResponse.json(
      {
        code: 'REGISTRATION_REQUIRED',
        message: 'Please register with your email to report local fishing restrictions.',
      },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { waterBodyId, cellId, status, reason } = body as {
    waterBodyId: string;
    cellId?: string;
    status: RestrictionStatus;
    reason: string;
  };

  const wb = getWaterBodyById(waterBodyId);
  if (!wb) {
    return NextResponse.json(
      { error: 'Water body not found' },
      { status: 404 }
    );
  }

  wb.restrictionZones = applyCommunityRestrictionReport(wb.restrictionZones, {
    waterBodyId,
    userId: session.userId ?? 'user-registered',
    cellId,
    status,
    reason,
  });

  return NextResponse.json({
    restrictionZones: wb.restrictionZones,
  });
}
