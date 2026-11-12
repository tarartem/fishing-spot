import {
  ANGLER_FEATURE_CATALOG,
  getAllowedFeaturesForScale,
  type FeatureCategory,
} from '@/modules/ai-advisor/scale-utils';
import type {
  AnglerFeatureKey,
  ExtractedSpotFeature,
  GridArtifactSpot,
  ScaleAnalysisMode,
  SpotAccessMode,
  SpotRatingTier,
} from '@/shared/types/domain';

export const IMAGERY_FRESHNESS_NOTE =
  'Satellite imagery is a historical snapshot (updated infrequently). Permanent structures (points, channels, drop-offs) remain reliable, while aquatic weeds, shoreline shadows, and water levels vary by season, drawdown, and time of day.';

const ACCESS_TIE_BREAKER_SCORE: Record<SpotAccessMode, number> = {
  car_asphalt: 4,
  dirt_track: 3,
  hike_in: 2,
  boat_only: 1,
};

function isCanonicalFeatureKey(raw: unknown): raw is AnglerFeatureKey {
  return typeof raw === 'string' && raw in ANGLER_FEATURE_CATALOG;
}

/**
 * Sanitizes, deduplicates, and scale-gates extracted features so macro crops
 * cannot claim unresolvable micro-structures.
 */
export function sanitizeExtractedFeatures(
  rawFeatures: unknown,
  scaleMode: ScaleAnalysisMode
): {
  features: ExtractedSpotFeature[];
  strippedMacroMicroFeatures: AnglerFeatureKey[];
} {
  const allowed = new Set(getAllowedFeaturesForScale(scaleMode));
  const seen = new Set<AnglerFeatureKey>();
  const features: ExtractedSpotFeature[] = [];
  const strippedMacroMicroFeatures: AnglerFeatureKey[] = [];

  if (!Array.isArray(rawFeatures)) {
    return { features, strippedMacroMicroFeatures };
  }

  for (const entry of rawFeatures) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<ExtractedSpotFeature>;
    if (!isCanonicalFeatureKey(candidate.feature)) continue;

    if (!allowed.has(candidate.feature)) {
      if (!strippedMacroMicroFeatures.includes(candidate.feature)) {
        strippedMacroMicroFeatures.push(candidate.feature);
      }
      continue;
    }

    if (seen.has(candidate.feature)) continue;
    seen.add(candidate.feature);

    const def = ANGLER_FEATURE_CATALOG[candidate.feature];
    const observation_type =
      candidate.observation_type === 'topographic_inference'
        ? 'topographic_inference'
        : 'directly_visible';
    const visual_cue =
      typeof candidate.visual_cue === 'string' && candidate.visual_cue.trim().length > 0
        ? candidate.visual_cue.trim()
        : def.visualSignature;

    features.push({
      feature: candidate.feature,
      observation_type,
      visual_cue,
      is_seasonal_or_dynamic: def.isSeasonalOrDynamic,
    });
  }

  return { features, strippedMacroMicroFeatures };
}

export function getRatingTier(
  rating: number,
  featureCount = 1
): SpotRatingTier {
  if (rating >= 8.5) return 'Prime Convergence';
  if (rating >= 6.8) return 'Strong Structure';
  if (rating >= 4.8) return 'Solid Candidate';
  if (featureCount >= 2) return 'Moderate / Inferred Candidate';
  return 'Single-Feature / Limited';
}

/**
 * Computes a deterministic 1.0–10.0 rating and short user-facing justification
 * directly from the validated canonical angler features.
 */
export function evaluateSpotFeaturesAndRating(
  rawFeatures: ExtractedSpotFeature[],
  scaleMode: ScaleAnalysisMode
): {
  features: ExtractedSpotFeature[];
  strippedMacroMicroFeatures: AnglerFeatureKey[];
  rating: number;
  rating_tier: SpotRatingTier;
  rating_justification: string;
} {
  const { features, strippedMacroMicroFeatures } = sanitizeExtractedFeatures(
    rawFeatures,
    scaleMode
  );

  if (features.length === 0) {
    return {
      features: [],
      strippedMacroMicroFeatures,
      rating: 2.0,
      rating_tier: 'Single-Feature / Limited',
      rating_justification:
        'Rated 2.0/10 (Single-Feature / Limited): No distinct structural features could be confirmed at this resolution.',
    };
  }

  let weightedSum = 0;
  const categories = new Set<FeatureCategory>();
  let directlyVisibleCount = 0;
  let inferredCount = 0;
  const seasonalLabels: string[] = [];
  const allLabels: string[] = [];

  for (const item of features) {
    const def = ANGLER_FEATURE_CATALOG[item.feature];
    const obsMultiplier = item.observation_type === 'directly_visible' ? 1.0 : 0.65;
    weightedSum += def.weight * obsMultiplier;
    categories.add(def.category);
    allLabels.push(def.label);

    if (item.observation_type === 'directly_visible') {
      directlyVisibleCount++;
    } else {
      inferredCount++;
    }
    if (def.isSeasonalOrDynamic) {
      seasonalLabels.push(def.label);
    }
  }

  let rawScore = 1.6 + weightedSum * 1.12;
  if (categories.size === 2) rawScore += 0.6;
  if (categories.size >= 3) rawScore += 1.35;

  const hasMultiPoints = features.some(
    (f) => f.feature === 'multiple_points' && f.observation_type === 'directly_visible'
  );
  if (hasMultiPoints && features.length >= 3) {
    rawScore += 0.45;
  }

  // Never inflate single- or dual-feature spots
  if (features.length === 1) {
    rawScore = Math.min(rawScore, 4.5);
  } else if (features.length === 2) {
    rawScore = Math.min(rawScore, 6.8);
  }

  const rating = Number(Math.max(1.0, Math.min(10.0, rawScore)).toFixed(1));
  const rating_tier = getRatingTier(rating, features.length);

  const featureSummary = allLabels.join(', ');
  const obsSummary =
    inferredCount > 0 && directlyVisibleCount > 0
      ? ` (${directlyVisibleCount} visible, ${inferredCount} inferred from terrain)`
      : inferredCount === features.length
        ? ' (inferred from shoreline/channel geometry)'
        : '';
  const seasonalCaveat =
    seasonalLabels.length > 0
      ? ` Note: ${seasonalLabels.join('/')} are seasonal in static satellite imagery — verify on site.`
      : '';

  const rating_justification = `Rated ${rating.toFixed(1)}/10 (${rating_tier}): Stacks ${features.length} feature${features.length > 1 ? 's' : ''} — ${featureSummary}${obsSummary}.${seasonalCaveat}`;

  return {
    features,
    strippedMacroMicroFeatures,
    rating,
    rating_tier,
    rating_justification,
  };
}

/**
 * Evaluates all spots deterministically, sorts them descending by rating,
 * reassigns rank (1..N) and color, and keeps legacy stacking fields in sync.
 */
export function rankAndRateSpots(
  spots: GridArtifactSpot[],
  scaleMode: ScaleAnalysisMode
): {
  ratedSpots: GridArtifactSpot[];
  limitations: string[];
  inventory: AnglerFeatureKey[];
} {
  const strippedSet = new Set<AnglerFeatureKey>();
  const inventorySet = new Set<AnglerFeatureKey>();

  const evaluated = spots.map((spot) => {
    const initialFeatures =
      spot.extracted_features && spot.extracted_features.length > 0
        ? spot.extracted_features
        : inferConservativeMacroFallbackFeatures(spot);

    const result = evaluateSpotFeaturesAndRating(initialFeatures, scaleMode);
    for (const removed of result.strippedMacroMicroFeatures) {
      strippedSet.add(removed);
    }
    for (const kept of result.features) {
      inventorySet.add(kept.feature);
    }

    const directlyVisibleCount = result.features.filter(
      (f) => f.observation_type === 'directly_visible'
    ).length;

    return {
      spot,
      result,
      directlyVisibleCount,
    };
  });

  evaluated.sort((a, b) => {
    if (b.result.rating !== a.result.rating) {
      return b.result.rating - a.result.rating;
    }
    if (b.directlyVisibleCount !== a.directlyVisibleCount) {
      return b.directlyVisibleCount - a.directlyVisibleCount;
    }
    return (
      (ACCESS_TIE_BREAKER_SCORE[b.spot.access_mode] ?? 0) -
      (ACCESS_TIE_BREAKER_SCORE[a.spot.access_mode] ?? 0)
    );
  });

  const ratedSpots: GridArtifactSpot[] = evaluated.map(({ spot, result }, idx) => {
    const rank = idx + 1;
    const color = rank <= 2 ? 'green' : rank <= 4 ? 'blue' : 'yellow';
    const featureLabels = result.features.map(
      (f) => ANGLER_FEATURE_CATALOG[f.feature].label
    );
    const stacked_x_count = Math.max(1, Math.min(5, result.features.length));
    const whyBullets =
      spot.why_rank_summary && spot.why_rank_summary.length > 0
        ? spot.why_rank_summary
        : result.features.slice(0, 4).map((f) => {
            const def = ANGLER_FEATURE_CATALOG[f.feature];
            const tag =
              f.observation_type === 'topographic_inference' ? 'Inferred' : 'Visible';
            return `${def.label} (${tag}): ${f.visual_cue}`;
          });

    return {
      ...spot,
      rank,
      color,
      extracted_features: result.features,
      rating: result.rating,
      rating_tier: result.rating_tier,
      rating_justification: result.rating_justification,
      stacked_x_count,
      influencing_features:
        featureLabels.length > 0 ? featureLabels : spot.influencing_features,
      why_rank_summary: whyBullets,
    };
  });

  const limitations: string[] = [];
  if (strippedSet.size > 0) {
    const removedLabels = Array.from(strippedSet).map(
      (k) => ANGLER_FEATURE_CATALOG[k].label
    );
    limitations.push(
      `Wide macro scale (>5 km) cannot resolve small features (${removedLabels.join(', ')}); zoomed-out evaluation is limited to macro structures. Zoom to 0.4–1.5 km for full 12-feature extraction.`
    );
  } else if (scaleMode === 'meso') {
    limitations.push(
      'Sector scale (1.5–5 km) may miss fine shoreline cover, shadows, or narrow weed edges. Zoom to 0.4–1.5 km for maximum detail.'
    );
  }

  return {
    ratedSpots,
    limitations,
    inventory: Array.from(inventorySet),
  };
}

function inferConservativeMacroFallbackFeatures(
  spot: GridArtifactSpot
): ExtractedSpotFeature[] {
  const text = `${spot.title} ${spot.depth_structure} ${spot.why_this_spot}`.toLowerCase();
  const inferred: ExtractedSpotFeature[] = [];
  const add = (feature: AnglerFeatureKey, cue: string) => {
    if (!inferred.some((f) => f.feature === feature)) {
      inferred.push({
        feature,
        observation_type: 'topographic_inference',
        visual_cue: cue,
        is_seasonal_or_dynamic: ANGLER_FEATURE_CATALOG[feature].isSeasonalOrDynamic,
      });
    }
  };

  if (/point|peninsula|tip/.test(text)) add('point', 'Shoreline point contour in water mask');
  if (/drop|shelf|ledge|steep/.test(text)) add('drop_off', 'Shoreline-to-basin depth gradient');
  if (/channel|thalweg|canyon/.test(text)) add('channel', 'Primary water channel geometry');
  if (/flat|beach|gravel|shallow/.test(text)) add('flat', 'Low-slope shallow shoreline sector');
  if (/current|bend|narrow|seam|eddy/.test(text)) add('current_break', 'Flow deflection at channel bend/narrow');

  if (inferred.length === 0) {
    add('depth_change', 'General bank-to-basin contour change');
  }
  return inferred;
}
