'use client';

import React, { useEffect, useState } from 'react';
import { FishingMap } from '@/modules/map-grid/components/FishingMap';
import {
  captureMapAreaScreenshot,
  renderAnnotatedGridScreenshot,
  type CropBoxPixels,
} from '@/modules/map-grid/screenshot-compositor';
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

  // Load curated water bodies on startup & default to Embalse de Cortes (Valencia)
  useEffect(() => {
    async function loadPins() {
      const res = await fetch('/api/water-bodies/pins');
      const data = await res.json();
      const pins: WaterBodyPinSummary[] = data.waterBodyPins ?? [];
      setWaterBodyPins(pins);
      if (pins.length > 0) {
        setActiveWaterBody(pins[0]);
      }
    }
    loadPins();
  }, []);

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

  // Step 2 & 3: User initiates analysis with AI -> AI recognizes water body + image/internet analysis -> User receives annotated screenshot with points 1-6 + summary
  const handleInitiateAiAnalysis = async () => {
    if (!rawScreenshotUrl) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai-advisor/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bbox: selectedBbox,
          griddedScreenshotBase64: griddedPreviewUrl,
          anglerGearNote,
          hintWaterBodyId: activeWaterBody?.id,
        }),
      });

      const analysis: WaterBodyArtifactAnalysis = await res.json();

      // Render numbered spot circles (1..6) + A1..H8 grid directly onto the screenshot
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

  const filteredPins = waterBodyPins.filter((pin) =>
    searchQuery.trim()
      ? pin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pin.regionLabel.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

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
              Fishing Spot AI
            </h1>
            <p className="text-[11px] text-slate-400">
              Select Water Body on Map · AI Grid Screenshot &amp; Game Plan
            </p>
          </div>
        </div>

        {/* Search Bar to Navigate to Water Body */}
        <div className="flex flex-1 max-w-md items-center gap-2">
          <input
            type="search"
            data-testid="water-body-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Navigate to water body (e.g., Valencia, Cortes, Tous, Mequinenza, Zegrze)..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
        </div>

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

      {/* Interactive Map (Satellite / Terrain / Plain) */}
      <FishingMap
        mapStyle={mapStyle}
        onChangeMapStyle={setMapStyle}
        waterBodyPins={filteredPins}
        activeWaterBody={activeWaterBody}
        onNavigateToWaterBody={(pin) => {
          setActiveWaterBody(pin);
          setWorkflowStep('map_browse');
        }}
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
                  Step 1 Complete · Map Area Captured
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
                ✕ Retake on Map
              </button>
            </div>

            {/* Captured Screenshot with A1–H8 Grid Preview */}
            <div className="flex justify-center">
              <img
                src={griddedPreviewUrl || rawScreenshotUrl}
                alt="Selected Water Body Screenshot"
                data-testid="captured-screenshot-preview"
                className="max-h-[380px] w-auto rounded-xl border-2 border-slate-700 shadow-lg"
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
                  ? '🔍 AI Recognizing Water Body & Analyzing Grid...'
                  : '🤖 Analyze with AI'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STEP 3, 5 & 6 VIEW: User's Annotated Screenshot Artifact + Tactical Summary & Best Game Plan */}
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

            {/* Two-Column Artifact Layout: Left = Annotated Screenshot with Points 1–6 & A1–H8 Grid; Right = 🎯 Where to Fish on the Grid + 🚗 Best Game Plan */}
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Annotated Screenshot Artifact */}
              <div className="lg:col-span-5 flex flex-col items-center space-y-3">
                <div className="overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-950 shadow-2xl">
                  <img
                    src={currentArtifact.annotatedScreenshotDataUrl}
                    alt={`Annotated A1-H8 Grid for ${currentArtifact.analysis.water_body_name}`}
                    data-testid="annotated-artifact-screenshot"
                    className="w-full h-auto object-contain"
                  />
                </div>
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
                      <strong>🔵 3–4:</strong> Sheltered Bay / Beach Access
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-full bg-[#f59e0b]" />
                      <strong>🟠 5–6:</strong> Canyon S-Bend / Gateway
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Tactical Summary (🎯 Where to Fish on the Grid + 🚗 Best Game Plan) */}
              <div className="lg:col-span-7 space-y-5 max-h-[72vh] overflow-y-auto pr-1">
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
