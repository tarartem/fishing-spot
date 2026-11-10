import type {
  CatchPhotoItem,
  FishingType,
  SpeciesCatchEntry,
  SpotReviewItem,
} from '@/shared/types/domain';
import { getWaterBodyById } from '@/shared/db/store';

export interface SubmitReviewInput {
  waterBodyId: string;
  spotId?: string;
  cellId?: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
  fishingTypeUsed: FishingType;
  speciesCaught: SpeciesCatchEntry[];
  fishedOn: string;
  photos?: Omit<CatchPhotoItem, 'id'>[];
}

/**
 * Attaches an angler review, star rating, caught species log, and compressed WebP photos
 * to a Water Body Pin (and optional Grid Spot Pin), updating aggregate ratings.
 */
export function submitSpotReview(input: SubmitReviewInput): SpotReviewItem {
  const wb = getWaterBodyById(input.waterBodyId);
  if (!wb) {
    throw new Error(`Water body "${input.waterBodyId}" not found.`);
  }

  const clampedRating = Math.max(1, Math.min(5, Math.round(input.rating)));

  const photos: CatchPhotoItem[] = (input.photos ?? []).map((p, idx) => ({
    id: `photo-${Date.now()}-${idx}`,
    storagePath: p.storagePath,
    publicUrl: p.publicUrl,
    photoType: p.photoType,
  }));

  const newReview: SpotReviewItem = {
    id: `rev-${Date.now()}`,
    waterBodyId: input.waterBodyId,
    spotId: input.spotId,
    cellId: input.cellId?.toUpperCase(),
    userId: input.userId,
    authorName: input.authorName,
    rating: clampedRating,
    comment: input.comment.trim(),
    fishingTypeUsed: input.fishingTypeUsed,
    speciesCaught: input.speciesCaught,
    fishedOn: input.fishedOn,
    createdAt: new Date().toISOString(),
    photos,
  };

  wb.reviews.unshift(newReview);

  // Recalculate water body rating
  const totalCount = wb.reviews.length;
  const sumRatings = wb.reviews.reduce((acc, r) => acc + r.rating, 0);
  wb.reviewCount = totalCount;
  wb.avgRating = Number((sumRatings / totalCount).toFixed(1));

  // Update specific spot pin rating if associated
  if (input.spotId || input.cellId) {
    const spot = wb.preSeededSpots.find(
      (s) => s.id === input.spotId || s.cell_id === input.cellId?.toUpperCase()
    );
    if (spot) {
      const prevCount = spot.review_count ?? 1;
      const prevAvg = spot.avg_rating ?? wb.avgRating;
      const nextCount = prevCount + 1;
      spot.review_count = nextCount;
      spot.avg_rating = Number(
        ((prevAvg * prevCount + clampedRating) / nextCount).toFixed(1)
      );
    }
  }

  return newReview;
}
