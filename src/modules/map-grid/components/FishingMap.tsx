'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import {
  AlertTriangle,
  Crosshair,
  Globe,
  Layers,
  Mountain,
  Satellite,
} from 'lucide-react';
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
    <div className="relative h-full w-full select-none bg-[#0e130f]">
      {/* MapLibre GL JS Canvas */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 h-full w-full"
        data-testid="map-canvas"
      />

      {/* Visual Framing Reticle on Map (Tactical Viewfinder Corner Brackets) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          ref={reticleRef}
          data-testid="target-reticle-box"
          className="relative h-[64vh] w-[64vh] max-w-[85vw] max-h-[65vw] rounded-lg border border-[#688a5b]/25 shadow-[0_0_0_9999px_rgba(10,15,11,0.40)] flex flex-col justify-end p-3"
        >
          {/* Tactical Viewfinder Corner Brackets in Verhunt Caldero Rust */}
          <span className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[#d96b27] rounded-tl-sm" />
          <span className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-[#d96b27] rounded-tr-sm" />
          <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#d96b27] rounded-bl-sm" />
          <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#d96b27] rounded-br-sm" />

          {/* Center Crosshair Tick Marker */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-2 w-2 rounded-full border border-[#d96b27]/40" />
          </div>

          {/* Bottom Inscription: Structure Hint */}
          <div className="text-[10px] font-mono tracking-wider text-[#918b80] bg-[#151c16]/90 border border-[#2c3a2f] px-2.5 py-0.5 rounded self-center text-center shadow-lg backdrop-blur-sm">
            Aim at bays, points & weed edges
          </div>
        </div>
      </div>

      {/* Clean Floating Map Controls: Map Style Switcher (Satellite | Terrain) + Satellite Provider + Area Selection Bar */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 pt-20">
        {/* Top Controls: 2-Mode Map Switcher + Satellite Source Switch (PNOA Spain HD vs Esri Alt) */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            data-testid="map-style-switcher"
            className="pointer-events-auto inline-flex items-center rounded-lg border border-[#2c3a2f] bg-[#151c16]/90 p-0.5 shadow-xl backdrop-blur-md"
          >
            {(
              [
                { id: 'satellite', label: 'Satellite', icon: Satellite },
                { id: 'terrain', label: 'Terrain', icon: Mountain },
              ] as const
            ).map((mode) => {
              const Icon = mode.icon;
              const isActive = mapStyle === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  data-testid={`map-style-${mode.id}`}
                  onClick={() => onChangeMapStyle(mode.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-[#d96b27] text-stone-950 shadow-sm font-bold'
                      : 'text-[#dfd7c8]/80 hover:bg-[#1c251e] hover:text-[#dfd7c8]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          <div
            data-testid="satellite-source-switcher"
            className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-[#2c3a2f] bg-[#151c16]/90 p-0.5 shadow-xl backdrop-blur-md"
            title="Switch satellite flight imagery to reduce sun glare or view different water levels"
          >
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#918b80]">
              Imagery:
            </span>
            {(
              [
                { id: 'pnoa', label: 'PNOA HD', icon: Layers },
                { id: 'esri', label: 'Esri Alt', icon: Globe },
              ] as const
            ).map((src) => {
              const Icon = src.icon;
              const isActive = satelliteSource === src.id;
              return (
                <button
                  key={src.id}
                  type="button"
                  data-testid={`satellite-source-${src.id}`}
                  onClick={() => {
                    onChangeSatelliteSource(src.id);
                    if (mapStyle !== 'satellite') onChangeMapStyle('satellite');
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    isActive
                      ? 'bg-[#688a5b] text-stone-950 shadow-sm font-bold'
                      : 'text-[#dfd7c8]/80 hover:bg-[#1c251e] hover:text-[#dfd7c8]'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{src.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Center Floating Primary CTA: High-Vis Verhunt Caldero Rust */}
        <button
          type="button"
          data-testid="capture-map-area-button"
          onClick={triggerScreenshotCapture}
          className="pointer-events-auto mb-3 flex items-center gap-2 self-center rounded-lg bg-[#d96b27] hover:bg-[#c2571a] active:bg-[#a84713] px-5 py-2.5 text-xs sm:text-sm font-bold text-stone-950 shadow-xl shadow-stone-950/70 border border-[#ea7c3a]/50 backdrop-blur-md transition active:scale-95"
        >
          <Crosshair className="h-4 w-4 stroke-[2.5]" />
          <span className="tracking-wide">SCAN FISHING WATERS</span>
        </button>
      </div>

      {/* Maximum Terrain Zoom Notice Toast */}
      {showTerrainMaxZoomToast && mapStyle === 'terrain' && (
        <div
          data-testid="terrain-max-zoom-toast"
          className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-lg border border-[#d96b27]/40 bg-[#151c16]/95 px-3.5 py-1.5 text-xs font-semibold text-[#dfd7c8] shadow-2xl backdrop-blur-md"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-[#d96b27] shrink-0" />
          <span>Maximum terrain detail reached · Switch to Satellite for closer zoom</span>
        </div>
      )}
    </div>
  );
}
