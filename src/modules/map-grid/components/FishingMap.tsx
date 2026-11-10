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
  activeWaterBody: WaterBodyPinSummary | null;
  flyToTarget?: { lng: number; lat: number; zoom?: number; label?: string } | null;
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
  activeWaterBody,
  flyToTarget,
  onCaptureArea,
}: FishingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const reticleRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [isDragSelectMode, setIsDragSelectMode] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [cropBox, setCropBox] = useState<CropBoxPixels | null>(null);

  // Initialize MapLibre GL JS centered in Spain (Embalse de Cortes, Valencia) with preserveDrawingBuffer: true
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getMapStyleConfig(mapStyle),
        center: [-0.946, 39.242], // Spain default view (Valencia interior reservoirs)
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

  // Fly to searched location in Spain when user selects a search result
  useEffect(() => {
    if (!mapRef.current || !flyToTarget) return;
    try {
      mapRef.current.flyTo({
        center: [flyToTarget.lng, flyToTarget.lat],
        zoom: flyToTarget.zoom ?? 13.5,
        duration: 900,
      });
    } catch {
      // Ignore in headless environment
    }
  }, [flyToTarget]);

  /**
   * Computes the pixel rectangle of the on-screen framing reticle relative to the map container
   * so that 1-click capture crops the exact framed square rather than the full wide viewport.
   */
  const getReticleCropBox = (): CropBoxPixels | null => {
    if (!mapContainerRef.current || !reticleRef.current) return null;
    const mapRect = mapContainerRef.current.getBoundingClientRect();
    const retRect = reticleRef.current.getBoundingClientRect();
    if (retRect.width > 40 && retRect.height > 40) {
      return {
        x: Math.max(0, retRect.left - mapRect.left),
        y: Math.max(0, retRect.top - mapRect.top),
        width: Math.min(mapRect.width, retRect.width),
        height: Math.min(mapRect.height, retRect.height),
      };
    }
    return null;
  };

  const resolveCurrentBbox = (customCrop?: CropBoxPixels | null): BoundingBox => {
    if (mapRef.current) {
      try {
        if (customCrop && customCrop.width > 20 && customCrop.height > 20) {
          const sw = mapRef.current.unproject([
            customCrop.x,
            customCrop.y + customCrop.height,
          ]);
          const ne = mapRef.current.unproject([
            customCrop.x + customCrop.width,
            customCrop.y,
          ]);
          return [sw.lng, sw.lat, ne.lng, ne.lat];
        }
        const b = mapRef.current.getBounds();
        if (b) {
          return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
        }
      } catch {
        // Fallback below
      }
    }
    if (flyToTarget) {
      return [
        flyToTarget.lng - 0.022,
        flyToTarget.lat - 0.018,
        flyToTarget.lng + 0.022,
        flyToTarget.lat + 0.018,
      ];
    }
    return [-0.972, 39.222, -0.92, 39.262];
  };

  const triggerScreenshotCapture = (customCrop: CropBoxPixels | null) => {
    const canvas = mapRef.current?.getCanvas() ?? null;
    const effectiveCrop = customCrop ?? getReticleCropBox();
    const bbox = resolveCurrentBbox(effectiveCrop);
    onCaptureArea({
      canvas,
      cropBox: effectiveCrop,
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

      {/* Manual Drag-to-Select Crop Overlay */}
      {isDragSelectMode && (
        <div
          data-testid="drag-select-overlay"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="absolute inset-0 z-10 cursor-crosshair bg-slate-950/25"
        >
          <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 rounded-full border border-amber-400 bg-slate-950/90 px-4 py-1.5 text-xs font-bold text-amber-300 shadow-xl">
            ✂️ Drag a box directly over the water body sector you want to analyze
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

      {/* Visual Framing Reticle on Map (Exact 1:1 Crop Target) */}
      {!isDragSelectMode && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            ref={reticleRef}
            data-testid="target-reticle-box"
            className="h-[64vh] w-[64vh] max-w-[85vw] max-h-[65vw] rounded-2xl border-2 border-dashed border-white/35 shadow-[0_0_0_9999px_rgba(2,6,23,0.22)] flex flex-col justify-end p-3"
          >
            <div className="text-[11px] text-slate-200/90 bg-slate-950/75 px-3 py-1 rounded-lg self-center text-center">
              Frame water body inside box or use <strong>✂️ Select Area (Drag Box)</strong> for exact sector crop
            </div>
          </div>
        </div>
      )}

      {/* Clean Floating Map Controls: Map Style Switcher (Top-Left) + Area Selection Bar (Bottom-Center) */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 pt-20">
        {/* Top Controls: Map Layer Switcher (Satellite | Terrain | Plain) — No suggested spot chips */}
        <div className="flex items-center gap-2">
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

        {/* Bottom Center Action Bar: Exact Area Selection */}
        <div className="pointer-events-auto mb-2 flex flex-wrap items-center justify-center gap-3 self-center rounded-2xl border border-emerald-500/50 bg-slate-950/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            data-testid="toggle-drag-select-button"
            onClick={() => setIsDragSelectMode((prev) => !prev)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold shadow-lg transition ${
              isDragSelectMode
                ? 'border border-amber-400 bg-amber-500 text-slate-950'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-950/60'
            }`}
          >
            <span>{isDragSelectMode ? '✕' : '✂️'}</span>
            <span>
              {isDragSelectMode
                ? 'Cancel Drag Selection'
                : 'Select Area on Map (Drag Box)'}
            </span>
          </button>

          <button
            type="button"
            data-testid="capture-map-area-button"
            onClick={() => triggerScreenshotCapture(null)}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:border-emerald-400 hover:text-white"
          >
            <span>📸</span>
            <span>Capture Framed Box</span>
          </button>
        </div>
      </div>
    </div>
  );
}
