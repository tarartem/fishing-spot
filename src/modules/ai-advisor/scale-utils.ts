import type {
  AnglerFeatureKey,
  BoundingBox,
  ScaleAnalysisMode,
} from '@/shared/types/domain';

export type FeatureCategory = 'structure' | 'transition' | 'ambush_flow';

export interface AnglerFeatureDefinition {
  key: AnglerFeatureKey;
  label: string;
  category: FeatureCategory;
  weight: number;
  isSeasonalOrDynamic: boolean;
  macroVisible: boolean;
  visualSignature: string;
}

/**
 * Single source of truth for the 12 experienced-angler fishing spot features.
 */
export const ANGLER_FEATURE_CATALOG: Record<
  AnglerFeatureKey,
  AnglerFeatureDefinition
> = {
  point: {
    key: 'point',
    label: 'Point',
    category: 'structure',
    weight: 1.25,
    isSeasonalOrDynamic: false,
    macroVisible: true,
    visualSignature: 'Shoreline or underwater peninsula jutting into basin',
  },
  flat: {
    key: 'flat',
    label: 'Flat',
    category: 'structure',
    weight: 0.75,
    isSeasonalOrDynamic: false,
    macroVisible: true,
    visualSignature: 'Broad even-toned shallow feeding shelf or bay',
  },
  drop_off: {
    key: 'drop_off',
    label: 'Drop-off',
    category: 'transition',
    weight: 1.45,
    isSeasonalOrDynamic: false,
    macroVisible: true,
    visualSignature: 'Sharp turquoise/tan-to-navy water depth color break',
  },
  channel: {
    key: 'channel',
    label: 'Channel',
    category: 'structure',
    weight: 1.35,
    isSeasonalOrDynamic: false,
    macroVisible: true,
    visualSignature: 'Continuous dark winding thalweg or main riverbed cut',
  },
  shadow: {
    key: 'shadow',
    label: 'Shadow / Shade',
    category: 'ambush_flow',
    weight: 0.85,
    isSeasonalOrDynamic: true,
    macroVisible: false,
    visualSignature: 'Tree-line, cliff, or bridge shadow cast onto shallow water',
  },
  cover: {
    key: 'cover',
    label: 'Cover',
    category: 'ambush_flow',
    weight: 1.15,
    isSeasonalOrDynamic: false,
    macroVisible: false,
    visualSignature: 'Laydown timber, boulders, flooded brush, docks, or riprap',
  },
  depth_change: {
    key: 'depth_change',
    label: 'Depth Change',
    category: 'transition',
    weight: 1.05,
    isSeasonalOrDynamic: false,
    macroVisible: true,
    visualSignature: 'Stepped contour shelf or gradual tonal depth gradient',
  },
  weed_line: {
    key: 'weed_line',
    label: 'Weed Line',
    category: 'ambush_flow',
    weight: 0.95,
    isSeasonalOrDynamic: true,
    macroVisible: false,
    visualSignature: 'Mottled green/brown submerged aquatic vegetation belt',
  },
  weed_edge: {
    key: 'weed_edge',
    label: 'Weed Edge',
    category: 'transition',
    weight: 1.25,
    isSeasonalOrDynamic: true,
    macroVisible: false,
    visualSignature: 'Distinct boundary where aquatic weed bed meets open water/sand',
  },
  current_break: {
    key: 'current_break',
    label: 'Current Break',
    category: 'ambush_flow',
    weight: 1.25,
    isSeasonalOrDynamic: false,
    macroVisible: true,
    visualSignature: 'Bend, narrow, piling, or point tip deflecting flow into an eddy',
  },
  bottom_transition: {
    key: 'bottom_transition',
    label: 'Bottom Transition',
    category: 'transition',
    weight: 1.05,
    isSeasonalOrDynamic: false,
    macroVisible: false,
    visualSignature: 'Substrate shift between silt/mud, sand/gravel, and rock/limestone',
  },
  multiple_points: {
    key: 'multiple_points',
    label: 'Multiple Points',
    category: 'structure',
    weight: 1.55,
    isSeasonalOrDynamic: false,
    macroVisible: true,
    visualSignature: 'Converging or opposing points/spurs funneling fish movement',
  },
};

export const ALL_ANGLER_FEATURE_KEYS = Object.keys(
  ANGLER_FEATURE_CATALOG
) as AnglerFeatureKey[];

/**
 * Gates which features can be extracted honestly at a given image scale
 * so wide macro shots never hallucinate small vegetation or shadow cover.
 */
export function getAllowedFeaturesForScale(
  scaleMode: ScaleAnalysisMode
): AnglerFeatureKey[] {
  if (scaleMode === 'macro') {
    return ALL_ANGLER_FEATURE_KEYS.filter(
      (key) => ANGLER_FEATURE_CATALOG[key].macroVisible
    );
  }
  return ALL_ANGLER_FEATURE_KEYS;
}

/**
 * Computes physical span (km), ground resolution (m/px on 1024px output),
 * and optimal feature-extraction scale tier (0.30-1.50 km ideal for all 12 features).
 */
export function computeSelectionScale(bbox: BoundingBox): {
  widthKm: number;
  heightKm: number;
  maxSpanKm: number;
  metersPerPixel: number;
  scaleMode: ScaleAnalysisMode;
  scaleLabel: string;
  isOverZoomed: boolean;
  isOptimalScale: boolean;
  scaleAdvice: string;
} {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const heightKm = Math.max(0.1, Math.abs(maxLat - minLat) * 111.32);
  const widthKm = Math.max(
    0.1,
    Math.abs(maxLng - minLng) * 111.32 * Math.cos(centerLatRad)
  );
  const maxSpanKm = Math.max(widthKm, heightKm);
  const metersPerPixel = Number(((maxSpanKm * 1000) / 1024).toFixed(2));
  const isOverZoomed = maxSpanKm < 0.3;
  const isOptimalScale = maxSpanKm >= 0.3 && maxSpanKm <= 1.5;

  let scaleMode: ScaleAnalysisMode = 'micro';
  let scaleLabel = `Optimal Feature Scale (${widthKm.toFixed(1)} km × ${heightKm.toFixed(1)} km · ~${metersPerPixel} m/px)`;
  let scaleAdvice =
    'Optimal 0.3–1.5 km tactical scale: high enough resolution to inspect weed edges, shadows, cover, drop-offs, and shoreline points.';

  if (isOverZoomed) {
    scaleLabel = `Over-Zoomed Detail (${widthKm.toFixed(2)} km × ${heightKm.toFixed(2)} km · ~${metersPerPixel} m/px)`;
    scaleAdvice =
      'Very tight zoom (<0.3 km): road approaches may fall outside frame. Zoom out slightly (0.4–1.5 km) for fuller context.';
  } else if (maxSpanKm > 5.0) {
    scaleMode = 'macro';
    scaleLabel = `Wide Basin Scale (${widthKm.toFixed(1)} km × ${heightKm.toFixed(1)} km · ~${metersPerPixel} m/px)`;
    scaleAdvice =
      'Wide area (>5 km): small features (weed edges, shadows, cover) cannot be resolved reliably; only macro points, channels & drop-offs are evaluated. Zoom to 0.4–1.5 km for full 12-feature extraction.';
  } else if (maxSpanKm > 1.5) {
    scaleMode = 'meso';
    scaleLabel = `Sector Scale (${widthKm.toFixed(1)} km × ${heightKm.toFixed(1)} km · ~${metersPerPixel} m/px)`;
    scaleAdvice =
      'Sector overview (1.5–5 km): strong for points, bays & channels; zoom closer (0.4–1.5 km) for finer weed edges, cover & shadows.';
  }

  return {
    widthKm: Number(widthKm.toFixed(2)),
    heightKm: Number(heightKm.toFixed(2)),
    maxSpanKm: Number(maxSpanKm.toFixed(2)),
    metersPerPixel,
    scaleMode,
    scaleLabel,
    isOverZoomed,
    isOptimalScale,
    scaleAdvice,
  };
}
