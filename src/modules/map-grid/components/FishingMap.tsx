'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import type {
  BoundingBox,
  GridCell,
  MapStyleMode,
  RecommendedSpot,
  SpotCategory,
  WaterBodyPinSummary,
} from '@/shared/types/domain';
import type { WaterBodyTierResponse } from '@/shared/db/store';

interface FishingMapProps {
  mapStyle: MapStyleMode;
  onChangeMapStyle: (style: MapStyleMode) => void;
  waterBodyPins: WaterBodyPinSummary[];
  selectedWaterBodyId: string | null;
  selectedDetails: WaterBodyTierResponse | null;
  activeSpots: RecommendedSpot[];
  selectedCellId: string | null;
  onSelectWaterBody: (id: string) => void;
  onSelectGridCell: (cell: GridCell) => void;
}

const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
const ROW_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function getMapStyleConfig(mode: MapStyleMode): string | StyleSpecification {
  if (mode === 'plain') {
    return 'https://tiles.openfreemap.org/styles/liberty';
  }
  if (mode === 'terrain') {
    return {
      version: 8,
      sources: {
        opentopo: {
          type: 'raster',
          tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenTopoMap (CC-BY-SA)',
        },
      },
      layers: [
        {
          id: 'opentopo-layer',
          type: 'raster',
          source: 'opentopo',
          minzoom: 0,
          maxzoom: 17,
        },
      ],
    };
  }
  // Default: Satellite (ESRI World Imagery free tiles)
  return {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '© Esri World Imagery',
      },
    },
    layers: [
      {
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

export function getSpotCircleColorClass(
  category: SpotCategory | undefined,
  rank: number
): string {
  if (category === 'primary_hot' || (!category && rank <= 2)) {
    return 'bg-[#ef4444] text-white border-slate-950'; // Red circle (1, 2)
  }
  if (category === 'shore_cove' || (!category && (rank === 3 || rank === 4))) {
    return 'bg-[#38bdf8] text-slate-950 border-slate-950'; // Light Blue circle (3, 4)
  }
  return 'bg-[#f59e0b] text-slate-950 border-slate-950'; // Amber/Orange circle (5, 6)
}

function getSpotRelativePosition(
  spot: RecommendedSpot,
  sectorBbox: BoundingBox
): { leftPercent: number; topPercent: number } {
  const [minLng, minLat, maxLng, maxLat] = sectorBbox;
  const lngRatio = (spot.coordinates.longitude - minLng) / (maxLng - minLng || 1);
  const latRatio = (maxLat - spot.coordinates.latitude) / (maxLat - minLat || 1);

  return {
    leftPercent: Math.max(6, Math.min(94, lngRatio * 100)),
    topPercent: Math.max(6, Math.min(94, latRatio * 100)),
  };
}

export function FishingMap({
  mapStyle,
  onChangeMapStyle,
  waterBodyPins,
  selectedWaterBodyId,
  selectedDetails,
  activeSpots,
  selectedCellId,
  onSelectWaterBody,
  onSelectGridCell,
}: FishingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Initialize MapLibre GL JS
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getMapStyleConfig(mapStyle),
        center: [-0.75, 39.25], // Default centered near Valencia, Spain
        zoom: 7.5,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true }),
        'bottom-right'
      );
      mapRef.current = map;
    } catch {
      // Headless environment fallback handled gracefully
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Map Style when user switches between Satellite, Terrain, and Plain
  useEffect(() => {
    if (!mapRef.current) return;
    try {
      mapRef.current.setStyle(getMapStyleConfig(mapStyle));
    } catch {
      // Ignore in headless environment
    }
  }, [mapStyle]);

  // Render real geospatial markers on the MapLibre canvas at each water body's [centerLng, centerLat]
  useEffect(() => {
    if (!mapRef.current) return;

    for (const m of markersRef.current) {
      m.remove();
    }
    markersRef.current = [];

    try {
      for (const pin of waterBodyPins) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className =
          'flex items-center gap-1.5 rounded-full border-2 border-white bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xl hover:bg-emerald-500 cursor-pointer transition-transform hover:scale-105';
        el.innerHTML = `<span>📍 ${pin.name}</span><span class="rounded bg-black/40 px-1 text-[10px] text-amber-300">★${pin.avgRating.toFixed(1)}</span>`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectWaterBody(pin.id);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([pin.centerLng, pin.centerLat])
          .addTo(mapRef.current!);
        markersRef.current.push(marker);
      }
    } catch {
      // Ignore in headless environment
    }
  }, [waterBodyPins, onSelectWaterBody]);

  // Fly to selected water body when clicked
  useEffect(() => {
    if (!mapRef.current || !selectedDetails) return;
    try {
      const [minLng, minLat, maxLng, maxLat] =
        selectedDetails.grid?.sectorBbox ?? selectedDetails.waterBody.bbox;
      mapRef.current.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: { top: 90, bottom: 40, left: 40, right: 480 }, duration: 900 }
      );
    } catch {
      // Ignore in headless environment
    }
  }, [selectedDetails]);

  const handleFlyToRegion = (lng: number, lat: number, zoom: number) => {
    if (!mapRef.current) return;
    try {
      mapRef.current.flyTo({ center: [lng, lat], zoom, duration: 850 });
    } catch {
      // Ignore
    }
  };

  const gridCells = selectedDetails?.grid?.cells ?? [];
  const waterCellById = new Map(gridCells.map((c) => [c.cellId, c]));
  const sectorBbox: BoundingBox =
    selectedDetails?.grid?.sectorBbox ??
    selectedDetails?.waterBody.bbox ?? [-0.972, 39.222, -0.92, 39.262];

  return (
    <div className="relative h-full w-full select-none bg-[#071722]">
      {/* MapLibre GL JS Canvas */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 h-full w-full"
        data-testid="map-canvas"
      />

      {/* Overlay Layer: Map Style Switcher, Quick Region Explorer, Water Body Pins, and Registered A1–H8 Visual Grid */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 pt-20"
        aria-label="Interactive Map Controls and Spatial Grid"
      >
        {/* Top Row: Map Layer Switcher (Satellite | Terrain | Plain) + Region Quick-Jump + Water Body Pins */}
        <div className="flex flex-col gap-2.5 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            {/* Map Style Switcher */}
            <div
              data-testid="map-style-switcher"
              className="pointer-events-auto inline-flex items-center rounded-xl border border-slate-700/90 bg-slate-950/90 p-1 shadow-xl backdrop-blur-md"
            >
              {(
                [
                  { id: 'satellite', label: '🛰️ Satellite' },
                  { id: 'terrain', label: '⛰️ Terrain' },
                  { id: 'plain', label: '🗺️ Plain Map' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  data-testid={`map-style-${mode.id}`}
                  onClick={() => onChangeMapStyle(mode.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    mapStyle === mode.id
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Quick Region Jump Buttons (e.g., Valencia, Ebro, Warsaw, Baltic) */}
            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800/90 bg-slate-950/85 px-2.5 py-1 text-[11px] backdrop-blur-md">
              <span className="font-semibold text-slate-400">Explore Map:</span>
              <button
                type="button"
                data-testid="jump-valencia"
                onClick={() => handleFlyToRegion(-0.8, 39.2, 9.2)}
                className="rounded-md bg-slate-800/90 px-2 py-0.5 font-semibold text-emerald-300 hover:bg-slate-700"
              >
                Valencia (ES)
              </button>
              <button
                type="button"
                onClick={() => handleFlyToRegion(0.255, 41.355, 10)}
                className="rounded-md bg-slate-800/90 px-2 py-0.5 font-semibold text-slate-200 hover:bg-slate-700"
              >
                Ebro / Aragón (ES)
              </button>
              <button
                type="button"
                onClick={() => handleFlyToRegion(21.035, 52.35, 9.5)}
                className="rounded-md bg-slate-800/90 px-2 py-0.5 font-semibold text-slate-200 hover:bg-slate-700"
              >
                Warsaw / Zegrze (PL)
              </button>
              <button
                type="button"
                onClick={() => handleFlyToRegion(18.675, 54.695, 10)}
                className="rounded-md bg-slate-800/90 px-2 py-0.5 font-semibold text-slate-200 hover:bg-slate-700"
              >
                Baltic Sea (PL)
              </button>
            </div>
          </div>

          {/* Available Water Body Pins Bar (Synced with Map Pins — Visible to Guest & Registered) */}
          <div
            className="pointer-events-auto flex flex-wrap gap-1.5 max-w-3xl"
            data-testid="water-body-pins-layer"
          >
            {waterBodyPins.map((pin) => {
              const isSelected = pin.id === selectedWaterBodyId;
              return (
                <button
                  key={pin.id}
                  type="button"
                  data-testid={`water-body-pin-${pin.id}`}
                  onClick={() => onSelectWaterBody(pin.id)}
                  className={`group flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-lg backdrop-blur-md transition-all ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-950/95 text-emerald-200 ring-2 ring-emerald-400/50'
                      : 'border-slate-700/80 bg-slate-900/90 text-slate-200 hover:border-emerald-500/70 hover:bg-slate-800/95'
                  }`}
                >
                  <span>📍</span>
                  <span>{pin.name}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {pin.countryCode}
                  </span>
                  <span className="text-[11px] text-amber-400">
                    ★ {pin.avgRating.toFixed(1)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* REGISTERED USER ONLY: Full A1–H8 Visual Water Body Grid + Numbered Circular Spot Markers (1–6) + Spot Features Legend */}
        {selectedDetails?.tier === 'registered' && gridCells.length > 0 && (
          <div
            data-testid="spatial-grid-overlay"
            className="pointer-events-auto my-auto flex flex-col lg:flex-row items-start gap-3 self-start rounded-2xl border border-emerald-500/50 bg-slate-950/85 p-3 shadow-2xl backdrop-blur-md max-w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-500px)]"
          >
            {/* Visual 8x8 Coordinate Grid (A1..H8) with Numbered Spot Circles (1..6) Overlaid on Water Body */}
            <div className="relative h-[320px] w-[320px] sm:h-[390px] sm:w-[390px] shrink-0 overflow-hidden rounded-xl border-2 border-slate-700 shadow-inner">
              {/* Simulated Aerial Satellite Water Body Contour Backdrop */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 52% 48%, #0b4f6c 0%, #083b52 44%, #3f4e38 46%, #5a5343 72%, #3a4432 100%)',
                }}
              />
              {/* Water Body Polygon SVG Shape inside the 8x8 Grid */}
              <svg
                viewBox="0 0 100 100"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
                preserveAspectRatio="none"
              >
                <path
                  d="M 38 4 L 46 18 L 58 8 L 52 26 L 68 38 L 64 52 L 88 46 L 82 66 L 68 74 L 62 94 L 38 92 L 44 76 L 20 68 L 32 52 L 28 36 L 42 32 Z"
                  fill="#0b5575"
                  stroke="#fca5a5"
                  strokeWidth="1.2"
                  strokeDasharray="2,1"
                />
              </svg>

              {/* 8x8 Grid Matrix: Columns A..H (left to right) x Rows 1..8 (top to bottom) */}
              <div className="relative z-10 grid h-full w-full grid-cols-8 grid-rows-8">
                {ROW_NUMBERS.map((rowNum) =>
                  COL_LABELS.map((colLetter) => {
                    const cellId = `${colLetter}${rowNum}`;
                    const waterCell = waterCellById.get(cellId);
                    const isProhibited =
                      waterCell?.restrictionStatus === 'prohibited';
                    const isSelectedCell = selectedCellId === cellId;

                    return (
                      <button
                        key={cellId}
                        type="button"
                        data-testid={`grid-cell-${cellId}`}
                        onClick={() => {
                          if (waterCell) onSelectGridCell(waterCell);
                        }}
                        title={
                          isProhibited
                            ? `${cellId}: PROHIBITED (${waterCell?.restrictionReason})`
                            : waterCell
                              ? `Cell ${cellId} (${waterCell.zoneType.replace(/_/g, ' ')}) — Click for AI sector micro-analysis`
                              : `Cell ${cellId}`
                        }
                        className={`relative border border-white/25 p-0.5 text-left transition ${
                          isProhibited
                            ? 'bg-rose-950/60 hover:bg-rose-900/70'
                            : waterCell
                              ? 'hover:bg-emerald-500/20'
                              : 'bg-black/15'
                        } ${isSelectedCell ? 'ring-2 ring-inset ring-amber-400 bg-amber-400/20' : ''}`}
                      >
                        {/* Top-left Cell Label (A1..H8) in gold text on dark badge */}
                        <span className="inline-block rounded bg-black/70 px-1 py-0.2 font-mono text-[9px] font-bold leading-tight text-[#fde047]">
                          {cellId}
                        </span>
                        {isProhibited && (
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-rose-600 px-1 text-[8px] font-extrabold text-white">
                            BAN
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Numbered Circular Fishing Spot Markers (1..6) Positioned Over the Water Body Grid */}
              <div className="pointer-events-none absolute inset-0 z-20">
                {activeSpots.slice(0, 6).map((spot) => {
                  const pos = getSpotRelativePosition(spot, sectorBbox);
                  const colorClass = getSpotCircleColorClass(
                    spot.spot_category,
                    spot.rank
                  );
                  const waterCell = waterCellById.get(spot.cell_id);

                  return (
                    <button
                      key={`${spot.cell_id}-${spot.rank}`}
                      type="button"
                      data-testid={`exact-spot-pin-${spot.cell_id}`}
                      onClick={() => {
                        if (waterCell) onSelectGridCell(waterCell);
                      }}
                      style={{
                        left: `${pos.leftPercent}%`,
                        top: `${pos.topPercent}%`,
                      }}
                      title={`#${spot.rank} (${spot.cell_id}) — ${spot.title}`}
                      className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-extrabold shadow-lg transition-transform hover:scale-125 ${colorClass}`}
                    >
                      {spot.rank}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spot Features & Grid Legend */}
            <div
              data-testid="spot-features-legend"
              className="flex flex-col justify-between space-y-2.5 text-xs min-w-[230px] max-w-[280px] max-h-[390px] overflow-y-auto pr-1"
            >
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Spot Features & Grid Legend
                </h4>
                <p className="text-[11px] text-slate-400">
                  {selectedDetails.waterBody.name} (A1–H8)
                </p>
              </div>

              {/* Color Tier Legend */}
              <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black bg-[#ef4444] text-[9px] font-bold text-white">
                    1
                  </span>
                  <span className="text-slate-200">
                    <strong>Red (1–2):</strong> Primary Hot Spot (Submerged Island / Main Point)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black bg-[#38bdf8] text-[9px] font-bold text-slate-950">
                    3
                  </span>
                  <span className="text-slate-200">
                    <strong>Blue (3–4):</strong> Shore / Cove Access (Bank Bay / Inflow Shelf)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black bg-[#f59e0b] text-[9px] font-bold text-slate-950">
                    5
                  </span>
                  <span className="text-slate-200">
                    <strong>Amber (5–6):</strong> Secondary Ledge (Drop-Off / Underwater Ridge)
                  </span>
                </div>
              </div>

              {/* Numbered Spot Features Breakdown */}
              <div className="space-y-1.5">
                {activeSpots.slice(0, 6).map((spot) => {
                  const badgeColor = getSpotCircleColorClass(
                    spot.spot_category,
                    spot.rank
                  );
                  return (
                    <div
                      key={`${spot.cell_id}-${spot.rank}`}
                      className="rounded-lg border border-slate-800/90 bg-slate-900/75 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-extrabold ${badgeColor}`}
                        >
                          {spot.rank}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#fde047]">
                          [{spot.cell_id}]
                        </span>
                        <span className="truncate font-semibold text-white text-[11px]">
                          {spot.title}
                        </span>
                      </div>
                      {spot.feature_tags && spot.feature_tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {spot.feature_tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-slate-950 px-1.5 py-0.5 text-[9px] text-emerald-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
