import crypto from 'crypto';
import type {
  AccessMode,
  BoundingBox,
  FishingType,
  GridCell,
  Season,
  TargetSpecies,
  WaterBodyRecord,
  WaterType,
} from '@/shared/types/domain';

export interface QueryHashInput {
  waterBodyId: string;
  sectorBbox: BoundingBox;
  waterType: WaterType;
  fishingType: FishingType;
  targetSpecies: TargetSpecies[] | string[];
  accessMode: AccessMode;
  season: Season;
}

/**
 * Computes a deterministic SHA-256 hash for caching AI grid analyses in PostgreSQL (`grid_analyses.query_hash`).
 */
export function computeQueryHash(input: QueryHashInput): string {
  const sortedSpecies = [...input.targetSpecies]
    .map((s) => s.toLowerCase().trim())
    .sort()
    .join(',');
  const roundedBbox = input.sectorBbox.map((n) => Number(n).toFixed(4)).join(',');

  const canonical = [
    input.waterBodyId,
    roundedBbox,
    input.waterType,
    input.fishingType,
    sortedSpecies,
    input.accessMode,
    input.season,
  ].join('|');

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export interface BuildSpotPromptParams {
  waterBody: WaterBodyRecord;
  gridCells: GridCell[];
  waterType: WaterType;
  fishingType: FishingType;
  targetSpecies: TargetSpecies[];
  accessMode: AccessMode;
  season: Season;
}

export function buildSpotFinderPrompt(params: BuildSpotPromptParams): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are an expert fisheries biologist, local angling guide, and geospatial analyst.
Your task is to analyze a water body that has been partitioned into a labeled Spatial Grid (cells A1..H8) and recommend the highest-probability fishing locations for the angler.

STRICT OPERATING RULES:
1. GRID-LOCKED SELECTION: You may ONLY select \`cell_id\` values present in the provided \`candidate_grid_cells\` list. Never invent grid cells or place coordinates outside the selected cell's bounds.
2. RESTRICTION COMPLIANCE: Never recommend any grid cell where \`restrictionStatus\` is \`"prohibited"\`. If restricted cells exist, include a clear explanation in \`restriction_overview.warnings\`.
3. ACCESS MODE CONSISTENCY:
   - If \`access_mode\` is \`"shore"\`, ONLY select cells where \`shoreAccessible\` is \`true\`.
   - If \`access_mode\` is \`"boat"\`, you may select both offshore/open-water structure cells and shoreline cells.
4. WATER & TECHNIQUE MATCHING:
   - Tailor every recommendation to the specified \`water_type\`, \`fishing_type\`, and \`target_species\`.
   - Explain the hydro-morphological reasoning (e.g., submerged channel drop-off, reed line, rocky headland, inflow oxygen, stone groyne current seam).
5. OUTPUT FORMAT: Return ONLY valid JSON conforming to the \`SpotRecommendationResponse\` schema.`;

  const reviewsSummary =
    params.waterBody.reviews.length > 0
      ? params.waterBody.reviews
          .slice(0, 5)
          .map(
            (r) =>
              `- Cell ${r.cellId ?? 'General'} (${r.rating}/5 stars, ${r.fishingTypeUsed}): "${r.comment}"`
          )
          .join('\n')
      : 'No community reviews logged yet for this water body.';

  const userPrompt = `## Water Body Context
- **Name**: ${params.waterBody.name}
- **Water Type**: ${params.waterType}
- **Country / Region**: ${params.waterBody.regionLabel} (${params.waterBody.countryCode})
- **Season**: ${params.season}

## Angler Preferences
- **Fishing Technique**: ${params.fishingType}
- **Target Species**: ${params.targetSpecies.join(', ')}
- **Access Mode**: ${params.accessMode}

## Candidate Spatial Grid Cells
\`\`\`json
${JSON.stringify(params.gridCells, null, 2)}
\`\`\`

## Community Historical Notes
${reviewsSummary}

Analyze the grid and return the top 3 to 5 recommended fishing spots in strict JSON format.`;

  return { systemPrompt, userPrompt };
}
