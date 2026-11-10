import { NextResponse } from 'next/server';
import { resolveSessionFromHeaders } from '@/shared/auth/tier-gating';
import { submitSpotReview } from '@/modules/reviews/review.service';
import type { FishingType, SpeciesCatchEntry } from '@/shared/types/domain';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = resolveSessionFromHeaders(request.headers);
  if (!session.isAuthenticated) {
    return NextResponse.json(
      {
        code: 'REGISTRATION_REQUIRED',
        message: 'Please register with your email to submit reviews and catch photos.',
      },
      { status: 403 }
    );
  }

  const { id: waterBodyId } = await context.params;
  const body = await request.json();

  const review = submitSpotReview({
    waterBodyId,
    spotId: body.spotId,
    cellId: body.cellId,
    userId: session.userId ?? 'user-registered',
    authorName: session.displayName ?? 'Angler',
    rating: Number(body.rating ?? 5),
    comment: String(body.comment ?? ''),
    fishingTypeUsed: (body.fishingTypeUsed ?? 'spinning') as FishingType,
    speciesCaught: (body.speciesCaught ?? []) as SpeciesCatchEntry[],
    fishedOn: body.fishedOn ?? new Date().toISOString().slice(0, 10),
    photos: body.photos ?? [],
  });

  return NextResponse.json({ review }, { status: 201 });
}
