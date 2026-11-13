'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Calendar,
  Car,
  ChevronDown,
  Compass,
  Crosshair,
  FileText,
  Fish,
  Footprints,
  Globe,
  Hash,
  Image as ImageIcon,
  Info,
  Layers,
  MapPin,
  Mountain,
  Navigation,
  RotateCcw,
  Sailboat,
  Satellite,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  SunMedium,
  Target,
  Trophy,
  Truck,
  Undo2,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { FishingMap } from '@/modules/map-grid/components/FishingMap';
import {
  AnalysisProgressDialog,
  MIN_ANALYSIS_SHOWCASE_MS,
} from '@/modules/map-grid/components/AnalysisProgressDialog';
import {
  captureMapAreaScreenshot,
  renderAnnotatedGridScreenshot,
  type CaptureImagerySource,
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
  getOptimalBbox,
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
  icon: LucideIcon;
  label: string;
  classes: string;
} {
  switch (mode) {
    case 'car_asphalt':
      return {
        icon: Car,
        label: 'Paved Road',
        classes: 'border-[#2c3a2f] bg-[#1c251e] text-[#dfd7c8]',
      };
    case 'dirt_track':
      return {
        icon: Truck,
        label: 'Vehicle Track',
        classes: 'border-[#2c3a2f] bg-[#1c251e] text-[#dfd7c8]',
      };
    case 'boat_only':
      return {
        icon: Sailboat,
        label: 'Watercraft Only',
        classes: 'border-rose-900/60 bg-rose-950/40 text-rose-300',
      };
    default:
      return {
        icon: Footprints,
        label: 'Shore Footpath',
        classes: 'border-[#2c3a2f] bg-[#1c251e] text-[#dfd7c8]',
      };
  }
}

function getSpotRankStyle(rank: number) {
  if (rank <= 2) {
    return {
      pillClasses: 'border-[#d96b27]/40 bg-[#d96b27]/15 text-[#d96b27]',
      dotColor: 'bg-[#d96b27]',
      category: 'Prime Strike Zone',
    };
  }
  if (rank <= 4) {
    return {
      pillClasses: 'border-[#688a5b]/40 bg-[#688a5b]/15 text-[#688a5b]',
      dotColor: 'bg-[#688a5b]',
      category: 'Structure Holding',
    };
  }
  return {
    pillClasses: 'border-[#2c3a2f] bg-[#1c251e] text-[#918b80]',
    dotColor: 'bg-[#918b80]',
    category: 'Secondary Pocket',
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

  // Active Artifact & Saved Artifacts Gallery + My Spots Dropdown
  const [currentArtifact, setCurrentArtifact] =
    useState<UserScreenshotArtifact | null>(null);
  const [savedArtifacts, setSavedArtifacts] = useState<
    UserScreenshotArtifact[]
  >([]);
  const [isMySpotsOpen, setIsMySpotsOpen] = useState<boolean>(false);
  const mySpotsRef = useRef<HTMLDivElement | null>(null);
  const [previewImagery, setPreviewImagery] =
    useState<CaptureImagerySource>('pnoa');
  const [originalBboxBeforeOptimization, setOriginalBboxBeforeOptimization] =
    useState<BoundingBox | null>(null);

  // Close My Spots dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mySpotsRef.current && !mySpotsRef.current.contains(e.target as Node)) {
        setIsMySpotsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMySpotsOpen(false);
      }
    };
    if (isMySpotsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMySpotsOpen]);

  const formatRelativeTime = (isoString?: string): string => {
    if (!isoString) return 'Recent';
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return 'Recent';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  };

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

  // Search any reservoir, river, town, or direct GPS coordinates
  const handleSearchLocation = async (e: React.FormEvent) => {
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

    // 2. Check local curated water bodies first
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

    // 3. Query OpenStreetMap Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=1`
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

  const selectionCenterLng = (selectedBbox[0] + selectedBbox[2]) / 2;
  const selectionCenterLat = (selectedBbox[1] + selectedBbox[3]) / 2;
  const nearestPin = waterBodyPins.find(
    (p) =>
      Math.hypot(
        p.centerLng - selectionCenterLng,
        p.centerLat - selectionCenterLat
      ) < 0.25
  );
  const effectiveWaterBodyLabel =
    activeWaterBody?.name ||
    nearestPin?.name ||
    (flyToTarget?.label ? flyToTarget.label.split(',')[0].trim() : undefined);

  // Step 1: User selects the area on the map -> captures screenshot -> sees preview on screen
  const handleCaptureArea = async (params: {
    canvas: HTMLCanvasElement | null;
    cropBox: CropBoxPixels | null;
    bbox: BoundingBox;
    waterBodyHint?: WaterBodyPinSummary | null;
  }) => {
    setSelectedBbox(params.bbox);
    setOriginalBboxBeforeOptimization(null);
    const initialImagery: CaptureImagerySource = satelliteSource;
    setPreviewImagery(initialImagery);

    const cLng = (params.bbox[0] + params.bbox[2]) / 2;
    const cLat = (params.bbox[1] + params.bbox[3]) / 2;
    const localPin = waterBodyPins.find(
      (p) => Math.hypot(p.centerLng - cLng, p.centerLat - cLat) < 0.25
    );
    const wbLabel =
      params.waterBodyHint?.name ||
      activeWaterBody?.name ||
      localPin?.name ||
      (flyToTarget?.label ? flyToTarget.label.split(',')[0].trim() : undefined);

    const captured = await captureMapAreaScreenshot({
      sourceCanvas: params.canvas,
      cropBox: params.cropBox,
      bbox: params.bbox,
      mapStyle: 'satellite',
      satelliteSource,
      imagerySource: satelliteSource,
      waterBodyLabel: wbLabel,
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

  const handleSwitchPreviewImagery = async (
    nextImagery: CaptureImagerySource
  ) => {
    setPreviewImagery(nextImagery);
    if (nextImagery !== 'terrain') {
      setSatelliteSource(nextImagery);
    }
    const captured = await captureMapAreaScreenshot({
      bbox: selectedBbox,
      mapStyle: nextImagery === 'terrain' ? 'terrain' : 'satellite',
      satelliteSource:
        nextImagery === 'terrain' ? satelliteSource : nextImagery,
      imagerySource: nextImagery,
      waterBodyLabel: effectiveWaterBodyLabel,
    });
    const griddedUrl = await renderAnnotatedGridScreenshot({
      rawScreenshotDataUrl: captured.dataUrl,
    });
    setGlareDetected(captured.glareDetected);
    setCapturedWaterMask(captured.waterMask ?? null);
    setRawScreenshotUrl(captured.dataUrl);
    setGriddedPreviewUrl(griddedUrl);
  };

  const handleOptimizeArea = async () => {
    setOriginalBboxBeforeOptimization(selectedBbox);
    const optBbox = getOptimalBbox(selectedBbox, 1.0);
    setSelectedBbox(optBbox);
    const captured = await captureMapAreaScreenshot({
      bbox: optBbox,
      mapStyle: previewImagery === 'terrain' ? 'terrain' : 'satellite',
      satelliteSource:
        previewImagery === 'terrain'
          ? satelliteSource
          : (previewImagery as SatelliteSource),
      imagerySource: previewImagery,
      waterBodyLabel: effectiveWaterBodyLabel,
    });
    const griddedUrl = await renderAnnotatedGridScreenshot({
      rawScreenshotDataUrl: captured.dataUrl,
    });
    setGlareDetected(captured.glareDetected);
    setCapturedWaterMask(captured.waterMask ?? null);
    setRawScreenshotUrl(captured.dataUrl);
    setGriddedPreviewUrl(griddedUrl);
  };

  const handleRevertArea = async () => {
    if (!originalBboxBeforeOptimization) return;
    const prev = originalBboxBeforeOptimization;
    setOriginalBboxBeforeOptimization(null);
    setSelectedBbox(prev);
    const captured = await captureMapAreaScreenshot({
      bbox: prev,
      mapStyle: previewImagery === 'terrain' ? 'terrain' : 'satellite',
      satelliteSource:
        previewImagery === 'terrain'
          ? satelliteSource
          : (previewImagery as SatelliteSource),
      imagerySource: previewImagery,
      waterBodyLabel: effectiveWaterBodyLabel,
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
    <main className="relative h-screen w-screen overflow-hidden bg-[#0e130f] text-[#dfd7c8]">
      {/* Top Floating Header */}
      <header className="fixed top-3 left-3 right-3 z-50 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2c3a2f] bg-[#151c16]/95 px-4 py-2 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d96b27]/40 bg-[#d96b27]/15 text-[#d96b27] shadow-sm">
            <Fish className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#dfd7c8] leading-tight tracking-wide">
              FISHING SPOT
            </h1>
            <p className="text-[10px] font-mono tracking-wider uppercase text-[#918b80]">
              Find top fishing spots using satellite &amp; terrain data · Tactical Recon
            </p>
          </div>
        </div>

        {/* Tactical Angler Mode Indicators (Shore/Boat & Multi-Species) */}
        <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono border-l border-[#2c3a2f] pl-3">
          <span className="flex items-center gap-1 rounded border border-[#2c3a2f] bg-[#1c251e] px-2 py-0.5 text-[#dfd7c8]">
            <Waves className="h-3 w-3 text-[#688a5b]" />
            <span>Shore &amp; Boat</span>
          </span>
          <span className="flex items-center gap-1 rounded border border-[#2c3a2f] bg-[#1c251e] px-2 py-0.5 text-[#dfd7c8]">
            <Fish className="h-3 w-3 text-[#d96b27]" />
            <span>Multi-Species</span>
          </span>
        </div>

        {/* Search Bar to Navigate to Any Water Body or GPS Coordinates */}
        <form
          onSubmit={handleSearchLocation}
          className="relative flex flex-1 max-w-md items-center gap-1.5"
        >
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#918b80] pointer-events-none" />
            <input
              type="search"
              data-testid="water-body-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lake, river, town or GPS coordinates..."
              className="w-full rounded-lg border border-[#2c3a2f] bg-[#0e130f]/90 pl-8 pr-3 py-1.5 text-xs text-[#dfd7c8] placeholder-[#918b80] focus:border-[#d96b27] focus:outline-none transition"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-[#2c3a2f] bg-[#1c251e] px-3.5 py-1.5 text-xs font-semibold text-[#dfd7c8] hover:bg-[#2c3a2f] transition shrink-0"
          >
            Go
          </button>
        </form>

        {/* Saved User Reports: My Spots Dropdown */}
        <div ref={mySpotsRef} className="relative flex items-center gap-2">
          <button
            type="button"
            data-testid="my-spots-dropdown-button"
            onClick={() => setIsMySpotsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-lg border border-[#2c3a2f] bg-[#1c251e] px-3 py-1.5 text-xs font-semibold text-[#dfd7c8] hover:bg-[#2c3a2f] transition"
          >
            <Bookmark className="h-3.5 w-3.5 text-[#d96b27]" />
            <span>My spots ({savedArtifacts.length})</span>
            <ChevronDown className={`h-3 w-3 text-[#d96b27]/80 transition-transform duration-150 ${isMySpotsOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMySpotsOpen && (
            <div
              data-testid="my-spots-dropdown-menu"
              className="absolute top-full right-0 mt-2 w-80 rounded-xl border border-[#2c3a2f] bg-[#151c16]/95 p-2.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#2c3a2f]/80 mb-1">
                <span className="text-xs font-bold text-[#dfd7c8] tracking-wide">Previous Reports</span>
                <span className="text-[10px] font-mono text-[#d96b27] bg-[#1c251e] border border-[#2c3a2f] px-2 py-0.5 rounded">
                  {savedArtifacts.length}
                </span>
              </div>

              {savedArtifacts.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#918b80]">
                  No saved fishing spots yet. Select an area on the map to run your first report.
                </div>
              ) : (
                <div data-testid="my-artifacts-list" className="max-h-72 overflow-y-auto space-y-1 pr-0.5">
                  {savedArtifacts.map((art, idx) => (
                    <button
                      key={art.id}
                      type="button"
                      data-testid={`saved-artifact-chip-${idx}`}
                      onClick={() => {
                        setCurrentArtifact(art);
                        setWorkflowStep('artifact_ready');
                        setIsMySpotsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition group ${
                        currentArtifact?.id === art.id && workflowStep === 'artifact_ready'
                          ? 'bg-[#d96b27]/15 border border-[#d96b27]/40 text-[#dfd7c8]'
                          : 'hover:bg-[#1c251e]'
                      }`}
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="text-xs font-bold text-white group-hover:text-sky-300 truncate">
                          {art.analysis.water_body_name.split('(')[0].trim()}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Fish className="h-3 w-3 text-sky-400" />
                            <span>{art.analysis.recommended_spots.length} spots</span>
                          </span>
                          <span>·</span>
                          <span>{formatRelativeTime(art.createdAt || art.analysis.generated_at)}</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 group-hover:text-sky-300">→</span>
                    </button>
                  ))}
                </div>
              )}
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/85 p-4 pt-20 backdrop-blur-md overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-xl border border-[#2c3a2f] bg-[#151c16] p-5 shadow-2xl space-y-4">
            {/* Minimalist Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2c3a2f] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#dfd7c8] tracking-wide">
                  Selected Area Preview
                </h2>
                <span
                  data-testid="satellite-capture-badge"
                  className="text-[11px] font-medium text-[#918b80] flex items-center gap-1.5 mt-0.5"
                >
                  {previewImagery === 'terrain' ? (
                    <>
                      <Mountain className="h-3 w-3 text-[#688a5b]" />
                      <span>Terrain · OpenTopoMap</span>
                    </>
                  ) : (
                    <>
                      <Satellite className="h-3 w-3 text-[#d96b27]" />
                      <span>
                        Satellite ·{' '}
                        {previewImagery === 'pnoa' ? 'IGN PNOA HD' : 'Esri World'}
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Segmented Imagery Selector: PNOA HD | Esri World | Terrain */}
              <div
                data-testid="preview-imagery-selector"
                className="inline-flex items-center gap-1 rounded-lg border border-[#2c3a2f] bg-[#0e130f]/90 p-0.5"
              >
                <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#918b80]">
                  Imagery:
                </span>
                {(
                  [
                    { id: 'pnoa', label: 'PNOA HD', icon: Layers },
                    { id: 'esri', label: 'Esri Alt', icon: Globe },
                    { id: 'terrain', label: 'Terrain', icon: Mountain },
                  ] as const
                ).map((src) => {
                  const Icon = src.icon;
                  const isActive = previewImagery === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      data-testid={`preview-imagery-${src.id}`}
                      onClick={() => handleSwitchPreviewImagery(src.id)}
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

            {/* Smart Scale Classification & 1-Click Optimize Area */}
            <div
              data-testid="selection-scale-banner"
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs ${
                previewScale.smartScale.tier === 'optimal'
                  ? 'border-[#688a5b]/40 bg-[#1c251e] text-[#dfd7c8]'
                  : previewScale.smartScale.tier === 'too_tight'
                  ? 'border-[#d96b27]/40 bg-[#1c251e] text-[#dfd7c8]'
                  : 'border-orange-500/40 bg-[#1c251e] text-[#dfd7c8]'
              }`}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span
                  data-testid="scale-tier-badge"
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    previewScale.smartScale.tier === 'optimal'
                      ? 'bg-[#688a5b]/20 text-[#688a5b] border border-[#688a5b]/40'
                      : previewScale.smartScale.tier === 'too_tight'
                      ? 'bg-[#d96b27]/20 text-[#d96b27] border border-[#d96b27]/40'
                      : 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      previewScale.smartScale.tier === 'optimal'
                        ? 'bg-[#688a5b]'
                        : previewScale.smartScale.tier === 'too_tight'
                        ? 'bg-[#d96b27]'
                        : 'bg-orange-400'
                    }`}
                  />
                  <span>{previewScale.smartScale.badgeLabel}</span>
                </span>
                <span className="text-[11px] text-[#dfd7c8]/90">
                  {previewScale.smartScale.explanation}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-[#918b80] bg-[#0e130f] px-2 py-0.5 rounded border border-[#2c3a2f]">
                  <Crosshair className="h-3 w-3 text-[#d96b27]" />
                  <span>100m Grid · ~35m Cast Arc</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                {previewScale.smartScale.canOptimize && !originalBboxBeforeOptimization && (
                  <button
                    type="button"
                    data-testid="optimize-area-button"
                    onClick={handleOptimizeArea}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#688a5b] hover:bg-[#58774c] px-3 py-1 text-xs font-bold text-stone-950 shadow transition"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Optimize Area</span>
                  </button>
                )}
                {originalBboxBeforeOptimization && (
                  <button
                    type="button"
                    data-testid="revert-area-button"
                    onClick={handleRevertArea}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#2c3a2f] bg-[#1c251e] px-3 py-1 text-xs font-semibold text-[#dfd7c8] hover:bg-[#2c3a2f] transition"
                  >
                    <Undo2 className="h-3 w-3" />
                    <span>Revert</span>
                  </button>
                )}
                {glareDetected && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-[#d96b27]">
                    <SunMedium className="h-3 w-3" />
                    <span>Glare detected</span>
                  </span>
                )}
              </div>
            </div>

            {/* Low/No Surface Water Warning before running analysis */}
            {capturedWaterMask && capturedWaterMask.waterCoveragePct < 0.8 && (
              <div
                data-testid="preview-no-water-warning"
                className="flex items-center gap-2 rounded-lg border border-[#d96b27]/40 bg-[#1c251e] px-3.5 py-2 text-xs text-[#dfd7c8]"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-[#d96b27] shrink-0" />
                <span>
                  <strong className="text-[#d96b27]">Little surface water detected</strong> ({capturedWaterMask.waterCoveragePct}%). Ensure water is clearly visible inside the frame.
                </span>
              </div>
            )}

            {/* Captured Screenshot with A1–H8 Grid Preview */}
            <div className="flex justify-center">
              <img
                src={griddedPreviewUrl || rawScreenshotUrl}
                alt="Selected Water Body Screenshot"
                data-testid="captured-screenshot-preview"
                className="max-h-[380px] w-auto rounded-lg border border-[#2c3a2f] shadow-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setWorkflowStep('map_browse')}
                className="rounded-lg border border-[#2c3a2f] px-3.5 py-1.5 text-xs font-semibold text-[#dfd7c8] hover:bg-[#1c251e] transition"
              >
                Back to Map
              </button>
              <button
                type="button"
                data-testid="initiate-ai-analysis-button"
                disabled={isAnalyzing}
                onClick={handleInitiateAiAnalysis}
                className="inline-flex items-center gap-2 rounded-lg bg-[#d96b27] hover:bg-[#c2571a] active:bg-[#a84713] px-5 py-2 text-xs sm:text-sm font-bold text-stone-950 shadow-xl shadow-stone-950/70 border border-[#ea7c3a]/50 transition disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-950 border-t-transparent" />
                    <span>Analyzing Fishing Waters...</span>
                  </>
                ) : (
                  <>
                    <Crosshair className="h-4 w-4 stroke-[2.5]" />
                    <span>ANALYZE FISHING WATERS</span>
                  </>
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
          className="fixed top-20 bottom-0 left-0 right-0 z-40 overflow-y-auto bg-stone-950/90 p-4 pt-2 backdrop-blur-md"
        >
          <div className="mx-auto max-w-6xl rounded-xl border border-[#2c3a2f] bg-[#151c16] shadow-2xl overflow-hidden">
            {/* Artifact Sticky Top Header — Buttons Always Anchored in Top Right */}
            <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#2c3a2f] bg-[#151c16]/95 px-5 py-3 shadow-md backdrop-blur-md">
              <div className="min-w-0 flex-1 space-y-1">
                {/* Row 1: Title & Optional Warning Badge */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <h2
                    data-testid="recognized-water-body-name"
                    className="text-xl font-bold tracking-tight text-[#dfd7c8] truncate"
                  >
                    {currentArtifact.analysis.water_body_name}
                  </h2>
                  {currentArtifact.analysis.has_fishable_water === false && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-[#d96b27]/15 border border-[#d96b27]/30 px-2 py-0.5 text-[11px] font-bold uppercase text-[#d96b27]">
                      <AlertTriangle className="h-3 w-3 text-[#d96b27]" />
                      <span>No Fishable Water Detected</span>
                    </span>
                  )}
                </div>

                {/* Row 2: Subtitle (Region) · GPS Location with 2-Rectangles Copy Icon */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#918b80]">
                  <span className="truncate max-w-[340px] sm:max-w-[440px] text-[#dfd7c8]/90">
                    {currentArtifact.analysis.region_label}
                  </span>
                  <span className="text-[#2c3a2f]">·</span>
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-[#2c3a2f] bg-[#0e130f]/80 px-2 py-0.5 text-xs">
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open coordinates in Google Maps"
                      className="font-mono text-[11px] font-medium text-[#d96b27] hover:text-[#ea7c3a] hover:underline transition flex items-center gap-1"
                    >
                      <MapPin className="h-3 w-3 text-[#d96b27]" />
                      <span>{centerLat}, {centerLng}</span>
                    </a>
                    <button
                      type="button"
                      data-testid="copy-gps-button"
                      onClick={handleCopyGps}
                      title="Copy coordinates to clipboard"
                      className="inline-flex items-center gap-1 rounded p-0.5 text-[#918b80] hover:bg-[#1c251e] hover:text-[#dfd7c8] transition"
                    >
                      {copiedGps ? (
                        <span className="text-[10px] text-[#d96b27] font-bold px-1">✓ Copied!</span>
                      ) : (
                        <svg
                          className="h-3.5 w-3.5 text-[#918b80] hover:text-[#dfd7c8]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-label="Copy coordinates"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
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
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2c3a2f] bg-[#1c251e] px-3.5 py-1.5 text-xs font-semibold text-[#dfd7c8] hover:bg-[#2c3a2f] transition shadow-sm"
                      >
                        <FileText className="h-3.5 w-3.5 text-[#dfd7c8]" />
                        <span>PDF Report</span>
                      </button>
                      <button
                        type="button"
                        data-testid="download-artifact-button"
                        onClick={() => handleDownloadArtifactImage(currentArtifact)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2c3a2f] bg-[#1c251e] px-3.5 py-1.5 text-xs font-semibold text-[#dfd7c8] hover:bg-[#2c3a2f] transition shadow-sm"
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-[#dfd7c8]" />
                        <span>Map PNG</span>
                      </button>
                    </>
                  )}
                <button
                  type="button"
                  data-testid="artifact-back-to-map-button"
                  onClick={() => setWorkflowStep('map_browse')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#d96b27] hover:bg-[#c2571a] active:bg-[#a84713] px-4 py-1.5 text-xs font-bold text-stone-950 border border-[#ea7c3a]/50 transition shadow-sm"
                >
                  {currentArtifact.analysis.has_fishable_water === false ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reposition Map</span>
                    </>
                  ) : (
                    <>
                      <Crosshair className="h-3.5 w-3.5" />
                      <span>Analyze Another Location</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-5">

            {currentArtifact.analysis.has_fishable_water === false ? (
              <div
                data-testid="no-water-detected-banner"
                className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start"
              >
                <div className="lg:col-span-5 overflow-hidden rounded-xl border border-[#d96b27]/40 bg-[#0e130f] shadow-xl">
                  <img
                    src={currentArtifact.annotatedScreenshotDataUrl}
                    alt="Captured Area Without Fishable Water"
                    data-testid="annotated-artifact-screenshot"
                    className="w-full h-auto object-contain"
                  />
                </div>
                <div className="lg:col-span-7 space-y-4 rounded-xl border border-[#d96b27]/40 bg-[#1c251e] p-5">
                  <h3 className="text-lg font-bold text-[#d96b27]">
                    No Fishable Water Body Found in This Screenshot
                  </h3>
                  <p className="text-sm leading-relaxed text-[#dfd7c8]">
                    {currentArtifact.analysis.no_water_reason ||
                      currentArtifact.analysis.water_body_summary}
                  </p>
                  <div className="rounded-lg border border-[#2c3a2f] bg-[#0e130f]/80 p-3.5 text-xs text-[#dfd7c8] space-y-1.5">
                    <p className="font-bold text-[#dfd7c8]">Why no spots were placed:</p>
                    <p>
                      To avoid hallucinating fishing spots on forests, hills, or dirt roads, spots and 1-page PDF reports are only generated when an actual river, reservoir, lake, pond, or coastline is verified inside the selected area.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorkflowStep('map_browse')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#d96b27] hover:bg-[#c2571a] px-4 py-2 text-xs font-bold text-stone-950 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reposition Map Over Water</span>
                  </button>
                </div>
              </div>
            ) : (
            /* Two-Column Artifact Layout */
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Annotated Screenshot Artifact + Geography & Spain Regulations Cards */}
              <div className="lg:col-span-5 flex flex-col space-y-3">
                <div className="overflow-hidden rounded-xl border border-[#2c3a2f] bg-[#0e130f] shadow-xl">
                  <img
                    src={currentArtifact.annotatedScreenshotDataUrl}
                    alt={`Annotated A1-H8 Grid for ${currentArtifact.analysis.water_body_name}`}
                    data-testid="annotated-artifact-screenshot"
                    className="w-full h-auto object-contain"
                  />
                </div>

                {/* Fish Species Present in This Water Body */}
                {currentArtifact.analysis.species_present &&
                  currentArtifact.analysis.species_present.length > 0 && (
                    <div
                      data-testid="species-present-card"
                      className="w-full rounded-lg border border-[#2c3a2f] bg-[#0e130f]/80 p-3.5 text-xs space-y-2"
                    >
                      <h3 className="font-semibold text-[#dfd7c8] tracking-wide flex items-center gap-1.5">
                        <Fish className="h-3.5 w-3.5 text-[#d96b27]" />
                        <span>Fish Species Present</span>
                      </h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {currentArtifact.analysis.species_present.map((sp) => (
                          <div
                            key={sp.name}
                            className="rounded-md border border-[#2c3a2f] bg-[#1c251e] p-2 space-y-0.5"
                          >
                            <div className="font-semibold text-[#dfd7c8] text-[11px]">
                              {sp.name}
                            </div>
                            <p className="text-[10px] text-[#918b80]">
                              <span className="text-[#918b80] font-medium">Zone:</span> {sp.habitat_zone}
                            </p>
                            <p className="text-[10px] text-[#918b80]">
                              <span className="text-[#918b80] font-medium">Tactics:</span> {sp.recommended_approach}
                            </p>
                            {sp.regulation_note && (
                              <p className="text-[10px] text-[#d96b27] font-medium flex items-center gap-1 mt-0.5">
                                <Scale className="h-3 w-3 text-[#d96b27] shrink-0" />
                                <span>{sp.regulation_note}</span>
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
                    className="w-full rounded-lg border border-[#2c3a2f] bg-[#0e130f]/80 p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[#dfd7c8] tracking-wide flex items-center gap-1.5">
                        <Compass className="h-3.5 w-3.5 text-[#688a5b]" />
                        <span>Geography &amp; Shore Access</span>
                      </h3>
                      <span className="rounded bg-[#1c251e] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#dfd7c8] border border-[#2c3a2f]">
                        {typeof currentArtifact.analysis.geographical_context.water_elevation_m === 'number'
                          ? `~${currentArtifact.analysis.geographical_context.water_elevation_m}m ASL DEM est. (Δ+${currentArtifact.analysis.geographical_context.relief_range_m}m)`
                          : `Elevation: ~Unverified (DEM timeout) (Δ+${currentArtifact.analysis.geographical_context.relief_range_m}m)`}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#dfd7c8]/90">
                      <strong className="text-[#dfd7c8]">Road Access:</strong>{' '}
                      {currentArtifact.analysis.geographical_context.road_access_summary}
                    </p>
                    <p className="text-[11px] text-[#dfd7c8]/90">
                      <strong className="text-[#dfd7c8]">Shore Terrain:</strong>{' '}
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
                    className="w-full rounded-lg border border-[#2c3a2f] bg-[#0e130f]/80 p-3.5 text-xs space-y-1.5"
                  >
                    <h3 className="font-semibold text-[#dfd7c8] tracking-wide flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-[#688a5b]" />
                      <span>Satellite Resolution &amp; Seasonal Flora Note</span>
                    </h3>
                    {currentArtifact.analysis.imagery_freshness_note && (
                      <p className="text-[11px] text-[#dfd7c8]/90 leading-relaxed">
                        {currentArtifact.analysis.imagery_freshness_note}
                      </p>
                    )}
                    {currentArtifact.analysis.extraction_limitations &&
                      currentArtifact.analysis.extraction_limitations.length > 0 && (
                        <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-[#d96b27]/90">
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
                    className="w-full rounded-lg border border-[#2c3a2f] bg-[#0e130f]/80 p-3.5 text-xs space-y-2"
                  >
                    <h3 className="font-semibold text-[#dfd7c8] tracking-wide flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5 text-[#d96b27]" />
                      <span>Spain Fishing Regulations &amp; Allowed Check</span>
                    </h3>
                    <div className="rounded-md border border-[#d96b27]/40 bg-[#d96b27]/10 px-2.5 py-1.5 font-medium text-[#d96b27] text-[11px]">
                      {currentArtifact.analysis.restriction_check.status_label}
                    </div>
                    <p className="text-[11px] text-[#dfd7c8]/90">
                      <strong className="text-[#dfd7c8]">Permits:</strong>{' '}
                      {currentArtifact.analysis.restriction_check.permits_required}
                    </p>
                    <p className="text-[11px] text-rose-300">
                      <strong className="text-rose-400">Restricted / Safety Zones:</strong>{' '}
                      {currentArtifact.analysis.restriction_check.prohibited_zones_warning}
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#dfd7c8]/90">
                      {currentArtifact.analysis.restriction_check.regulations_list.map(
                        (rule, idx) => (
                          <li key={idx}>{rule}</li>
                        )
                      )}
                    </ul>
                    <p className="text-[10px] text-[#918b80] italic border-t border-[#2c3a2f]/80 pt-1.5">
                      {currentArtifact.analysis.restriction_check.disclaimer}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Tactical Summary (Where to Fish on the Grid + Best Game Plan) */}
              <div className="lg:col-span-7 space-y-4 max-h-[78vh] overflow-y-auto pr-1">
                <div data-testid="where-to-fish-summary" className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-[#2c3a2f]/80 pb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#dfd7c8] flex items-center gap-1.5">
                      <Crosshair className="h-4 w-4 text-[#d96b27]" />
                      <span>Where to Fish on the Grid:</span>
                    </h3>
                    <span className="text-xs text-[#918b80] font-mono">
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
                      const AccessIcon = accessBadge.icon;
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
                          className={`group rounded-lg border p-3.5 transition-all space-y-2.5 text-xs leading-relaxed ${
                            isTop
                              ? 'border-[#d96b27]/40 bg-[#0e130f]/90 hover:border-[#d96b27]/70'
                              : 'border-[#2c3a2f] bg-[#0e130f]/60 hover:border-[#3d4f40]'
                          }`}
                        >
                          {/* Header: Rank Pill + Title + Coordinate + Target + Access */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2c3a2f]/60 pb-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${rankStyle.pillClasses}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${rankStyle.dotColor}`} />
                                Spot {spot.rank}
                              </span>
                              {typeof spot.rating === 'number' && (
                                <span
                                  data-testid={`spot-rating-${spot.rank}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-[#d96b27]/40 bg-[#d96b27]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#d96b27]"
                                >
                                  <Star className="h-3 w-3 fill-[#d96b27] text-[#d96b27]" />
                                  <span>{spot.rating.toFixed(1)}/10</span>
                                </span>
                              )}
                              <h4 className="text-sm font-semibold text-[#dfd7c8]">
                                {cleanTitle}
                              </h4>
                              <span className="font-mono text-xs text-[#d96b27] font-semibold">
                                [Grid {spot.cell_id}]
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                              {spot.target_species && spot.target_species.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-[#688a5b]/40 bg-[#1c251e] px-2 py-0.5 font-medium text-[#dfd7c8]">
                                  <span className="text-[#918b80]">Target:</span>{' '}
                                  {spot.target_species.join(', ')}
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium ${accessBadge.classes}`}
                              >
                                <AccessIcon className="h-3 w-3 shrink-0" />
                                <span>{accessBadge.label}</span>
                              </span>
                            </div>
                          </div>

                          {/* Human-focused Why this spot paragraph */}
                          <div
                            data-testid={`spot-justification-${spot.rank}`}
                            className="text-xs text-[#dfd7c8]/90 leading-relaxed"
                          >
                            <strong className="text-[#d96b27] font-semibold">
                              Why this spot:
                            </strong>{' '}
                            {cleanWhy}
                          </div>

                          {/* How to fish / Tactics */}
                          {cleanTactics && (
                            <div className="rounded-md border border-[#2c3a2f] bg-[#1c251e] p-2.5 text-xs text-[#dfd7c8] leading-relaxed">
                              <strong className="text-[#688a5b] font-semibold">
                                How to fish:
                              </strong>{' '}
                              {cleanTactics}
                            </div>
                          )}

                          {/* Compact Structure & Access details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#918b80] border-t border-[#2c3a2f]/50 pt-2">
                            {spot.depth_structure && (
                              <div className="flex items-center gap-1">
                                <strong className="text-[#dfd7c8] font-medium">Structure:</strong>
                                <span>{cleanSpotText(spot.depth_structure)}</span>
                                <span
                                  title="Depths inferred from satellite shoreline topography; verify local bank footing on site"
                                  className="cursor-help text-[#918b80] hover:text-[#dfd7c8]"
                                >
                                  ⓘ
                                </span>
                              </div>
                            )}
                            {cleanAccess && (
                              <div className="flex items-center gap-1">
                                <strong className="text-[#dfd7c8] font-medium">Access &amp; Road Surface:</strong>
                                <span>{cleanAccess}</span>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    };

                    return (
                      <div className="space-y-4">
                        {hasTiers ? (
                          <>
                            {/* Tier 1 Header */}
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between border-b border-[#d96b27]/30 pb-1.5">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[#d96b27] flex items-center gap-1.5">
                                  <Trophy className="h-3.5 w-3.5 text-[#d96b27]" />
                                  <span>Top Recommended Spots (#1–#3)</span>
                                </h4>
                                <span className="text-[11px] text-[#d96b27]/80 font-mono">
                                  High-Percentage Ambush Zones
                                </span>
                              </div>
                              {topSpots.map((spot) => renderCard(spot, true))}
                            </div>

                            {/* Tier 2 Header */}
                            <div className="space-y-2.5 pt-1">
                              <div className="flex items-center justify-between border-b border-[#2c3a2f] pb-1.5">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[#dfd7c8] flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-[#688a5b]" />
                                  <span>Secondary &amp; Shoreline Spots (#4–#6)</span>
                                </h4>
                                <span className="text-[11px] text-[#918b80] font-mono">
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
                  className="rounded-lg border border-[#2c3a2f] bg-[#0e130f]/80 p-4 space-y-2.5"
                >
                  <h3 className="text-sm font-semibold text-[#dfd7c8] tracking-wide flex items-center gap-1.5">
                    <Navigation className="h-4 w-4 text-[#d96b27]" />
                    <span>Best Game Plan for This Area:</span>
                  </h3>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs leading-relaxed text-[#dfd7c8]/90">
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
              className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2c3a2f]/80 bg-[#0e130f]/90 px-5 py-3 text-xs text-[#918b80]"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[#dfd7c8] bg-[#151c16] px-2 py-0.5 rounded border border-[#2c3a2f] flex items-center gap-1">
                  <Hash className="h-3 w-3 text-[#918b80]" />
                  <span>ID: {reportId}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-[#918b80]" />
                  <span>{generatedAt}</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[#d96b27] bg-[#151c16] px-2 py-0.5 rounded border border-[#2c3a2f] flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-[#d96b27]" />
                  <span>v{currentArtifact.analysis.app_version || APP_VERSION}</span>
                </span>
              </div>
            </footer>
          </div>
        </section>
      )}

      {/* Preparation State Stepper (Angler Wisdom & Hydrographic Intelligence) */}
      <AnalysisProgressDialog
        isOpen={isAnalyzing}
        waterBodyLabel={effectiveWaterBodyLabel}
      />
    </main>
  );
}
