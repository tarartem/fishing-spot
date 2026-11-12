import { inflateSync } from 'zlib';
import {
  buildWaterMaskFromRgba128,
  computeWaterMaskTileRange,
  RASTER_SIZE,
} from '@/modules/ai-advisor/osm-tile-water-mask';
import type { BoundingBox, ClientWaterMaskSummary } from '@/shared/types/domain';

interface DecodedPngTile {
  width: number;
  height: number;
  rgba: Uint8Array;
}

function decodePngBufferServer(buf: Buffer): DecodedPngTile | null {
  if (buf.length < 24 || buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    return null;
  }

  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 0;
  let palette: Buffer | null = null;
  const idats: Buffer[] = [];

  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8 || (colorType !== 3 && colorType !== 2 && colorType !== 6)) {
        return null;
      }
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  if (!width || !height || idats.length === 0) return null;
  const bpp = colorType === 3 ? 1 : colorType === 2 ? 3 : 4;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idats));
  if (raw.length < height * (stride + 1)) return null;

  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (1 + stride)];
    const rowIn = y * (1 + stride) + 1;
    const rowOut = y * stride;
    for (let x = 0; x < stride; x++) {
      const val = raw[rowIn + x];
      const a = x >= bpp ? px[rowOut + x - bpp] : 0;
      const b = y > 0 ? px[rowOut - stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[rowOut - stride + x - bpp] : 0;
      if (ft === 0) px[rowOut + x] = val;
      else if (ft === 1) px[rowOut + x] = (val + a) & 255;
      else if (ft === 2) px[rowOut + x] = (val + b) & 255;
      else if (ft === 3) px[rowOut + x] = (val + ((a + b) >> 1)) & 255;
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        px[rowOut + x] = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  if (colorType === 3) {
    if (!palette) return null;
    for (let i = 0; i < width * height; i++) {
      const idx = px[i] * 3;
      rgba[i * 4] = palette[idx] ?? 0;
      rgba[i * 4 + 1] = palette[idx + 1] ?? 0;
      rgba[i * 4 + 2] = palette[idx + 2] ?? 0;
      rgba[i * 4 + 3] = 255;
    }
  } else if (colorType === 2) {
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = px[i * 3];
      rgba[i * 4 + 1] = px[i * 3 + 1];
      rgba[i * 4 + 2] = px[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
  } else {
    rgba.set(px);
  }

  return { width, height, rgba };
}

/**
 * Server-only Node fallback: fetches OSM Standard PNG tiles for `bbox`, decodes them cleanly
 * via `zlib`, samples onto 128x128 RGBA, and computes the shared raster water mask.
 */
export async function fetchServerOsmWaterMask(
  bbox: BoundingBox
): Promise<ClientWaterMaskSummary | null> {
  if (typeof window !== 'undefined') return null;

  const range = computeWaterMaskTileRange(bbox);
  if (!range) return null;

  const tiles = new Map<string, DecodedPngTile>();
  const fetches: Promise<void>[] = [];

  for (let tx = range.xStart; tx <= range.xEnd; tx++) {
    for (let ty = range.yStart; ty <= range.yEnd; ty++) {
      fetches.push(
        (async () => {
          try {
            const res = await fetch(
              `https://tile.openstreetmap.org/${range.z}/${tx}/${ty}.png`,
              {
                headers: { 'User-Agent': 'FishingSpotAI-SpainMVP/1.0' },
                signal: AbortSignal.timeout(2500),
              }
            );
            if (!res.ok) return;
            const decoded = decodePngBufferServer(
              Buffer.from(await res.arrayBuffer())
            );
            if (decoded) {
              tiles.set(`${tx}:${ty}`, decoded);
            }
          } catch {
            // Skip failed tile
          }
        })()
      );
    }
  }

  await Promise.all(fetches);
  const expectedTiles =
    (range.xEnd - range.xStart + 1) * (range.yEnd - range.yStart + 1);
  if (tiles.size === 0 || tiles.size < Math.ceil(expectedTiles * 0.6)) return null;

  const rgba128 = new Uint8Array(RASTER_SIZE * RASTER_SIZE * 4);
  const tileGridW = Math.max(1e-6, range.xMaxF - range.xMinF);
  const tileGridH = Math.max(1e-6, range.yMaxF - range.yMinF);

  for (let ry = 0; ry < RASTER_SIZE; ry++) {
    const tfY = range.yMinF + ((ry + 0.5) / RASTER_SIZE) * tileGridH;
    const ty = Math.floor(tfY);
    const localYRatio = tfY - ty;

    for (let rx = 0; rx < RASTER_SIZE; rx++) {
      const tfX = range.xMinF + ((rx + 0.5) / RASTER_SIZE) * tileGridW;
      const tx = Math.floor(tfX);
      const localXRatio = tfX - tx;

      const tile = tiles.get(`${tx}:${ty}`);
      if (!tile) continue;

      const pxX = Math.max(0, Math.min(tile.width - 1, Math.floor(localXRatio * tile.width)));
      const pxY = Math.max(0, Math.min(tile.height - 1, Math.floor(localYRatio * tile.height)));
      const srcOff = (pxY * tile.width + pxX) * 4;
      const dstOff = (ry * RASTER_SIZE + rx) * 4;
      rgba128[dstOff] = tile.rgba[srcOff];
      rgba128[dstOff + 1] = tile.rgba[srcOff + 1];
      rgba128[dstOff + 2] = tile.rgba[srcOff + 2];
      rgba128[dstOff + 3] = tile.rgba[srcOff + 3];
    }
  }

  return buildWaterMaskFromRgba128(rgba128);
}
