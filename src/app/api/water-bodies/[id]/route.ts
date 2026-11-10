import { NextResponse } from 'next/server';
import { getWaterBodyDetailsForTier } from '@/shared/db/store';
import { resolveSessionFromHeaders } from '@/shared/auth/tier-gating';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = resolveSessionFromHeaders(request.headers);

  const details = getWaterBodyDetailsForTier(id, session);
  if (!details) {
    return NextResponse.json(
      { error: 'Water body not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(details);
}
