import { z } from 'zod';
import type {
  AccessMode,
  GridCell,
  SpotRecommendationResponse,
} from '@/shared/types/domain';

export const SpotRecommendationZodSchema = z.object({
  water_body_summary: z.string().min(10),
  restriction_overview: z.object({
    overall_status: z.enum([
      'allowed',
      'permit_required',
      'seasonal_restriction',
      'prohibited',
      'unknown',
    ]),
    warnings: z.array(z.string()),
    disclaimer: z.string().min(10),
    permit_requirements: z.array(z.string()).optional(),
    seasonal_rules: z.array(z.string()).optional(),
  }),
  recommended_spots: z
    .array(
      z.object({
        rank: z.number().int().min(1),
        cell_id: z.string().regex(/^[A-Z][0-9]{1,2}$/),
        coordinates: z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
        title: z.string().min(3),
        confidence_score: z.number().min(0).max(100),
        why_this_spot: z.string().min(10),
        tactical_advice: z.object({
          recommended_baits_or_lures: z.array(z.string()).min(1),
          presentation_tips: z.string().min(5),
          best_time_of_day: z.string().min(3),
        }),
        target_species_fit: z.array(z.string()).min(1),
        restriction_status: z.enum([
          'allowed',
          'permit_required',
          'seasonal_restriction',
          'unknown',
        ]),
      })
    )
    .min(1)
    .max(6),
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that an AI SpotRecommendationResponse conforms to both the Zod/JSON Schema
 * AND the deterministic spatial grid invariants (no hallucinated cells, no prohibited cells,
 * and shore accessibility consistency).
 */
export function validateSpotRecommendation(
  payload: unknown,
  candidateCells: GridCell[],
  accessMode: AccessMode
): ValidationResult {
  const parsed = SpotRecommendationZodSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`
      ),
    };
  }

  const data: SpotRecommendationResponse = parsed.data;
  const errors: string[] = [];
  const cellMap = new Map(candidateCells.map((c) => [c.cellId, c]));

  for (const spot of data.recommended_spots) {
    const cell = cellMap.get(spot.cell_id);
    if (!cell) {
      errors.push(
        `Recommended cell_id "${spot.cell_id}" does not exist in candidate water grid.`
      );
      continue;
    }

    if (cell.restrictionStatus === 'prohibited') {
      errors.push(
        `Recommended cell_id "${spot.cell_id}" is marked prohibited (${cell.restrictionReason ?? 'restricted zone'}).`
      );
    }

    if (accessMode === 'shore' && !cell.shoreAccessible) {
      errors.push(
        `Recommended cell_id "${spot.cell_id}" is not shore-accessible for shore accessMode.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
