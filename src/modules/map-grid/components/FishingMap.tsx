'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import type {
  BoundingBox,
  MapStyleMode,
  SatelliteSource,
  WaterBodyPinSummary,
} from '@/shared/types/domain';
import type { CropBoxPixels } from '@/modules/map-grid/screenshot-compositor';

interface FishingMapProps {
  mapStyle: MapStyleMode;
  onChangeMapStyle: (style: MapStyleMode) => void;
  satelliteSource: SatelliteSource;
  onChangeSatelliteSource: (source: SatelliteSource) => void;
  activeWaterBody: WaterBodyPinSummary | null;
  flyToTarget?: { lng: number; lat: number; zoom?: number; label?: string } | null;
  onCaptureArea: (params: {
    canvas: HTMLCanvasElement | null;
    cropBox: CropBoxPixels | null;
    bbox: BoundingBox;
    waterBodyHint?: WaterBodyPinSummary | null;
  }) => void;
}

function getMapStyleConfig(
  mode: MapStyleMode,
  satelliteSource: SatelliteSource
): StyleSpecification {
  if (mode === 'terrain') {
    return {
      version: 8,
      sources: {
        opentopo: {
          type: 'raster',
          tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 17,
          attribution: '© OpenTopoMap (CC-BY-SA)',
        },
      },
      layers: [
        {
          id: 'opentopo-layer',
          type: 'raster',
          source: 'opentopo',
          minzoom: 0,
        },
      ],
    };
  }

  if (satelliteSource === 'pnoa') {
    return {
      version: 8,
      sources: {
        pnoa: {
          type: 'raster',
          scheme: 'tms',
          tiles: [
            'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{y}.jpeg',
          ],
          tileSize: 256,
          attribution: '© IGN PNOA Máxima Actualidad (Spain)',
        },
      },
      layers: [
        {
          id: 'pnoa-layer',
          type: 'raster',
          source: 'pnoa',
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    };
  }

  // Satellite Alternate (ESRI World Imagery free tiles)
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
  satelliteSource,
  onChangeSatelliteSource,
  activeWaterBody,
  flyToTarget,
  onCaptureArea,
}: FishingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const reticleRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [showTerrainMaxZoomToast, setShowTerrainMaxZoomToast] =
    useState<boolean>(false);

  // Initialize MapLibre GL JS centered in Spain (Embalse de Cortes, Valencia) with preserveDrawingBuffer: true
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getMapStyleConfig(mapStyle, satelliteSource),
        center: [-0.935, 39.248], // Embalse de Cortes main reservoir basin (Valencia, Spain)
        zoom: 13.4,
        maxZoom: mapStyle === 'terrain' ? 17.2 : 20,
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

  // Switch between Satellite (PNOA / Esri) and Terrain map styles + dynamic max zoom limits
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setStyle(getMapStyleConfig(mapStyle, satelliteSource));
      if (mapStyle === 'terrain') {
        map.setMaxZoom(17.2);
        if (map.getZoom() > 17.2) {
          map.setZoom(17.2);
        }
      } else {
        map.setMaxZoom(20);
        setShowTerrainMaxZoomToast(false);
      }
    } catch {
      // Ignore in headless environment
    }
  }, [mapStyle, satelliteSource]);

  // Monitor terrain zoom level to advise angler when maximum detail is reached
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const checkTerrainZoom = () => {
      try {
        const currentZoom = map.getZoom();
        if (mapStyle === 'terrain' && currentZoom >= 16.8) {
          setShowTerrainMaxZoomToast(true);
        } else {
          setShowTerrainMaxZoomToast(false);
        }
      } catch {
        // Ignore
      }
    };

    map.on('zoom', checkTerrainZoom);
    checkTerrainZoom();

    return () => {
      map.off('zoom', checkTerrainZoom);
    };
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

  const triggerScreenshotCapture = () => {
    const canvas = mapRef.current?.getCanvas() ?? null;
    const effectiveCrop = getReticleCropBox();
    const bbox = resolveCurrentBbox(effectiveCrop);
    onCaptureArea({
      canvas,
      cropBox: effectiveCrop,
      bbox,
      waterBodyHint: activeWaterBody,
    });
  };

  return (
    <div className="relative h-full w-full select-none bg-[#071722]">
      {/* MapLibre GL JS Canvas */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 h-full w-full"
        data-testid="map-canvas"
      />

      {/* Visual Framing Reticle on Map (Exact 1:1 Crop Target) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          ref={reticleRef}
          data-testid="target-reticle-box"
          className="h-[64vh] w-[64vh] max-w-[85vw] max-h-[65vw] rounded-2xl border-2 border-dashed border-white/35 shadow-[0_0_0_9999px_rgba(2,6,23,0.22)] flex flex-col justify-end p-3"
        >
          <div className="text-[11px] font-medium text-slate-200/90 bg-slate-950/75 px-3 py-1 rounded-lg self-center text-center">
            Frame your fishing area
          </div>
        </div>
      </div>

      {/* Clean Floating Map Controls: Map Style Switcher (Satellite | Terrain) + Satellite Provider + Area Selection Bar */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 pt-20">
        {/* Top Controls: 2-Mode Map Switcher + Satellite Source Switch (PNOA Spain HD vs Esri Alt) */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            data-testid="map-style-switcher"
            className="pointer-events-auto inline-flex items-center rounded-xl border border-slate-700/90 bg-slate-950/90 p-1 shadow-xl backdrop-blur-md"
          >
            {(
              [
                { id: 'satellite', label: '🛰️ Satellite' },
                { id: 'terrain', label: '⛰️ Terrain' },
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

          <div
            data-testid="satellite-source-switcher"
            className="pointer-events-auto inline-flex items-center gap-1 rounded-xl border border-slate-700/90 bg-slate-950/90 p-1 shadow-xl backdrop-blur-md"
            title="Switch satellite flight imagery to reduce sun glare or view different water levels"
          >
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Imagery:
            </span>
            {(
              [
                { id: 'pnoa', label: '🛰️ PNOA HD' },
                { id: 'esri', label: '🌍 Esri Alt' },
              ] as const
            ).map((src) => (
              <button
                key={src.id}
                type="button"
                data-testid={`satellite-source-${src.id}`}
                onClick={() => {
                  onChangeSatelliteSource(src.id);
                  if (mapStyle !== 'satellite') onChangeMapStyle('satellite');
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  satelliteSource === src.id
                    ? 'bg-sky-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {src.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Center Floating Primary CTA: Select This Area */}
        <button
          type="button"
          data-testid="capture-map-area-button"
          onClick={triggerScreenshotCapture}
          className="pointer-events-auto mb-3 flex items-center gap-2.5 self-center rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-2xl shadow-emerald-950/70 backdrop-blur-md transition hover:bg-emerald-400 hover:scale-105 active:scale-95"
        >
          <span className="text-base">🎯</span>
          <span>Select This Area</span>
        </button>
      </div>

      {/* Maximum Terrain Zoom Notice Toast */}
      {showTerrainMaxZoomToast && mapStyle === 'terrain' && (
        <div
          data-testid="terrain-max-zoom-toast"
          className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-slate-950/90 px-4 py-2 text-xs font-semibold text-amber-200 shadow-2xl backdrop-blur-md"
        >
          <span>⛰️</span>
          <span>Maximum terrain detail reached · Switch to Satellite for closer zoom</span>
        </div>
      )}
    </div>
  );
}
