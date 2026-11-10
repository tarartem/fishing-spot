'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FishingMap } from '@/modules/map-grid/components/FishingMap';
import { WaterBodyDrawer } from '@/modules/map-grid/components/WaterBodyDrawer';
import type {
  AccessMode,
  CellMicroAnalysisResponse,
  FishingType,
  GridCell,
  RecommendedSpot,
  TargetSpecies,
  WaterBodyPinSummary,
  WaterType,
} from '@/shared/types/domain';
import type { WaterBodyTierResponse } from '@/shared/db/store';

export default function HomePage() {
  const [waterBodyPins, setWaterBodyPins] = useState<WaterBodyPinSummary[]>([]);
  const [countryFilter, setCountryFilter] = useState<'ALL' | 'PL' | 'ES'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [anglerEmail, setAnglerEmail] = useState<string | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>('');

  const [selectedWaterBodyId, setSelectedWaterBodyId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] =
    useState<WaterBodyTierResponse | null>(null);
  const [activeSpots, setActiveSpots] = useState<RecommendedSpot[]>([]);
  const [waterBodySummary, setWaterBodySummary] = useState<string | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [cellMicroAnalysis, setCellMicroAnalysis] =
    useState<CellMicroAnalysisResponse | null>(null);

  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [isLoadingCell, setIsLoadingCell] = useState<boolean>(false);

  const buildHeaders = useCallback(
    (emailOverride?: string | null): HeadersInit => {
      const activeEmail =
        emailOverride !== undefined ? emailOverride : anglerEmail;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeEmail) {
        headers['x-angler-email'] = activeEmail;
      }
      return headers;
    },
    [anglerEmail]
  );

  // Load named Water Body Pins on map startup or country filter change
  useEffect(() => {
    async function loadPins() {
      const res = await fetch(`/api/water-bodies/pins?country=${countryFilter}`);
      const data = await res.json();
      setWaterBodyPins(data.waterBodyPins ?? []);
    }
    loadPins();
  }, [countryFilter]);

  const fetchWaterBodyDetails = useCallback(
    async (id: string, emailOverride?: string | null) => {
      setSelectedWaterBodyId(id);
      setCellMicroAnalysis(null);
      setSelectedCellId(null);
      setWaterBodySummary(null);

      const res = await fetch(`/api/water-bodies/${id}`, {
        headers: buildHeaders(emailOverride),
      });
      if (!res.ok) return;
      const details: WaterBodyTierResponse = await res.json();
      setSelectedDetails(details);
      setActiveSpots(details.exactSpots ?? []);
    },
    [buildHeaders]
  );

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = emailInput.trim();
    if (!cleaned || !cleaned.includes('@')) return;
    setAnglerEmail(cleaned);
    setIsRegisterModalOpen(false);
    if (selectedWaterBodyId) {
      await fetchWaterBodyDetails(selectedWaterBodyId, cleaned);
    }
  };

  const handleSignOut = async () => {
    setAnglerEmail(null);
    if (selectedWaterBodyId) {
      await fetchWaterBodyDetails(selectedWaterBodyId, null);
    }
  };

  const handleRunAiAnalysis = async (params: {
    waterType: WaterType;
    fishingType: FishingType;
    targetSpecies: TargetSpecies[];
    accessMode: AccessMode;
  }) => {
    if (!selectedWaterBodyId) return;
    setIsLoadingAi(true);
    try {
      const res = await fetch('/api/ai-advisor/recommend-spots', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          waterBodyId: selectedWaterBodyId,
          ...params,
          season: 'autumn',
        }),
      });
      const data = await res.json();
      if (res.ok && data.recommended_spots) {
        setActiveSpots(data.recommended_spots);
        setWaterBodySummary(data.water_body_summary ?? null);
        if (data.grid && selectedDetails) {
          setSelectedDetails({
            ...selectedDetails,
            grid: data.grid,
          });
        }
      }
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleSelectGridCell = async (cell: GridCell) => {
    if (!selectedWaterBodyId || !anglerEmail) return;
    setSelectedCellId(cell.cellId);
    setIsLoadingCell(true);
    try {
      const res = await fetch('/api/ai-advisor/analyze-cell', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          waterBodyId: selectedWaterBodyId,
          cellId: cell.cellId,
        }),
      });
      if (res.ok) {
        const analysis: CellMicroAnalysisResponse = await res.json();
        setCellMicroAnalysis(analysis);
      }
    } finally {
      setIsLoadingCell(false);
    }
  };

  const handleSubmitReview = async (reviewData: {
    cellId?: string;
    rating: number;
    comment: string;
    fishingTypeUsed: FishingType;
    species: TargetSpecies;
    count: number;
    lengthCm?: number;
    photoDataUrl?: string;
  }) => {
    if (!selectedWaterBodyId || !anglerEmail) return;
    const res = await fetch(`/api/water-bodies/${selectedWaterBodyId}/reviews`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        cellId: reviewData.cellId,
        rating: reviewData.rating,
        comment: reviewData.comment,
        fishingTypeUsed: reviewData.fishingTypeUsed,
        speciesCaught: [
          {
            species: reviewData.species,
            count: reviewData.count,
            lengthCm: reviewData.lengthCm,
          },
        ],
        photos: reviewData.photoDataUrl
          ? [
              {
                storagePath: `catches/${Date.now()}.webp`,
                publicUrl: reviewData.photoDataUrl,
                photoType: 'catch',
              },
            ]
          : [],
      }),
    });

    if (res.ok) {
      await fetchWaterBodyDetails(selectedWaterBodyId, anglerEmail);
    }
  };

  const filteredPins = waterBodyPins.filter((pin) =>
    searchQuery.trim()
      ? pin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pin.regionLabel.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* Top Floating Navigation & Search Header */}
      <header className="fixed top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800/90 bg-slate-950/90 px-4 py-2.5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 font-extrabold text-slate-950">
            FS
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">
              Fishing Spot AI
            </h1>
            <p className="text-[11px] text-slate-400">
              Spatial Grid Advisor · Poland & Spain MVP
            </p>
          </div>
        </div>

        {/* Search & Country Filter */}
        <div className="flex flex-1 max-w-md items-center gap-2">
          <input
            type="search"
            data-testid="water-body-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search water body (e.g., Zegrzyńskie, Mequinenza, Wisła)..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
          <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-0.5 text-xs">
            {(['ALL', 'PL', 'ES'] as const).map((code) => (
              <button
                key={code}
                type="button"
                data-testid={`filter-country-${code}`}
                onClick={() => setCountryFilter(code)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  countryFilter === code
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {code === 'ALL' ? 'Europe' : code}
              </button>
            ))}
          </div>
        </div>

        {/* Tier & Email Auth Status */}
        <div className="flex items-center gap-2">
          {anglerEmail ? (
            <div
              data-testid="authenticated-user-badge"
              className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3 py-1.5 text-xs"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="font-semibold text-emerald-200">
                {anglerEmail}
              </span>
              <button
                type="button"
                data-testid="sign-out-button"
                onClick={handleSignOut}
                className="ml-1 text-[11px] text-slate-400 underline hover:text-white"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                data-testid="guest-mode-badge"
                className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400"
              >
                Guest Mode
              </span>
              <button
                type="button"
                data-testid="header-register-button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                Register with Email
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Full-Screen Interactive Map + Named Water Body Pins + Spatial Grid */}
      <FishingMap
        waterBodyPins={filteredPins}
        selectedWaterBodyId={selectedWaterBodyId}
        selectedDetails={selectedDetails}
        activeSpots={activeSpots}
        selectedCellId={selectedCellId}
        onSelectWaterBody={(id) => fetchWaterBodyDetails(id)}
        onSelectGridCell={handleSelectGridCell}
      />

      {/* Contextual Water Body Drawer / Bottom Sheet */}
      <WaterBodyDrawer
        details={selectedDetails}
        activeSpots={activeSpots}
        waterBodySummary={waterBodySummary}
        cellMicroAnalysis={cellMicroAnalysis}
        isLoadingAi={isLoadingAi}
        isLoadingCell={isLoadingCell}
        onClose={() => setSelectedDetails(null)}
        onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
        onRunAiAnalysis={handleRunAiAnalysis}
        onSelectGridCell={handleSelectGridCell}
        onSubmitReview={handleSubmitReview}
      />

      {/* Free Email Registration Modal */}
      {isRegisterModalOpen && (
        <div
          data-testid="email-register-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                Register Free with Email
              </h2>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              Enter your email to unlock the <strong>A1–H8 Spatial Grid</strong>,{' '}
              <strong>exact Fishing Spot Pins</strong>, full bait & lure tactical
              advice, single-cell deep-dives, and community catch photos.
            </p>
            <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  data-testid="register-email-input"
                  placeholder="angler@fishing-spot.eu"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                data-testid="register-submit-button"
                className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                Unlock Full Spatial Grid & Spots
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
