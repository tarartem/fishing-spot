'use client';

import React, { useEffect, useState } from 'react';
import { FishingMap } from '@/modules/map-grid/components/FishingMap';
import {
  AnalysisProgressDialog,
  MIN_ANALYSIS_SHOWCASE_MS,
} from '@/modules/map-grid/components/AnalysisProgressDialog';
import {
  captureMapAreaScreenshot,
  renderAnnotatedGridScreenshot,
  type CropBoxPixels,
} from '@/modules/map-grid/screenshot-compositor';
import {
  cleanSpotText,
  cleanSpotTitle,
  downloadOnePageFishingPdfReport,
} from '@/modules/map-grid/pdf-report';
import {
  APP_VERSION,
  formatReportTimestamp,
  generateReportId,
} from '@/shared/app-version';
import { parseGpsCoordinates } from '@/shared/utils/gps-coordinates';
import {
  ANGLER_FEATURE_CATALOG,
  computeSelectionScale,
} from '@/modules/ai-advisor/scale-utils';
import type {
  BoundingBox,
  ClientWaterMaskSummary,
  MapStyleMode,
  SatelliteSource,
  SpotAccessMode,
  UserScreenshotArtifact,
  WaterBodyArtifactAnalysis,
  WaterBodyPinSummary,
} from '@/shared/types/domain';

type WorkflowStep = 'map_browse' | 'screenshot_preview' | 'artifact_ready';

function formatAccessBadge(mode: SpotAccessMode): {
  icon: string;
  label: string;
  classes: string;
} {
  switch (mode) {
    case 'car_asphalt':
      return {
        icon: '🚗',
        label: 'Paved Road',
        classes: 'border-slate-700 bg-slate-800/80 text-slate-200',
      };
    case 'dirt_track':
      return {
        icon: '🚙',
        label: 'Dirt Track',
        classes: 'border-slate-700 bg-slate-800/80 text-slate-200',
      };
    case 'boat_only':
      return {
        icon: '🛶',
        label: 'Boat / Cliff Only',
        classes: 'border-slate-700 bg-slate-800/80 text-rose-300/90',
      };
    default:
      return {
        icon: '🥾',
        label: 'Foot Trail',
        classes: 'border-slate-700 bg-slate-800/80 text-slate-200',
      };
  }
}

function getSpotRankStyle(rank: number) {
  if (rank <= 2) {
    return {
      pillClasses: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
      dotColor: 'bg-emerald-400',
      category: 'Top Ranked',
    };
  }
  if (rank <= 4) {
    return {
      pillClasses: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
      dotColor: 'bg-sky-400',
      category: 'Mid Ranked',
    };
  }
  return {
    pillClasses: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    dotColor: 'bg-amber-400',
    category: 'Secondary',
  };
}

export default function HomePage() {
  const [mapStyle, setMapStyle] = useState<MapStyleMode>('satellite');
  const [satelliteSource, setSatelliteSource] = useState<SatelliteSource>('pnoa');
  const [glareDetected, setGlareDetected] = useState<boolean>(false);
  const [waterBodyPins, setWaterBodyPins] = useState<WaterBodyPinSummary[]>([]);
  const [activeWaterBody, setActiveWaterBody] =
    useState<WaterBodyPinSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [flyToTarget, setFlyToTarget] = useState<{
    lng: number;
    lat: number;
    zoom?: number;
    label?: string;
  } | null>(null);
  const [copiedGps, setCopiedGps] = useState<boolean>(false);

  // Screenshot & AI Artifact Workflow State
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('map_browse');
  const [selectedBbox, setSelectedBbox] = useState<BoundingBox>([
    -0.972, 39.222, -0.92, 39.262,
  ]);
  const [rawScreenshotUrl, setRawScreenshotUrl] = useState<string>('');
  const [griddedPreviewUrl, setGriddedPreviewUrl] = useState<string>('');
  const [capturedWaterMask, setCapturedWaterMask] =
    useState<ClientWaterMaskSummary | null>(null);
  const anglerGearNote: string | undefined = undefined;
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Active Artifact & Saved Artifacts Gallery
  const [currentArtifact, setCurrentArtifact] =
    useState<UserScreenshotArtifact | null>(null);
  const [savedArtifacts, setSavedArtifacts] = useState<
    UserScreenshotArtifact[]
  >([]);

  // Load curated Spain water bodies in background for fast local recognition
  useEffect(() => {
    async function loadPins() {
      const res = await fetch('/api/water-bodies/pins?countryCode=ES');
      const data = await res.json();
      const pins: WaterBodyPinSummary[] = data.waterBodyPins ?? [];
      setWaterBodyPins(pins);
      if (pins.length > 0) {
        setActiveWaterBody(pins[0]);
      }
    }
    loadPins();
  }, []);

  // Search any reservoir, river, town, or direct GPS coordinates in Spain
  const handleSearchSpainLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // 1. Direct GPS coordinate parsing (e.g. "39.248, -0.935" or DMS) with zero network delay
    const gpsHit = parseGpsCoordinates(q);
    if (gpsHit) {
      setActiveWaterBody(null);
      setFlyToTarget({
        lng: gpsHit.lng,
        lat: gpsHit.lat,
        zoom: 14.5,
        label: gpsHit.formattedLabel,
      });
      setWorkflowStep('map_browse');
      return;
    }

    // 2. Check local curated Spain water bodies first
    const localMatch = waterBodyPins.find(
      (p) =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.regionLabel.toLowerCase().includes(q.toLowerCase())
    );
    if (localMatch) {
      setActiveWaterBody(localMatch);
      setFlyToTarget({
        lng: localMatch.centerLng,
        lat: localMatch.centerLat,
        zoom: 13.4,
        label: localMatch.name,
      });
      setWorkflowStep('map_browse');
      return;
    }

    // 3. Query OpenStreetMap Nominatim (prioritizing Spain `countrycodes=es`)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=es&q=${encodeURIComponent(q)}&limit=1`
      );
      if (res.ok) {
        const results = await res.json();
        if (results.length > 0) {
          const hit = results[0];
          setFlyToTarget({
            lng: Number(hit.lon),
            lat: Number(hit.lat),
            zoom: 13.5,
            label: hit.display_name,
          });
          setWorkflowStep('map_browse');
        }
      }
    } catch {
      // Ignore network errors
    }
  };

  // Step 1: User selects the area on the map -> always captures Satellite screenshot -> sees screenshot on screen
  const handleCaptureArea = async (params: {
    canvas: HTMLCanvasElement | null;
    cropBox: CropBoxPixels | null;
    bbox: BoundingBox;
    waterBodyHint?: WaterBodyPinSummary | null;
  }) => {
    setSelectedBbox(params.bbox);
    const captured = await captureMapAreaScreenshot({
      sourceCanvas: params.canvas,
      cropBox: params.cropBox,
      bbox: params.bbox,
      mapStyle,
      satelliteSource,
      waterBodyLabel: params.waterBodyHint?.name,
    });
    const griddedUrl = await renderAnnotatedGridScreenshot({
      rawScreenshotDataUrl: captured.dataUrl,
    });
    setGlareDetected(captured.glareDetected);
    setCapturedWaterMask(captured.waterMask ?? null);
    setRawScreenshotUrl(captured.dataUrl);
    setGriddedPreviewUrl(griddedUrl);
    setWorkflowStep('screenshot_preview');
  };

  const handleSwitchPreviewSatelliteSource = async (nextSource: SatelliteSource) => {
    setSatelliteSource(nextSource);
    const captured = await captureMapAreaScreenshot({
      bbox: selectedBbox,
      mapStyle: 'satellite',
      satelliteSource: nextSource,
      waterBodyLabel: activeWaterBody?.name,
    });
    const griddedUrl = await renderAnnotatedGridScreenshot({
      rawScreenshotDataUrl: captured.dataUrl,
    });
    setGlareDetected(captured.glareDetected);
    setCapturedWaterMask(captured.waterMask ?? null);
    setRawScreenshotUrl(captured.dataUrl);
    setGriddedPreviewUrl(griddedUrl);
  };

  // Step 2 & 3: User initiates analysis with AI -> AI recognizes water body + geography + Spain restrictions -> User receives annotated screenshot with points 1-6 + summary
  const handleInitiateAiAnalysis = async () => {
    if (!rawScreenshotUrl) return;
    setIsAnalyzing(true);
    const showcaseStart = Date.now();
    try {
      const centerLng = (selectedBbox[0] + selectedBbox[2]) / 2;
      const centerLat = (selectedBbox[1] + selectedBbox[3]) / 2;
      const isNearActivePin =
        activeWaterBody &&
        Math.abs(activeWaterBody.centerLng - centerLng) < 0.015 &&
        Math.abs(activeWaterBody.centerLat - centerLat) < 0.015;

      const res = await fetch('/api/ai-advisor/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bbox: selectedBbox,
          griddedScreenshotBase64: griddedPreviewUrl,
          anglerGearNote,
          hintWaterBodyId: isNearActivePin ? activeWaterBody?.id : undefined,
          clientWaterMask: capturedWaterMask,
        }),
      });

      const analysis: WaterBodyArtifactAnalysis = await res.json();
      const spotsToRender =
        analysis.has_fishable_water === false ? [] : analysis.recommended_spots;

      // Render numbered spot circles (1..6) + A1..H8 grid directly onto the 1024x1024 screenshot
      const annotatedUrl = await renderAnnotatedGridScreenshot({
        rawScreenshotDataUrl: rawScreenshotUrl,
        spots: spotsToRender,
      });

      const elapsed = Date.now() - showcaseStart;
      if (elapsed < MIN_ANALYSIS_SHOWCASE_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_ANALYSIS_SHOWCASE_MS - elapsed)
        );
      }

      const reportId = analysis.report_id || generateReportId();
      const generatedAt = analysis.generated_at || formatReportTimestamp();
      const newArtifact: UserScreenshotArtifact = {
        id: `artifact-${Date.now()}`,
        report_id: reportId,
        createdAt: generatedAt,
        bbox: selectedBbox,
        mapStyle,
        satelliteSource,
        anglerGearNote,
        rawScreenshotDataUrl: rawScreenshotUrl,
        annotatedScreenshotDataUrl: annotatedUrl,
        analysis,
      };

      setCurrentArtifact(newArtifact);
      if (analysis.has_fishable_water !== false && spotsToRender.length > 0) {
        setSavedArtifacts((prev) => [newArtifact, ...prev]);
      }
      setWorkflowStep('artifact_ready');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadArtifactImage = (artifact: UserScreenshotArtifact) => {
    const link = document.createElement('a');
    const slug = artifact.analysis.water_body_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    link.download = `fishing-spot-grid-${slug}.png`;
    link.href = artifact.annotatedScreenshotDataUrl;
    link.click();
  };

  const previewScale = computeSelectionScale(selectedBbox);

  const centerLat = currentArtifact
    ? ((currentArtifact.bbox[1] + currentArtifact.bbox[3]) / 2).toFixed(5)
    : '0.00000';
  const centerLng = currentArtifact
    ? ((currentArtifact.bbox[0] + currentArtifact.bbox[2]) / 2).toFixed(5)
    : '0.00000';
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${centerLat},${centerLng}`;
  const artifactSlug = currentArtifact
    ? currentArtifact.analysis.water_body_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
    : '';
  const artifactFileName = `fishing-spot-grid-${artifactSlug}.png`;
  const reportId = currentArtifact
    ? currentArtifact.analysis.report_id || currentArtifact.report_id
    : '';
  const generatedAt = currentArtifact
    ? currentArtifact.analysis.generated_at || currentArtifact.createdAt
    : '';

  const handleCopyGps = async () => {
    const text = `${centerLat}, ${centerLng}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch {
      // Fallback
    }
    setCopiedGps(true);
    setTimeout(() => setCopiedGps(false), 2000);
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Floating Header */}
      <header className="fixed top-3 left-3 right-3 z-50 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800/90 bg-slate-950/90 px-4 py-2.5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 font-extrabold text-slate-950">
            FS
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">
              Fishing Spot · Spain
            </h1>
            <p className="text-[11px] text-slate-400">
              Locate exact fishing spots with satellite AI, terrain &amp; regulations
            </p>
          </div>
        </div>

        {/* Search Bar to Navigate to Any Spanish Water Body or GPS Coordinates */}
        <form
          onSubmit={handleSearchSpainLocation}
          className="flex flex-1 max-w-md items-center gap-1.5"
        >
          <input
            type="search"
            data-testid="water-body-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Spanish lake, river, town or GPS coordinates..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-slate-700 transition"
          >
            Go
          </button>
        </form>

        {/* Saved User Artifacts Switcher */}
        <div className="flex items-center gap-2">
          {savedArtifacts.length > 0 && (
            <div
              data-testid="my-artifacts-list"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-2.5 py-1 text-xs"
            >
              <span className="font-bold text-emerald-300">
                🗂️ Saved ({savedArtifacts.length}):
              </span>
              {savedArtifacts.slice(0, 3).map((art, idx) => (
                <button
                  key={art.id}
                  type="button"
                  data-testid={`saved-artifact-chip-${idx}`}
                  onClick={() => {
                    setCurrentArtifact(art);
                    setWorkflowStep('artifact_ready');
                  }}
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition ${
                    currentArtifact?.id === art.id &&
                    workflowStep === 'artifact_ready'
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {art.analysis.water_body_name.split('(')[0].trim()}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Interactive Map (Satellite / Terrain) — Clean screen without suggested spot chips */}
      <FishingMap
        mapStyle={mapStyle}
        onChangeMapStyle={setMapStyle}
        satelliteSource={satelliteSource}
        onChangeSatelliteSource={setSatelliteSource}
        activeWaterBody={activeWaterBody}
        flyToTarget={flyToTarget}
        onCaptureArea={handleCaptureArea}
      />

      {/* STEP 1 -> 2 MODAL: Streamlined Satellite Area Preview */}
      {workflowStep === 'screenshot_preview' && (
        <section
          data-testid="screenshot-preview-panel"
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4 pt-20 backdrop-blur-md overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            {/* Minimalist Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  Selected Area Preview
                </h2>
                <span
                  data-testid="satellite-capture-badge"
                  className="text-[11px] font-medium text-slate-400"
                >
                  🛰️ Satellite · {satelliteSource === 'pnoa' ? 'IGN PNOA HD' : 'Esri World'}
                  {mapStyle === 'terrain' ? ' (Auto-switched from Terrain)' : ''}
                </span>
              </div>

              {/* Clear Segmented Imagery Selector */}
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-950/80 p-1">
                <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Imagery:
                </span>
                <button
                  type="button"
                  onClick={() => handleSwitchPreviewSatelliteSource('pnoa')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    satelliteSource === 'pnoa'
                      ? 'bg-sky-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  IGN PNOA HD
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchPreviewSatelliteSource('esri')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    satelliteSource === 'esri'
                      ? 'bg-sky-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Esri World
                </button>
              </div>
            </div>

            {/* Concise Area Span & Scale Evaluation */}
            <div
              data-testid="selection-scale-banner"
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-xs ${
                previewScale.scaleMode === 'macro' || previewScale.isOverZoomed
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : 'border-slate-800 bg-slate-950/60 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-emerald-400">
                  📐 {previewScale.widthKm.toFixed(1)} × {previewScale.heightKm.toFixed(1)} km (~{previewScale.metersPerPixel} m/px)
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-[11px] text-slate-300">
                  {previewScale.scaleAdvice}
                </span>
              </div>
              {glareDetected && (
                <span className="text-[11px] font-medium text-amber-300">
                  ☀️ Surface glare detected — try switching imagery
                </span>
              )}
            </div>

            {/* Low/No Surface Water Warning before running analysis */}
            {capturedWaterMask && capturedWaterMask.waterCoveragePct < 0.8 && (
              <div
                data-testid="preview-no-water-warning"
                className="rounded-xl border border-amber-500/50 bg-amber-950/40 px-3.5 py-2 text-xs text-amber-200"
              >
                ⚠️ <strong>Little surface water detected</strong> ({capturedWaterMask.waterCoveragePct}%). Ensure water is clearly visible inside the frame.
              </div>
            )}

            {/* Captured Screenshot with A1–H8 Grid Preview */}
            <div className="flex justify-center">
              <img
                src={griddedPreviewUrl || rawScreenshotUrl}
                alt="Selected Water Body Screenshot"
                data-testid="captured-screenshot-preview"
                className="max-h-[380px] w-auto rounded-xl border border-slate-700/80 shadow-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setWorkflowStep('map_browse')}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                ← Back to Map
              </button>
              <button
                type="button"
                data-testid="initiate-ai-analysis-button"
                disabled={isAnalyzing}
                onClick={handleInitiateAiAnalysis}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    <span>Analyzing Location...</span>
                  </>
                ) : (
                  <span>Analyze Location</span>
                )}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STEP 3, 5 & 6 VIEW: User's Annotated Screenshot Artifact + Geography + Spain Regulations + Tactical Summary */}
      {workflowStep === 'artifact_ready' && currentArtifact && (
        <section
          data-testid="user-artifact-view"
          className="fixed top-20 bottom-0 left-0 right-0 z-40 overflow-y-auto bg-slate-950/90 p-4 pt-2 backdrop-blur-md"
        >
          <div className="mx-auto max-w-6xl rounded-2xl border border-emerald-500/50 bg-slate-900 shadow-2xl overflow-hidden">
            {/* Artifact Sticky Top Header — Buttons Always Anchored in Top Right */}
            <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/95 px-5 py-3.5 shadow-md backdrop-blur-md">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {currentArtifact.analysis.has_fishable_water === false ? (
                    <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold uppercase text-amber-300">
                      ⚠️ No Fishable Water Detected
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                      ✓ Location Analysis Ready
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {currentArtifact.analysis.region_label}
                  </span>

                  {/* GPS Coordinates Hyperlink + Copy to Clipboard Button */}
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-0.5 text-xs">
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open coordinates in Google Maps"
                      className="font-mono text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:underline transition"
                    >
                      📍 {centerLat}, {centerLng}
                    </a>
                    <button
                      type="button"
                      data-testid="copy-gps-button"
                      onClick={handleCopyGps}
                      title="Copy coordinates to clipboard"
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
                    >
                      {copiedGps ? (
                        <span className="text-emerald-400 font-bold">✓ Copied!</span>
                      ) : (
                        <span>📋 Copy</span>
                      )}
                    </button>
                  </div>
                </div>

                <h2
                  data-testid="recognized-water-body-name"
                  className="mt-1 text-xl font-bold tracking-tight text-white truncate"
                >
                  {currentArtifact.analysis.water_body_name}
                </h2>
              </div>

              {/* Action Buttons: Always in top-right corner with consistent primary/secondary hierarchy */}
              <div className="ml-auto shrink-0 flex flex-wrap items-center gap-2">
                {currentArtifact.analysis.has_fishable_water !== false &&
                  currentArtifact.analysis.recommended_spots.length > 0 && (
                    <>
                      <button
                        type="button"
                        data-testid="download-pdf-report-button"
                        onClick={() => downloadOnePageFishingPdfReport(currentArtifact)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-700 hover:text-white transition shadow-sm"
                      >
                        <span>📄</span> PDF Report
                      </button>
                      <button
                        type="button"
                        data-testid="download-artifact-button"
                        onClick={() => handleDownloadArtifactImage(currentArtifact)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-700 hover:text-white transition shadow-sm"
                      >
                        <span>🖼️</span> Map PNG
                      </button>
                    </>
                  )}
                <button
                  type="button"
                  data-testid="artifact-back-to-map-button"
                  onClick={() => setWorkflowStep('map_browse')}
                  className={
                    currentArtifact.analysis.has_fishable_water === false
                      ? 'inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 transition shadow-md'
                      : 'inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-md shadow-emerald-950/40'
                  }
                >
                  {currentArtifact.analysis.has_fishable_water === false
                    ? '← Reposition Map'
                    : '✨ Analyze Another Location'}
                </button>
              </div>
            </div>

            <div className="p-5">

            {currentArtifact.analysis.has_fishable_water === false ? (
              <div
                data-testid="no-water-detected-banner"
                className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start"
              >
                <div className="lg:col-span-5 overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-slate-950 shadow-2xl">
                  <img
                    src={currentArtifact.annotatedScreenshotDataUrl}
                    alt="Captured Area Without Fishable Water"
                    data-testid="annotated-artifact-screenshot"
                    className="w-full h-auto object-contain"
                  />
                </div>
                <div className="lg:col-span-7 space-y-4 rounded-2xl border border-amber-500/40 bg-amber-950/25 p-5">
                  <h3 className="text-lg font-extrabold text-amber-300">
                    No Fishable Water Body Found in This Screenshot
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-200">
                    {currentArtifact.analysis.no_water_reason ||
                      currentArtifact.analysis.water_body_summary}
                  </p>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs text-slate-300 space-y-1.5">
                    <p className="font-bold text-white">Why no spots were placed:</p>
                    <p>
                      To avoid hallucinating fishing spots on forests, hills, or dirt roads, spots and 1-page PDF reports are only generated when an actual river, reservoir, lake, pond, or coastline is verified inside the selected area.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorkflowStep('map_browse')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition"
                  >
                    <span>←</span> Reposition Map Over Water
                  </button>
                </div>
              </div>
            ) : (
            /* Two-Column Artifact Layout */
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Annotated Screenshot Artifact + Geography & Spain Regulations Cards */}
              <div className="lg:col-span-5 flex flex-col space-y-3">
                <div className="overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-950 shadow-2xl">
                  <img
                    src={currentArtifact.annotatedScreenshotDataUrl}
                    alt={`Annotated A1-H8 Grid for ${currentArtifact.analysis.water_body_name}`}
                    data-testid="annotated-artifact-screenshot"
                    className="w-full h-auto object-contain"
                  />
                </div>

                {/* Grid Legend */}
                <div className="w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300 space-y-1.5">
                  <p className="font-semibold text-slate-300 text-[11px] tracking-wide uppercase">
                    Spot Rank &amp; Structure Legend
                  </p>
                  <div className="flex flex-wrap items-center gap-3.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-slate-200">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                      <strong className="text-emerald-400 font-semibold">1–2:</strong> Top Ranked
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-200">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0ea5e9]" />
                      <strong className="text-sky-400 font-semibold">3–4:</strong> Mid Ranked
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-200">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" />
                      <strong className="text-amber-400 font-semibold">5–6:</strong> Secondary
                    </span>
                  </div>
                </div>

                {/* Fish Species Present in This Water Body */}
                {currentArtifact.analysis.species_present &&
                  currentArtifact.analysis.species_present.length > 0 && (
                    <div
                      data-testid="species-present-card"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-xs space-y-2"
                    >
                      <h3 className="font-semibold text-slate-200 tracking-wide">
                        Fish Species Present
                      </h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {currentArtifact.analysis.species_present.map((sp) => (
                          <div
                            key={sp.name}
                            className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2 space-y-0.5"
                          >
                            <div className="font-semibold text-slate-100 text-[11px]">
                              {sp.name}
                            </div>
                            <p className="text-[10px] text-slate-400">
                              <span className="text-slate-500 font-medium">Zone:</span> {sp.habitat_zone}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              <span className="text-slate-500 font-medium">Tactics:</span> {sp.recommended_approach}
                            </p>
                            {sp.regulation_note && (
                              <p className="text-[10px] text-amber-300/90 font-medium">
                                ⚖️ {sp.regulation_note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Geographical Features: Altitude, Road Availability & Shore Accessibility */}
                {currentArtifact.analysis.geographical_context && (
                  <div
                    data-testid="geographical-context-card"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-200 tracking-wide">
                        Geography &amp; Shore Access
                      </h3>
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-300 border border-slate-700/60">
                        ~{currentArtifact.analysis.geographical_context.water_elevation_m}m ASL DEM est. (Δ+{currentArtifact.analysis.geographical_context.relief_range_m}m)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      <strong className="text-slate-200">Road Access:</strong>{' '}
                      {currentArtifact.analysis.geographical_context.road_access_summary}
                    </p>
                    <p className="text-[11px] text-slate-300">
                      <strong className="text-slate-200">Shore Terrain:</strong>{' '}
                      {currentArtifact.analysis.geographical_context.shore_accessibility_summary}
                    </p>
                  </div>
                )}

                {/* Imagery Freshness & Extraction Honesty Notice */}
                {(currentArtifact.analysis.imagery_freshness_note ||
                  (currentArtifact.analysis.extraction_limitations &&
                    currentArtifact.analysis.extraction_limitations.length > 0)) && (
                  <div
                    data-testid="imagery-honesty-card"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-xs space-y-1.5"
                  >
                    <h3 className="font-semibold text-slate-200 tracking-wide">
                      Satellite Resolution &amp; Seasonal Flora Note
                    </h3>
                    {currentArtifact.analysis.imagery_freshness_note && (
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {currentArtifact.analysis.imagery_freshness_note}
                      </p>
                    )}
                    {currentArtifact.analysis.extraction_limitations &&
                      currentArtifact.analysis.extraction_limitations.length > 0 && (
                        <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-amber-300/90">
                          {currentArtifact.analysis.extraction_limitations.map((lim, li) => (
                            <li key={li}>{lim}</li>
                          ))}
                        </ul>
                      )}
                  </div>
                )}

                {/* Spain Fishing Regulations & Restricted Area Lookup */}
                {currentArtifact.analysis.restriction_check && (
                  <div
                    data-testid="restriction-check-card"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-xs space-y-2"
                  >
                    <h3 className="font-semibold text-slate-200 tracking-wide">
                      Spain Fishing Regulations &amp; Allowed Check
                    </h3>
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 font-medium text-amber-200 text-[11px]">
                      {currentArtifact.analysis.restriction_check.status_label}
                    </div>
                    <p className="text-[11px] text-slate-300">
                      <strong className="text-slate-200">Permits:</strong>{' '}
                      {currentArtifact.analysis.restriction_check.permits_required}
                    </p>
                    <p className="text-[11px] text-rose-300">
                      <strong className="text-rose-400">Restricted / Safety Zones:</strong>{' '}
                      {currentArtifact.analysis.restriction_check.prohibited_zones_warning}
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
                      {currentArtifact.analysis.restriction_check.regulations_list.map(
                        (rule, idx) => (
                          <li key={idx}>{rule}</li>
                        )
                      )}
                    </ul>
                    <p className="text-[10px] text-slate-400 italic border-t border-slate-800/80 pt-1.5">
                      {currentArtifact.analysis.restriction_check.disclaimer}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Tactical Summary (🎯 Where to Fish on the Grid + 🚗 Best Game Plan) */}
              <div className="lg:col-span-7 space-y-5 max-h-[78vh] overflow-y-auto pr-1">
                <div data-testid="where-to-fish-summary" className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                      🎯 Where to Fish on the Grid:
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      {currentArtifact.analysis.recommended_spots.length} Coordinates
                    </span>
                  </div>

                  {(() => {
                    const spots = currentArtifact.analysis.recommended_spots;
                    const hasTiers = spots.length >= 4;
                    const topSpots = hasTiers ? spots.filter((s) => s.rank <= 3) : spots;
                    const secondarySpots = hasTiers ? spots.filter((s) => s.rank > 3) : [];

                    const renderCard = (spot: (typeof spots)[0], isTop: boolean) => {
                      const rankStyle = getSpotRankStyle(spot.rank);
                      const accessBadge = formatAccessBadge(spot.access_mode);
                      const cleanTitle = cleanSpotTitle(
                        spot.title,
                        currentArtifact.analysis.water_body_name
                      );
                      const cleanWhy = cleanSpotText(
                        spot.why_this_spot || spot.rating_justification || ''
                      );
                      const cleanTactics = cleanSpotText(spot.how_to_fish || '');
                      const cleanAccess = cleanSpotText(spot.access_summary || '');

                      return (
                        <article
                          key={spot.rank}
                          data-testid={`artifact-spot-${spot.rank}`}
                          className={`group rounded-xl border p-4 transition-all space-y-3 text-xs leading-relaxed ${
                            isTop
                              ? 'border-emerald-500/40 bg-gradient-to-br from-slate-900 to-slate-950 hover:border-emerald-400'
                              : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700'
                          }`}
                        >
                          {/* Header: Rank Pill + Title + Coordinate + Target + Access */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${rankStyle.pillClasses}`}
                              >
                                <span className={`h-2 w-2 rounded-full ${rankStyle.dotColor}`} />
                                Spot {spot.rank}
                              </span>
                              {typeof spot.rating === 'number' && (
                                <span
                                  data-testid={`spot-rating-${spot.rank}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300"
                                >
                                  ★ {spot.rating.toFixed(1)}/10
                                </span>
                              )}
                              <h4 className="text-sm font-semibold text-slate-100">
                                {cleanTitle}
                              </h4>
                              <span className="font-mono text-xs text-sky-300 font-semibold">
                                [Grid {spot.cell_id}]
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                              {spot.target_species && spot.target_species.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 font-medium text-emerald-300">
                                  <span className="text-slate-400">Target:</span>{' '}
                                  {spot.target_species.join(', ')}
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium ${accessBadge.classes}`}
                              >
                                <span>{accessBadge.icon}</span>
                                <span>{accessBadge.label}</span>
                              </span>
                            </div>
                          </div>

                          {/* Human-focused Why this spot paragraph */}
                          <div
                            data-testid={`spot-justification-${spot.rank}`}
                            className="text-xs text-slate-300 leading-relaxed"
                          >
                            <strong className="text-emerald-400 font-semibold">
                              Why this spot:
                            </strong>{' '}
                            {cleanWhy}
                          </div>

                          {/* How to fish / Tactics */}
                          {cleanTactics && (
                            <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 text-xs text-slate-200 leading-relaxed">
                              <strong className="text-emerald-400 font-semibold">
                                How to fish:
                              </strong>{' '}
                              {cleanTactics}
                            </div>
                          )}

                          {/* Compact Structure & Access details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-slate-800/50 pt-2">
                            {spot.depth_structure && (
                              <div className="flex items-center gap-1">
                                <strong className="text-slate-300 font-medium">Structure:</strong>
                                <span>{cleanSpotText(spot.depth_structure)}</span>
                                <span
                                  title="Depths inferred from satellite shoreline topography; verify local bank footing on site"
                                  className="cursor-help text-slate-500 hover:text-slate-300"
                                >
                                  ⓘ
                                </span>
                              </div>
                            )}
                            {cleanAccess && (
                              <div className="flex items-center gap-1">
                                <strong className="text-slate-300 font-medium">Access &amp; Road Surface:</strong>
                                <span>{cleanAccess}</span>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    };

                    return (
                      <div className="space-y-5">
                        {hasTiers ? (
                          <>
                            {/* Tier 1 Header */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1.5">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                  <span>🏆</span> Top Recommended Spots (#1–#3)
                                </h4>
                                <span className="text-[11px] text-emerald-300/80 font-mono">
                                  High-Percentage Ambush Zones
                                </span>
                              </div>
                              {topSpots.map((spot) => renderCard(spot, true))}
                            </div>

                            {/* Tier 2 Header */}
                            <div className="space-y-3 pt-2">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                  <span>📍</span> Secondary &amp; Shoreline Spots (#4–#6)
                                </h4>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  Low-Light Roamers &amp; Warm-up Access
                                </span>
                              </div>
                              {secondarySpots.map((spot) => renderCard(spot, false))}
                            </div>
                          </>
                        ) : (
                          spots.map((spot) => renderCard(spot, spot.rank <= 2))
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Best Game Plan for This Area */}
                <div
                  data-testid="best-game-plan-summary"
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5"
                >
                  <h3 className="text-sm font-semibold text-slate-100 tracking-wide">
                    🚗 Best Game Plan for This Area:
                  </h3>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs leading-relaxed text-slate-300">
                    {currentArtifact.analysis.best_game_plan.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            )}
            </div>

            {/* Artifact Dedicated Metadata Footer */}
            <footer
              data-testid="artifact-footer"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 bg-slate-950/40 px-5 py-3.5 text-xs text-slate-400"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-slate-300 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                  ID: {reportId}
                </span>
                <span className="font-mono text-slate-400">
                  📁 {artifactFileName}
                </span>
                <span>
                  📅 {generatedAt}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sky-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                  v{currentArtifact.analysis.app_version || APP_VERSION}
                </span>
                <span className="text-[11px] text-slate-500">
                  AI Hydrographic Intelligence · IGN PNOA, Esri &amp; OpenStreetMap
                </span>
              </div>
            </footer>
          </div>
        </section>
      )}

      {/* Preparation State Stepper (Angler Wisdom & Hydrographic Intelligence) */}
      <AnalysisProgressDialog
        isOpen={isAnalyzing}
        waterBodyLabel={activeWaterBody?.name}
      />
    </main>
  );
}
