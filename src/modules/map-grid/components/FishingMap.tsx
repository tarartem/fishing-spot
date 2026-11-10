'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import type {
  BoundingBox,
  MapStyleMode,
  WaterBodyPinSummary,
} from '@/shared/types/domain';
import type { CropBoxPixels } from '@/modules/map-grid/screenshot-compositor';

interface FishingMapProps {
  mapStyle: MapStyleMode;
  onChangeMapStyle: (style: MapStyleMode) => void;
  waterBodyPins: WaterBodyPinSummary[];
  activeWaterBody: WaterBodyPinSummary | null;
  onNavigateToWaterBody: (pin: WaterBodyPinSummary) => void;
  onCaptureArea: (params: {
    canvas: HTMLCanvasElement | null;
    cropBox: CropBoxPixels | null;
    bbox: BoundingBox;
    waterBodyHint?: WaterBodyPinSummary | null;
  }) => void;
}

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
  // Satellite (ESRI World Imagery free tiles)
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

export function FishingMap({
  mapStyle,
  onChangeMapStyle,
  waterBodyPins,
  activeWaterBody,
  onNavigateToWaterBody,
  onCaptureArea,
}: FishingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [isDragSelectMode, setIsDragSelectMode] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [cropBox, setCropBox] = useState<CropBoxPixels | null>(null);

  // Initialize MapLibre GL JS with preserveDrawingBuffer: true so canvas screenshots work natively
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getMapStyleConfig(mapStyle),
        center: [-0.946, 39.242], // Embalse de Cortes (Cofrentes — Valencia)
        zoom: 13.2,
        canvasContextAttributes: { preserveDrawingBuffer: true },
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true }),
        'bottom-right'
      );
      mapRef.current = map;
    } catch {
      // Headless environment fallback handled gracefully by screenshot compositor
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch between Satellite, Terrain, and Plain map styles
  useEffect(() => {
    if (!mapRef.current) return;
    try {
      mapRef.current.setStyle(getMapStyleConfig(mapStyle));
    } catch {
      // Ignore in headless environment
    }
  }, [mapStyle]);

  // Fly to selected water body when user navigates to it
  useEffect(() => {
    if (!mapRef.current || !activeWaterBody) return;
    try {
      mapRef.current.flyTo({
        center: [activeWaterBody.centerLng, activeWaterBody.centerLat],
        zoom: 13.4,
        duration: 850,
      });
    } catch {
      // Ignore in headless environment
    }
  }, [activeWaterBody]);

  const resolveCurrentBbox = (): BoundingBox => {
    if (mapRef.current) {
      try {
        const b = mapRef.current.getBounds();
        if (b) {
          return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
        }
      } catch {
        // Fallback below
      }
    }
    if (activeWaterBody) {
      return [
        activeWaterBody.centerLng - 0.025,
        activeWaterBody.centerLat - 0.02,
        activeWaterBody.centerLng + 0.025,
        activeWaterBody.centerLat + 0.02,
      ];
    }
    return [-0.972, 39.222, -0.92, 39.262];
  };

  const triggerScreenshotCapture = (customCrop: CropBoxPixels | null) => {
    const canvas = mapRef.current?.getCanvas() ?? null;
    const bbox = resolveCurrentBbox();
    onCaptureArea({
      canvas,
      cropBox: customCrop,
      bbox,
      waterBodyHint: activeWaterBody,
    });
    setIsDragSelectMode(false);
    setDragStart(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragSelectMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragStart({ x, y });
    setCropBox({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragSelectMode || !dragStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);
    setCropBox({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (!isDragSelectMode || !dragStart) return;
    setDragStart(null);
    if (cropBox && cropBox.width > 40 && cropBox.height > 40) {
      triggerScreenshotCapture(cropBox);
    }
  };

  return (
    <div className="relative h-full w-full select-none bg-[#071722]">
      {/* MapLibre GL JS Canvas */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 h-full w-full"
        data-testid="map-canvas"
      />

      {/* Optional Drag-to-Select Crop Overlay */}
      {isDragSelectMode && (
        <div
          data-testid="drag-select-overlay"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="absolute inset-0 z-10 cursor-crosshair bg-slate-950/25"
        >
          <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 rounded-full border border-amber-400 bg-slate-950/90 px-4 py-1.5 text-xs font-bold text-amber-300 shadow-xl">
            Drag a box over the water body to capture your screenshot
          </div>
          {cropBox && cropBox.width > 5 && (
            <div
              style={{
                left: cropBox.x,
                top: cropBox.y,
                width: cropBox.width,
                height: cropBox.height,
              }}
              className="pointer-events-none absolute border-2 border-dashed border-amber-400 bg-emerald-500/15 shadow-2xl"
            />
          )}
        </div>
      )}

      {/* Visual Framing Reticle on Map */}
      {!isDragSelectMode && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[64vh] w-[64vh] max-w-[85vw] max-h-[65vw] rounded-2xl border-2 border-dashed border-white/35 shadow-[0_0_0_9999px_rgba(2,6,23,0.18)] flex flex-col justify-between p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-amber-300/90 bg-slate-950/70 px-2.5 py-1 rounded-lg self-start">
              <span>
                🎯 Target Area:{' '}
                {activeWaterBody?.name ?? 'Embalse de Cortes (Valencia)'}
              </span>
            </div>
            <div className="text-[11px] text-slate-200/90 bg-slate-950/70 px-2.5 py-1 rounded-lg self-center">
              Pan/zoom map to frame water body, then click &ldquo;Select Area &amp; Create Screenshot&rdquo;
            </div>
          </div>
        </div>
      )}

      {/* Floating Map Controls: Layer Switcher + Quick Water Body Navigator + Area Capture Action */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 pt-20">
        {/* Top Controls: Map Layer Switcher (Satellite | Terrain | Plain) + Quick Water Body Selector */}
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
          </div>

          {/* Water Bodies Quick Navigation Bar */}
          <div
            className="pointer-events-auto flex flex-wrap gap-1.5"
            data-testid="water-body-pins-layer"
          >
            {waterBodyPins.map((pin) => {
              const isSelected = activeWaterBody?.id === pin.id;
              return (
                <button
                  key={pin.id}
                  type="button"
                  data-testid={`water-body-pin-${pin.id}`}
                  onClick={() => onNavigateToWaterBody(pin)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-lg backdrop-blur-md transition ${
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
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Center Action Bar: Select Area on Map (Create Screenshot) */}
        <div className="pointer-events-auto mb-2 flex flex-wrap items-center justify-center gap-3 self-center rounded-2xl border border-emerald-500/50 bg-slate-950/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            data-testid="capture-map-area-button"
            onClick={() => triggerScreenshotCapture(null)}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-950/60 transition hover:bg-emerald-400"
          >
            <span>📸</span>
            <span>Select Area &amp; Create Screenshot</span>
          </button>

          <button
            type="button"
            data-testid="toggle-drag-select-button"
            onClick={() => setIsDragSelectMode((prev) => !prev)}
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
              isDragSelectMode
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
            }`}
          >
            {isDragSelectMode ? '✕ Cancel Drag Box' : '✂️ Or Drag Box on Map'}
          </button>
        </div>
      </div>
    </div>
  );
}
