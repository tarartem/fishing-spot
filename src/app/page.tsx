'use client';

import React, { useEffect, useState } from 'react';
import { FishingMap } from '@/modules/map-grid/components/FishingMap';
import {
  captureMapAreaScreenshot,
  renderAnnotatedGridScreenshot,
  type CropBoxPixels,
} from '@/modules/map-grid/screenshot-compositor';
import { computeSelectionScale } from '@/modules/ai-advisor/geospatial-context.service';
import type {
  BoundingBox,
  MapStyleMode,
  UserScreenshotArtifact,
  WaterBodyArtifactAnalysis,
  WaterBodyPinSummary,
} from '@/shared/types/domain';

type WorkflowStep = 'map_browse' | 'screenshot_preview' | 'artifact_ready';

export default function HomePage() {
  const [mapStyle, setMapStyle] = useState<MapStyleMode>('satellite');
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

  // Screenshot & AI Artifact Workflow State
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('map_browse');
  const [selectedBbox, setSelectedBbox] = useState<BoundingBox>([
    -0.972, 39.222, -0.92, 39.262,
  ]);
  const [rawScreenshotUrl, setRawScreenshotUrl] = useState<string>('');
  const [griddedPreviewUrl, setGriddedPreviewUrl] = useState<string>('');
  const [anglerGearNote, setAnglerGearNote] = useState<string>(
    'WETA+ No. 3 (7g), WETA No. 2 (5g), Texas-rigged Yubari Craw & Yubari Worm (100mm)'
  );
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

  // Search any reservoir, river, or town in Spain via OpenStreetMap Nominatim
  const handleSearchSpainLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // 1. Check local curated Spain water bodies first
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

    // 2. Query OpenStreetMap Nominatim (prioritizing Spain `countrycodes=es`)
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

  // Step 1: User selects the area on the map -> creates screenshot -> sees screenshot on screen
  const handleCaptureArea = async (params: {
    canvas: HTMLCanvasElement | null;
    cropBox: CropBoxPixels | null;
    bbox: BoundingBox;
    waterBodyHint?: WaterBodyPinSummary | null;
  }) => {
    setSelectedBbox(params.bbox);
    const rawUrl = await captureMapAreaScreenshot({
      sourceCanvas: params.canvas,
      cropBox: params.cropBox,
      bbox: params.bbox,
      mapStyle,
      waterBodyLabel: params.waterBodyHint?.name,
    });
    const griddedUrl = await renderAnnotatedGridScreenshot({
      rawScreenshotDataUrl: rawUrl,
    });
    setRawScreenshotUrl(rawUrl);
    setGriddedPreviewUrl(griddedUrl);
    setWorkflowStep('screenshot_preview');
  };

  // Step 2 & 3: User initiates analysis with AI -> AI recognizes water body + geography + Spain restrictions -> User receives annotated screenshot with points 1-6 + summary
  const handleInitiateAiAnalysis = async () => {
    if (!rawScreenshotUrl) return;
    setIsAnalyzing(true);
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
        }),
      });

      const analysis: WaterBodyArtifactAnalysis = await res.json();

      // Render numbered spot circles (1..6) + A1..H8 grid directly onto the 1024x1024 screenshot
      const annotatedUrl = await renderAnnotatedGridScreenshot({
        rawScreenshotDataUrl: rawScreenshotUrl,
        spots: analysis.recommended_spots,
      });

      const newArtifact: UserScreenshotArtifact = {
        id: `artifact-${Date.now()}`,
        createdAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        bbox: selectedBbox,
        mapStyle,
        anglerGearNote,
        rawScreenshotDataUrl: rawScreenshotUrl,
        annotatedScreenshotDataUrl: annotatedUrl,
        analysis,
      };

      setCurrentArtifact(newArtifact);
      setSavedArtifacts((prev) => [newArtifact, ...prev]);
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

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Floating Header */}
      <header className="fixed top-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800/90 bg-slate-950/90 px-4 py-2.5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 font-extrabold text-slate-950">
            FS
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">
              Fishing Spot AI · España
            </h1>
            <p className="text-[11px] text-slate-400">
              Select Water Body Area · AI Terrain, Road Access &amp; Spain Coto/Permit Advisor
            </p>
          </div>
        </div>

        {/* Search Bar to Navigate to Any Spanish Water Body */}
        <form
          onSubmit={handleSearchSpainLocation}
          className="flex flex-1 max-w-md items-center gap-1.5"
        >
          <input
            type="search"
            data-testid="water-body-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Spain water body (e.g., Embalse de Cortes, Tous, Mequinenza, Albufera, Cijara)..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-slate-700 transition"
          >
            Go
          </button>
        </form>

        {/* Saved User Artifacts Switcher & Return to Map Button */}
        <div className="flex items-center gap-2">
          {savedArtifacts.length > 0 && (
            <div
              data-testid="my-artifacts-list"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-2.5 py-1 text-xs"
            >
              <span className="font-bold text-emerald-300">
                🗂️ My Artifacts ({savedArtifacts.length}):
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

          {workflowStep !== 'map_browse' && (
            <button
              type="button"
              data-testid="analyze-another-waterbody-button"
              onClick={() => setWorkflowStep('map_browse')}
              className="rounded-xl border border-emerald-400 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500 hover:text-slate-950 transition"
            >
              🗺️ Navigate to Another Water Body
            </button>
          )}
        </div>
      </header>

      {/* Interactive Map (Satellite / Terrain / Plain) — Clean screen without suggested spot chips */}
      <FishingMap
        mapStyle={mapStyle}
        onChangeMapStyle={setMapStyle}
        activeWaterBody={activeWaterBody}
        flyToTarget={flyToTarget}
        onCaptureArea={handleCaptureArea}
      />

      {/* STEP 1 -> 2 MODAL: User Sees Captured Screenshot on Screen & Initiates AI Analysis */}
      {workflowStep === 'screenshot_preview' && (
        <section
          data-testid="screenshot-preview-panel"
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4 pt-20 backdrop-blur-md overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-emerald-500/50 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                  Step 1 Complete · Exact Cropped Area (1024×1024 High-DPI)
                </span>
                <h2 className="mt-1 text-base font-bold text-white">
                  Selected Water Body Screenshot Preview
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setWorkflowStep('map_browse')}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                ✕ Retake Selection
              </button>
            </div>

            {/* Area Span & Scale Quality Guidance Banner */}
            <div
              data-testid="selection-scale-banner"
              className={`rounded-xl border px-3.5 py-2 text-xs ${
                previewScale.scaleMode === 'macro'
                  ? 'border-amber-400/50 bg-amber-950/40 text-amber-200'
                  : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
              }`}
            >
              <div className="font-bold">📐 {previewScale.scaleLabel}</div>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {previewScale.scaleMode === 'macro'
                  ? 'You selected a wider area (>8 km). The AI will judge macro river channel bends, large peninsulas, and bay mouths. For finer bank/ledge detail, you can zoom in or drag a tighter box.'
                  : 'High-resolution capture ready: AI will inspect underwater shelf color breaks, elevation slope, road access, and Spain fishing regulations for this exact sector.'}
              </p>
            </div>

            {/* Captured Screenshot with A1–H8 Grid Preview */}
            <div className="flex justify-center">
              <img
                src={griddedPreviewUrl || rawScreenshotUrl}
                alt="Selected Water Body Screenshot"
                data-testid="captured-screenshot-preview"
                className="max-h-[360px] w-auto rounded-xl border-2 border-slate-700 shadow-lg"
              />
            </div>

            {/* Optional Tackle / Lure Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Optional: Your Lures / Baits / Target Species (AI tailors &ldquo;How to fish it&rdquo;)
              </label>
              <input
                type="text"
                data-testid="angler-gear-input"
                value={anglerGearNote}
                onChange={(e) => setAnglerGearNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setWorkflowStep('map_browse')}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Back to Map
              </button>
              <button
                type="button"
                data-testid="initiate-ai-analysis-button"
                disabled={isAnalyzing}
                onClick={handleInitiateAiAnalysis}
                className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-950/60 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {isAnalyzing
                  ? '🔍 AI Analyzing Terrain, Altitude, Roads & Spain Regulations...'
                  : '🤖 Analyze with AI'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STEP 3, 5 & 6 VIEW: User's Annotated Screenshot Artifact + Geography + Spain Regulations + Tactical Summary */}
      {workflowStep === 'artifact_ready' && currentArtifact && (
        <section
          data-testid="user-artifact-view"
          className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/90 p-4 pt-20 backdrop-blur-md"
        >
          <div className="mx-auto max-w-6xl rounded-2xl border border-emerald-500/50 bg-slate-900 p-5 shadow-2xl">
            {/* Artifact Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold uppercase text-emerald-300">
                    ✓ User Fishing Artifact Saved
                  </span>
                  <span className="text-xs text-slate-400">
                    {currentArtifact.analysis.region_label}
                  </span>
                </div>
                <h2
                  data-testid="recognized-water-body-name"
                  className="mt-1 text-xl font-extrabold text-white"
                >
                  {currentArtifact.analysis.water_body_name}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="download-artifact-button"
                  onClick={() => handleDownloadArtifactImage(currentArtifact)}
                  className="rounded-xl border border-emerald-400 bg-emerald-950/80 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-900"
                >
                  ⬇️ Download Annotated Screenshot (PNG)
                </button>
                <button
                  type="button"
                  data-testid="artifact-back-to-map-button"
                  onClick={() => setWorkflowStep('map_browse')}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
                >
                  🗺️ Analyze Another Water Body on Map
                </button>
              </div>
            </div>

            {/* Two-Column Artifact Layout */}
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
                <div className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-slate-200">
                    📌 Grid Screenshot Legend:
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-full bg-[#ef4444]" />
                      <strong>🔴 1–2:</strong> Trophy Point / Shelf Edge
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-full bg-[#29b6f6]" />
                      <strong>🔵 3–4:</strong> Sheltered Bay / Road Access
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-full bg-[#f59e0b]" />
                      <strong>🟠 5–6:</strong> Canyon S-Bend / Gateway
                    </span>
                  </div>
                </div>

                {/* ⛰️ Geographical Features: Altitude, Road Availability & Shore Accessibility */}
                {currentArtifact.analysis.geographical_context && (
                  <div
                    data-testid="geographical-context-card"
                    className="w-full rounded-xl border border-sky-500/40 bg-sky-950/25 p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sky-300">
                        ⛰️ Geography, Altitude &amp; Shore Access
                      </h3>
                      <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-200">
                        {currentArtifact.analysis.geographical_context.water_elevation_m}m ASL (Δ+{currentArtifact.analysis.geographical_context.relief_range_m}m)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200">
                      <strong className="text-sky-200">🛣️ Road Access:</strong>{' '}
                      {currentArtifact.analysis.geographical_context.road_access_summary}
                    </p>
                    <p className="text-[11px] text-slate-200">
                      <strong className="text-sky-200">🥾 Shore Steepness:</strong>{' '}
                      {currentArtifact.analysis.geographical_context.shore_accessibility_summary}
                    </p>
                  </div>
                )}

                {/* ⚖️ Spain Fishing Regulations & Restricted Area Lookup */}
                {currentArtifact.analysis.restriction_check && (
                  <div
                    data-testid="restriction-check-card"
                    className="w-full rounded-xl border border-amber-500/40 bg-amber-950/25 p-3.5 text-xs space-y-2"
                  >
                    <h3 className="font-extrabold text-amber-300">
                      ⚖️ Spain Fishing Regulations &amp; Restrictions Check
                    </h3>
                    <div className="rounded-lg bg-slate-950/80 px-2.5 py-1.5 font-bold text-amber-200 text-[11px]">
                      {currentArtifact.analysis.restriction_check.status_label}
                    </div>
                    <p className="text-[11px] text-slate-200">
                      <strong className="text-amber-200">🪪 Permits:</strong>{' '}
                      {currentArtifact.analysis.restriction_check.permits_required}
                    </p>
                    <p className="text-[11px] text-rose-200">
                      <strong className="text-rose-300">🚫 Restricted / Safety Zones:</strong>{' '}
                      {currentArtifact.analysis.restriction_check.prohibited_zones_warning}
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
                      {currentArtifact.analysis.restriction_check.regulations_list.map(
                        (rule, idx) => (
                          <li key={idx}>{rule}</li>
                        )
                      )}
                    </ul>
                    <p className="text-[10px] text-slate-400 italic border-t border-slate-800 pt-1.5">
                      {currentArtifact.analysis.restriction_check.disclaimer}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Tactical Summary (🎯 Where to Fish on the Grid + 🚗 Best Game Plan) */}
              <div className="lg:col-span-7 space-y-5 max-h-[78vh] overflow-y-auto pr-1">
                <div data-testid="where-to-fish-summary" className="space-y-4">
                  <h3 className="text-base font-extrabold text-white">
                    🎯 Where to Fish on the Grid:
                  </h3>

                  {currentArtifact.analysis.recommended_spots.map((spot) => {
                    const emoji =
                      spot.color === 'red'
                        ? '🔴'
                        : spot.color === 'blue'
                          ? '🔵'
                          : '🟠';

                    return (
                      <article
                        key={spot.rank}
                        data-testid={`artifact-spot-${spot.rank}`}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2 text-xs leading-relaxed"
                      >
                        <h4 className="text-sm font-bold text-white">
                          {emoji} Spot {spot.rank}: {spot.title} (
                          {spot.grid_cells_label}){' '}
                          {spot.badge && (
                            <span className="text-amber-300">{spot.badge}</span>
                          )}
                        </h4>

                        <p className="text-slate-200">
                          <strong className="text-emerald-300">
                            {spot.why_label}
                          </strong>{' '}
                          {spot.why_this_spot}
                        </p>

                        {spot.secondary_label && spot.secondary_text && (
                          <p className="text-slate-200">
                            <strong className="text-sky-300">
                              {spot.secondary_label}
                            </strong>{' '}
                            {spot.secondary_text}
                          </p>
                        )}

                        {spot.how_to_fish && (
                          <p className="text-slate-200">
                            <strong className="text-amber-300">
                              How to fish it:
                            </strong>{' '}
                            {spot.how_to_fish}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>

                {/* 🚗 Best Game Plan for This Area */}
                <div
                  data-testid="best-game-plan-summary"
                  className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 space-y-2.5"
                >
                  <h3 className="text-sm font-extrabold text-emerald-300">
                    🚗 Best Game Plan for This Area:
                  </h3>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs leading-relaxed text-slate-100">
                    {currentArtifact.analysis.best_game_plan.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
