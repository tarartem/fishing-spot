import type { BoundingBox, ClientWaterMaskSummary } from '@/shared/types/domain';

const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const RASTER_SIZE = 128;
export const GRID64_SIZE = 64;

function toCellIdFromPercent(xPercent: number, yPercent: number): string {
  const colIdx = Math.max(0, Math.min(7, Math.floor((xPercent / 100) * 8)));
  const rowNum = Math.max(1, Math.min(8, Math.floor((yPercent / 100) * 8) + 1));
  return `${COL_LABELS[colIdx]}${rowNum}`;
}

export function lngToTileXFloat(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z);
}

export function latToTileYFloat(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, z)
  );
}

/**
 * Computes OSM Standard water tile grid coverage for `bbox`.
 * Uses zoom levels 12..16 targeting <= 4 tiles wide for fast, low-bandwidth fetches.
 */
export function computeWaterMaskTileRange(bbox: BoundingBox): {
  z: number;
  xMinF: number;
  xMaxF: number;
  yMinF: number;
  yMaxF: number;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
} | null {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngSpan = Math.max(1e-5, maxLng - minLng);
  const idealZoom = Math.round(Math.log2((360 / lngSpan) * 2));
  const z = Math.max(12, Math.min(16, idealZoom));
  const maxIdx = Math.pow(2, z) - 1;

  const xMinF = lngToTileXFloat(minLng, z);
  const xMaxF = lngToTileXFloat(maxLng, z);
  const yMinF = latToTileYFloat(maxLat, z);
  const yMaxF = latToTileYFloat(minLat, z);

  const xStart = Math.max(0, Math.floor(xMinF));
  const xEnd = Math.min(maxIdx, Math.floor(xMaxF));
  const yStart = Math.max(0, Math.floor(yMinF));
  const yEnd = Math.min(maxIdx, Math.floor(yMaxF));

  if ((xEnd - xStart + 1) * (yEnd - yStart + 1) > 16) {
    return null;
  }

  return { z, xMinF, xMaxF, yMinF, yMaxF, xStart, xEnd, yStart, yEnd };
}

function isOsmWaterColor(r: number, g: number, b: number, a: number): boolean {
  if (a < 200) return false;
  // Standard OSM Carto water fill is #aad3df (170, 211, 223)
  const matchesCartoWater =
    Math.abs(r - 170) <= 14 &&
    Math.abs(g - 211) <= 14 &&
    Math.abs(b - 223) <= 14 &&
    b - r >= 35 &&
    g - r >= 25;
  if (matchesCartoWater) return true;

  // Narrow antialiased cyan-blue shoreline transition pixels (excludes darker highway shields/labels)
  return (
    r >= 145 &&
    r <= 184 &&
    g >= 190 &&
    g <= 224 &&
    b >= 208 &&
    b <= 238 &&
    b - r >= 42 &&
    g - r >= 30
  );
}

/**
 * Converts a 128x128 RGBA OSM tile buffer strictly bounded to `bbox` into a compact
 * 64x64 binary water bitmap, allowed cell list (`A1..H8`), and water coverage percentage.
 */
export function buildWaterMaskFromRgba128(
  rgba: Uint8ClampedArray | Uint8Array
): ClientWaterMaskSummary {
  const rawWater = new Uint8Array(RASTER_SIZE * RASTER_SIZE);
  for (let i = 0; i < RASTER_SIZE * RASTER_SIZE; i++) {
    const off = i * 4;
    if (isOsmWaterColor(rgba[off], rgba[off + 1], rgba[off + 2], rgba[off + 3])) {
      rawWater[i] = 1;
    }
  }

  // 3x3 neighborhood filter: removes 1px non-fishable seasonal creeks/icons while retaining rivers & lakes
  const clustered = new Uint8Array(RASTER_SIZE * RASTER_SIZE);
  for (let y = 0; y < RASTER_SIZE; y++) {
    for (let x = 0; x < RASTER_SIZE; x++) {
      if (!rawWater[y * RASTER_SIZE + x]) continue;
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < RASTER_SIZE && nx >= 0 && nx < RASTER_SIZE) {
            neighbors += rawWater[ny * RASTER_SIZE + nx];
          }
        }
      }
      if (neighbors >= 3) {
        clustered[y * RASTER_SIZE + x] = 1;
      }
    }
  }

  // Connected-component size filter on 128x128: retains lakes/reservoirs (area >= 45 px)
  // and continuous rivers (span >= 24 px & area >= 22 px), discarding swimming pools,
  // concrete farm irrigation tanks (balsas), and dotted intermittent creeks.
  const visited = new Uint8Array(RASTER_SIZE * RASTER_SIZE);
  const filteredWater = new Uint8Array(RASTER_SIZE * RASTER_SIZE);
  const compIndices: number[] = [];

  for (let i = 0; i < RASTER_SIZE * RASTER_SIZE; i++) {
    if (!clustered[i] || visited[i]) continue;
    compIndices.length = 0;
    const queue: number[] = [i];
    visited[i] = 1;

    let minX = RASTER_SIZE;
    let maxX = 0;
    let minY = RASTER_SIZE;
    let maxY = 0;

    while (queue.length > 0) {
      const cur = queue.pop()!;
      compIndices.push(cur);
      const cx = cur % RASTER_SIZE;
      const cy = (cur - cx) / RASTER_SIZE;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < RASTER_SIZE && ny >= 0 && ny < RASTER_SIZE) {
            const ni = ny * RASTER_SIZE + nx;
            if (clustered[ni] && !visited[ni]) {
              visited[ni] = 1;
              queue.push(ni);
            }
          }
        }
      }
    }

    const area = compIndices.length;
    const span = Math.max(maxX - minX + 1, maxY - minY + 1);
    const isFishableComponent = area >= 45 || (span >= 24 && area >= 22);
    if (isFishableComponent) {
      for (const idx of compIndices) {
        filteredWater[idx] = 1;
      }
    }
  }

  // Downsample 128x128 -> 64x64 bitmap ('1' if >= 2 of 2x2 pixels are filtered water)
  const chars: string[] = new Array(GRID64_SIZE * GRID64_SIZE);
  let water64Count = 0;
  const cellCounts = new Map<string, number>();
  const cellBestSample = new Map<
    string,
    { x_percent: number; y_percent: number; score: number }
  >();

  for (let gy = 0; gy < GRID64_SIZE; gy++) {
    for (let gx = 0; gx < GRID64_SIZE; gx++) {
      const rx = gx * 2;
      const ry = gy * 2;
      const blockSum =
        filteredWater[ry * RASTER_SIZE + rx] +
        filteredWater[ry * RASTER_SIZE + rx + 1] +
        filteredWater[(ry + 1) * RASTER_SIZE + rx] +
        filteredWater[(ry + 1) * RASTER_SIZE + rx + 1];
      const isWater = blockSum >= 2;
      chars[gy * GRID64_SIZE + gx] = isWater ? '1' : '0';

      if (isWater) {
        water64Count++;
        const xPct = Number((((gx + 0.5) / GRID64_SIZE) * 100).toFixed(1));
        const yPct = Number((((gy + 0.5) / GRID64_SIZE) * 100).toFixed(1));
        const cellId = toCellIdFromPercent(xPct, yPct);
        cellCounts.set(cellId, (cellCounts.get(cellId) ?? 0) + 1);

        // Compute interior water score (higher = further from land edge and grid lines, safe pin placement)
        let interiorScore = blockSum;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = Math.max(0, Math.min(RASTER_SIZE - 1, ry + dy));
            const nx = Math.max(0, Math.min(RASTER_SIZE - 1, rx + dx));
            interiorScore += filteredWater[ny * RASTER_SIZE + nx];
          }
        }
        const subX = gx % 8;
        const subY = gy % 8;
        if (subX >= 1 && subX <= 6 && subY >= 1 && subY <= 6) {
          interiorScore += 3;
        }
        if (subX >= 2 && subX <= 5 && subY >= 2 && subY <= 5) {
          interiorScore += 1;
        }
        const prevBest = cellBestSample.get(cellId);
        if (!prevBest || interiorScore > prevBest.score) {
          cellBestSample.set(cellId, {
            x_percent: xPct,
            y_percent: yPct,
            score: interiorScore,
          });
        }
      }
    }
  }

  const waterCells: string[] = [];
  const sampledWaterPoints: ClientWaterMaskSummary['sampledWaterPoints'] = [];

  for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
    for (let colIdx = 0; colIdx < 8; colIdx++) {
      const cellId = `${COL_LABELS[colIdx]}${rowIdx + 1}`;
      const sample = cellBestSample.get(cellId);
      const count = cellCounts.get(cellId) ?? 0;
      // Require meaningful interior water presence (>= 3 blocks or solid interior score >= 11)
      if (count >= 3 || (count >= 2 && (sample?.score ?? 0) >= 11)) {
        waterCells.push(cellId);
        if (sample) {
          sampledWaterPoints.push({
            x_percent: sample.x_percent,
            y_percent: sample.y_percent,
            cell_id: cellId,
          });
        }
      }
    }
  }

  return {
    waterCoveragePct: Number(((water64Count / (GRID64_SIZE * GRID64_SIZE)) * 100).toFixed(2)),
    waterCells,
    sampledWaterPoints,
    grid64Mask: chars.join(''),
  };
}

export function isPercentOnRasterWater(
  grid64Mask: string | undefined,
  xPercent: number,
  yPercent: number,
  neighborRadius = 0
): boolean {
  if (!grid64Mask || grid64Mask.length !== GRID64_SIZE * GRID64_SIZE) return false;
  const gx = Math.max(0, Math.min(GRID64_SIZE - 1, Math.floor((xPercent / 100) * GRID64_SIZE)));
  const gy = Math.max(0, Math.min(GRID64_SIZE - 1, Math.floor((yPercent / 100) * GRID64_SIZE)));

  for (let dy = -neighborRadius; dy <= neighborRadius; dy++) {
    for (let dx = -neighborRadius; dx <= neighborRadius; dx++) {
      const ny = gy + dy;
      const nx = gx + dx;
      if (
        ny >= 0 &&
        ny < GRID64_SIZE &&
        nx >= 0 &&
        nx < GRID64_SIZE &&
        grid64Mask[ny * GRID64_SIZE + nx] === '1'
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Finds the nearest water pixel in `grid64Mask` to `(xPercent, yPercent)`, avoiding coordinates
 * too close to already-placed pins (`usedCoords`) when alternate water exists.
 */
export function snapPercentToRasterWater(
  xPercent: number,
  yPercent: number,
  grid64Mask: string | undefined,
  usedCoords: Array<{ x: number; y: number }> = []
): { x_percent: number; y_percent: number; cell_id: string } | null {
  if (!grid64Mask || grid64Mask.length !== GRID64_SIZE * GRID64_SIZE) return null;

  let bestAny: { x: number; y: number; dist: number } | null = null;
  let bestNonOverlapping: { x: number; y: number; dist: number } | null = null;

  for (let gy = 1; gy < GRID64_SIZE - 1; gy++) {
    for (let gx = 1; gx < GRID64_SIZE - 1; gx++) {
      if (grid64Mask[gy * GRID64_SIZE + gx] !== '1') continue;
      const wx = ((gx + 0.5) / GRID64_SIZE) * 100;
      const wy = ((gy + 0.5) / GRID64_SIZE) * 100;
      const dist = Math.hypot(wx - xPercent, wy - yPercent);

      // Prefer interior water pixels away from dry edges and cell grid boundaries
      const hasAllCardinals =
        grid64Mask[gy * GRID64_SIZE + gx - 1] === '1' &&
        grid64Mask[gy * GRID64_SIZE + gx + 1] === '1' &&
        grid64Mask[(gy - 1) * GRID64_SIZE + gx] === '1' &&
        grid64Mask[(gy + 1) * GRID64_SIZE + gx] === '1';
      const subX = gx % 8;
      const subY = gy % 8;
      const nearGridLine = subX === 0 || subX === 7 || subY === 0 || subY === 7;
      const weightedDist = dist + (hasAllCardinals ? 0 : 1.5) + (nearGridLine ? 2.2 : 0);

      if (!bestAny || weightedDist < bestAny.dist) {
        bestAny = { x: wx, y: wy, dist: weightedDist };
      }

      const tooClose = usedCoords.some((p) => Math.hypot(p.x - wx, p.y - wy) < 6.5);
      if (!tooClose && (!bestNonOverlapping || weightedDist < bestNonOverlapping.dist)) {
        bestNonOverlapping = { x: wx, y: wy, dist: weightedDist };
      }
    }
  }

  const chosen = bestNonOverlapping ?? bestAny;
  if (!chosen) return null;

  const rx = Number(Math.max(3, Math.min(97, chosen.x)).toFixed(1));
  const ry = Number(Math.max(3, Math.min(97, chosen.y)).toFixed(1));
  return {
    x_percent: rx,
    y_percent: ry,
    cell_id: toCellIdFromPercent(rx, ry),
  };
}

/**
 * Browser-side HTML5 Canvas fetcher: stitches OSM Standard water tiles onto an offscreen
 * 128x128 canvas (nearest-neighbor smoothing disabled to preserve exact water palette).
 */
export async function fetchClientOsmWaterMask(
  bbox: BoundingBox
): Promise<ClientWaterMaskSummary | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  const range = computeWaterMaskTileRange(bbox);
  if (!range) return null;

  const canvas = document.createElement('canvas');
  canvas.width = RASTER_SIZE;
  canvas.height = RASTER_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;

  const tileGridW = Math.max(1e-6, range.xMaxF - range.xMinF);
  const tileGridH = Math.max(1e-6, range.yMaxF - range.yMinF);

  const loadTile = (tx: number, ty: number) =>
    new Promise<{ tx: number; ty: number; img: HTMLImageElement | null }>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = window.setTimeout(() => resolve({ tx, ty, img: null }), 1200);
      img.onload = () => {
        window.clearTimeout(timer);
        resolve({ tx, ty, img });
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        resolve({ tx, ty, img: null });
      };
      img.src = `https://tile.openstreetmap.org/${range.z}/${tx}/${ty}.png`;
    });

  const jobs: Promise<{ tx: number; ty: number; img: HTMLImageElement | null }>[] = [];
  for (let tx = range.xStart; tx <= range.xEnd; tx++) {
    for (let ty = range.yStart; ty <= range.yEnd; ty++) {
      jobs.push(loadTile(tx, ty));
    }
  }

  const results = await Promise.all(jobs);
  let drawn = 0;
  for (const { tx, ty, img } of results) {
    if (!img) continue;
    const dx = ((tx - range.xMinF) / tileGridW) * RASTER_SIZE;
    const dy = ((ty - range.yMinF) / tileGridH) * RASTER_SIZE;
    const dw = (1 / tileGridW) * RASTER_SIZE;
    const dh = (1 / tileGridH) * RASTER_SIZE;
    ctx.drawImage(img, dx, dy, dw + 0.5, dh + 0.5);
    drawn++;
  }

  if (drawn === 0 || drawn < Math.ceil(results.length * 0.6)) return null;

  try {
    const imgData = ctx.getImageData(0, 0, RASTER_SIZE, RASTER_SIZE).data;
    return buildWaterMaskFromRgba128(imgData);
  } catch {
    return null;
  }
}
