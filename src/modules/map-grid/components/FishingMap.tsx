'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type {
  GridCell,
  RecommendedSpot,
  WaterBodyPinSummary,
} from '@/shared/types/domain';
import type { WaterBodyTierResponse } from '@/shared/db/store';

interface FishingMapProps {
  waterBodyPins: WaterBodyPinSummary[];
  selectedWaterBodyId: string | null;
  selectedDetails: WaterBodyTierResponse | null;
  activeSpots: RecommendedSpot[];
  selectedCellId: string | null;
  onSelectWaterBody: (id: string) => void;
  onSelectGridCell: (cell: GridCell) => void;
}

export function FishingMap({
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

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [12.5, 47.5], // Centered between Poland and Spain
        zoom: 4.3,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true }),
        'bottom-right'
      );
      mapRef.current = map;
    } catch {
      // Headless / WebGL-disabled environment fallback handled gracefully by overlay controls
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Fly to selected water body when changed
  useEffect(() => {
    if (!mapRef.current || !selectedDetails) return;
    try {
      mapRef.current.flyTo({
        center: [
          selectedDetails.waterBody.centerLng,
          selectedDetails.waterBody.centerLat,
        ],
        zoom: 12.2,
        duration: 900,
      });
    } catch {
      // Ignore WebGL flyTo error in headless environments
    }
  }, [selectedDetails]);

  const gridCells = selectedDetails?.grid?.cells ?? [];
  const spotByCell = new Map(activeSpots.map((s) => [s.cell_id, s]));

  return (
    <div className="relative h-full w-full select-none bg-[#071722]">
      {/* MapLibre GL JS Canvas */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 h-full w-full"
        data-testid="map-canvas"
      />

      {/* Interactive Water Body Pins Bar & Map Overlay (Visible to All Users — Guest & Registered) */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 pt-20"
        aria-label="Interactive Water Body Pins and Spatial Grid Overlay"
      >
        {/* Named Water Body Pins Cluster Overlay */}
        <div
          className="pointer-events-auto flex flex-wrap gap-2 max-w-3xl"
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
                className={`group flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-md transition-all ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-950/95 text-emerald-200 ring-2 ring-emerald-400/50'
                    : 'border-slate-700/80 bg-slate-900/90 text-slate-200 hover:border-emerald-500/70 hover:bg-slate-800/95'
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    pin.waterType === 'sea' ? 'bg-cyan-400' : 'bg-emerald-400'
                  }`}
                />
                <span>{pin.name}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {pin.countryCode} · {pin.waterType === 'sea' ? 'Sea' : 'Freshwater'}
                </span>
                <span className="text-[11px] text-amber-400">
                  ★ {pin.avgRating.toFixed(1)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tactical Spatial Grid Overlay on Map (ONLY rendered for Registered Users when a water body is selected) */}
        {selectedDetails?.tier === 'registered' && gridCells.length > 0 && (
          <div
            data-testid="spatial-grid-overlay"
            className="pointer-events-auto mb-4 self-start rounded-2xl border border-emerald-500/40 bg-slate-950/90 p-3.5 shadow-2xl backdrop-blur-md"
          >
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Tactical Spatial Grid ({selectedDetails.waterBody.name})
                </p>
                <p className="text-[11px] text-slate-400">
                  Click any cell (A1–H8) for an AI Sector Micro-Analysis · Red = Prohibited
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  AI Top Spot Pin
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-900 border border-sky-500/50" />
                  Fishable Cell
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-900 border border-rose-500" />
                  Prohibited
                </span>
              </div>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-w-xl">
              {gridCells.map((cell) => {
                const spot = spotByCell.get(cell.cellId);
                const isProhibited = cell.restrictionStatus === 'prohibited';
                const isSelectedCell = selectedCellId === cell.cellId;

                return (
                  <button
                    key={cell.cellId}
                    type="button"
                    data-testid={`grid-cell-${cell.cellId}`}
                    onClick={() => onSelectGridCell(cell)}
                    title={
                      isProhibited
                        ? `${cell.cellId}: PROHIBITED (${cell.restrictionReason})`
                        : spot
                          ? `#${spot.rank} ${spot.title} (${spot.confidence_score}% match)`
                          : `Cell ${cell.cellId} (${cell.zoneType})`
                    }
                    className={`relative flex flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-xs font-mono transition-all ${
                      isProhibited
                        ? 'border-rose-500/80 bg-rose-950/80 text-rose-300 hover:bg-rose-900/80'
                        : spot
                          ? 'border-emerald-400 bg-emerald-900/80 text-emerald-100 shadow-md shadow-emerald-950'
                          : 'border-sky-800/70 bg-sky-950/60 text-sky-200 hover:border-sky-400 hover:bg-sky-900/70'
                    } ${isSelectedCell ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    <span className="font-bold">{cell.cellId}</span>
                    {spot && (
                      <span
                        data-testid={`exact-spot-pin-${cell.cellId}`}
                        className="mt-0.5 rounded bg-emerald-400 px-1 text-[9px] font-extrabold text-slate-950"
                      >
                        #{spot.rank} PIN
                      </span>
                    )}
                    {isProhibited && (
                      <span className="mt-0.5 text-[9px] font-bold text-rose-400">
                        BAN
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
