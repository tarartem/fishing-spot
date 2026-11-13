'use client';

import React, { useState } from 'react';
import type {
  AccessMode,
  CellMicroAnalysisResponse,
  FishingType,
  GridCell,
  RecommendedSpot,
  TargetSpecies,
  WaterType,
} from '@/shared/types/domain';
import type { WaterBodyTierResponse } from '@/shared/db/store';
import { compressPhotoToWebP } from '@/modules/reviews/photo-compressor';

interface WaterBodyDrawerProps {
  details: WaterBodyTierResponse | null;
  activeSpots: RecommendedSpot[];
  waterBodySummary: string | null;
  cellMicroAnalysis: CellMicroAnalysisResponse | null;
  isLoadingAi: boolean;
  isLoadingCell: boolean;
  onClose: () => void;
  onOpenRegisterModal: () => void;
  onRunAiAnalysis: (params: {
    waterType: WaterType;
    fishingType: FishingType;
    targetSpecies: TargetSpecies[];
    accessMode: AccessMode;
  }) => Promise<void>;
  onSelectGridCell: (cell: GridCell) => void;
  onSubmitReview: (reviewData: {
    cellId?: string;
    rating: number;
    comment: string;
    fishingTypeUsed: FishingType;
    species: TargetSpecies;
    count: number;
    lengthCm?: number;
    photoDataUrl?: string;
  }) => Promise<void>;
}

const FISHING_TYPES: { value: FishingType; label: string }[] = [
  { value: 'spinning', label: 'Spinning / Lure' },
  { value: 'feeder_bottom', label: 'Feeder / Bottom' },
  { value: 'carp', label: 'Carp Angling' },
  { value: 'float', label: 'Float / Match' },
  { value: 'fly', label: 'Fly Fishing' },
  { value: 'surfcasting', label: 'Surfcasting (Sea)' },
];

export function WaterBodyDrawer({
  details,
  activeSpots,
  waterBodySummary,
  cellMicroAnalysis,
  isLoadingAi,
  isLoadingCell,
  onClose,
  onOpenRegisterModal,
  onRunAiAnalysis,
  onSubmitReview,
}: WaterBodyDrawerProps) {
  const [activeTab, setActiveTab] = useState<'spots' | 'reviews' | 'rules'>('spots');
  const [waterType, setWaterType] = useState<WaterType>(
    details?.waterBody.waterType ?? 'freshwater'
  );
  const [fishingType, setFishingType] = useState<FishingType>('spinning');
  const [selectedSpecies, setSelectedSpecies] = useState<TargetSpecies[]>([]);
  const [accessMode, setAccessMode] = useState<AccessMode>('shore');

  // Review form state
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewCellId, setReviewCellId] = useState<string>('C4');
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewSpecies, setReviewSpecies] = useState<TargetSpecies>('zander');
  const [reviewLengthCm, setReviewLengthCm] = useState<string>('65');
  const [compressedPhotoUrl, setCompressedPhotoUrl] = useState<string | undefined>();
  const [photoStats, setPhotoStats] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Sync waterType when water body changes
  React.useEffect(() => {
    if (details) {
      setWaterType(details.waterBody.waterType);
      setSelectedSpecies(details.waterBody.commonSpecies.slice(0, 2));
      if (details.exactSpots[0]?.cell_id) {
        setReviewCellId(details.exactSpots[0].cell_id);
      }
      if (details.waterBody.commonSpecies[0]) {
        setReviewSpecies(details.waterBody.commonSpecies[0]);
      }
    }
  }, [details]);

  if (!details) return null;

  const { waterBody, tier, restrictionOverview, teaserFeedback, cta } = details;
  const isGuest = tier === 'guest';

  const toggleSpecies = (sp: TargetSpecies) => {
    setSelectedSpecies((prev) =>
      prev.includes(sp) ? prev.filter((item) => item !== sp) : [...prev, sp]
    );
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await compressPhotoToWebP(file);
      setCompressedPhotoUrl(result.dataUrl);
      setPhotoStats(
        `Compressed to WebP (${Math.round(result.sizeBytes / 1024)} KB, ${result.width}x${result.height}px)`
      );
    } catch {
      setPhotoStats('Photo attached');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      await onSubmitReview({
        cellId: reviewCellId,
        rating: reviewRating,
        comment: reviewComment,
        fishingTypeUsed: fishingType,
        species: reviewSpecies,
        count: 1,
        lengthCm: Number(reviewLengthCm) || undefined,
        photoDataUrl: compressedPhotoUrl,
      });
      setReviewComment('');
      setCompressedPhotoUrl(undefined);
      setPhotoStats(null);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <aside
      data-testid="water-body-drawer"
      className="fixed bottom-0 right-0 z-30 flex max-h-[85vh] w-full flex-col border-t border-[#2c3a2f] bg-[#151c16]/95 shadow-2xl backdrop-blur-xl sm:top-16 sm:bottom-4 sm:right-4 sm:max-h-[calc(100vh-5rem)] sm:w-[460px] sm:rounded-xl sm:border text-[#dfd7c8]"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[#2c3a2f]/80 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#1c251e] border border-[#2c3a2f] px-2 py-0.5 text-[11px] font-bold uppercase text-[#dfd7c8]">
              {waterBody.countryCode} · {waterBody.waterType === 'sea' ? 'Sea / Coastal' : 'Freshwater'}
            </span>
            <span className="text-xs font-semibold text-[#d96b27]">
              ★ {waterBody.avgRating.toFixed(1)} ({waterBody.reviewCount} reviews)
            </span>
          </div>
          <h2
            data-testid="drawer-water-body-name"
            className="mt-1 text-lg font-bold text-[#dfd7c8]"
          >
            {waterBody.name}
          </h2>
          <p className="text-xs text-[#918b80]">{waterBody.regionLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close water body panel"
          className="rounded-lg border border-[#2c3a2f] p-1.5 text-[#918b80] hover:bg-[#1c251e] hover:text-[#dfd7c8]"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Basic Water Body Description (Visible to both Guest & Registered) */}
        <section
          data-testid="water-body-basic-description"
          className="rounded-xl border border-[#2c3a2f] bg-[#0e130f]/80 p-3.5"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#918b80]">
            Water Body Overview
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-[#dfd7c8]/90">
            {waterBody.description}
          </p>

          {/* What Fish You Can Catch Here */}
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-[#dfd7c8]">
              What Fish You Can Catch Here:
            </p>
            <div
              data-testid="catchable-species-list"
              className="mt-1.5 flex flex-wrap gap-1.5"
            >
              {waterBody.commonSpecies.map((species) => (
                <span
                  key={species}
                  className="rounded-md border border-[#688a5b]/40 bg-[#1c251e] px-2.5 py-0.5 text-[11px] font-medium capitalize text-[#dfd7c8]"
                >
                  {species.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* GUEST VIEW: Teaser Feedback + Prominent Call To Action to Register */}
        {isGuest ? (
          <div className="space-y-4" data-testid="guest-locked-view">
            {/* Teaser Community Feedback */}
            <section
              data-testid="guest-teaser-feedback"
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Recent Angler Feedback Preview
                </h3>
                <span className="text-[11px] text-slate-400">
                  {waterBody.reviewCount} verified reports
                </span>
              </div>
              <div className="mt-2.5 space-y-2">
                {teaserFeedback.map((fb) => (
                  <div
                    key={fb.id}
                    className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">
                        {fb.authorName}
                      </span>
                      <span className="text-amber-400">
                        {'★'.repeat(fb.rating)}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-300 italic">
                      “{fb.commentSnippet}”
                    </p>
                    <p className="mt-1 text-[10px] text-sky-400 capitalize">
                      Caught: {fb.speciesNames.join(', ').replace(/_/g, ' ')} · Exact Grid Spot Hidden
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Call to Action (CTA) Card to Unlock Spatial Grid & Exact Spots */}
            <section
              data-testid="guest-registration-cta"
              className="rounded-xl border-2 border-amber-500/60 bg-gradient-to-br from-amber-950/40 via-slate-900 to-[#0c1520] p-4 shadow-xl"
            >
              <div className="inline-block rounded-md bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                Members-Only Tactical Grid
              </div>
              <h3 className="mt-2 text-base font-bold text-white">
                {cta.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                {cta.description}
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-200">
                <li>✓ Overlay the A1–H8 Spatial Grid on {waterBody.name}</li>
                <li>✓ See exact Fishing Spot Pins & bait/lure presentations</li>
                <li>✓ Filter by Water Type, Technique & Target Fish Species</li>
                <li>✓ View & upload full community catch photos</li>
              </ul>
              <button
                type="button"
                data-testid="cta-register-button"
                onClick={onOpenRegisterModal}
                className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-950/50 transition hover:bg-amber-400 rounded-lg"
              >
                {cta.actionLabel}
              </button>
            </section>
          </div>
        ) : (
          /* REGISTERED USER VIEW: Full Spatial Grid AI Advisor, Exact Spots, Reviews & Rules */
          <div className="space-y-4" data-testid="registered-full-view">
            {/* Navigation Tabs */}
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 p-1">
              <button
                type="button"
                data-testid="tab-spots"
                onClick={() => setActiveTab('spots')}
                className={`rounded-lg py-1.5 text-xs font-bold transition ${
                  activeTab === 'spots'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                AI Grid Spots ({activeSpots.length})
              </button>
              <button
                type="button"
                data-testid="tab-reviews"
                onClick={() => setActiveTab('reviews')}
                className={`rounded-lg py-1.5 text-xs font-bold transition ${
                  activeTab === 'reviews'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Reviews ({details.fullReviews.length})
              </button>
              <button
                type="button"
                data-testid="tab-rules"
                onClick={() => setActiveTab('rules')}
                className={`rounded-lg py-1.5 text-xs font-bold transition ${
                  activeTab === 'rules'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Restrictions
              </button>
            </div>

            {activeTab === 'spots' && (
              <div className="space-y-4">
                {/* 4 Core Angler Inputs Form */}
                <section
                  data-testid="ai-advisor-controls"
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      AI Spatial Grid Spot Advisor
                    </h3>
                    <span className="text-[10px] text-slate-400">
                      4 Core Parameters
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Input 1: Water Type */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300">
                        1. Water Type
                      </label>
                      <select
                        data-testid="input-water-type"
                        value={waterType}
                        onChange={(e) => setWaterType(e.target.value as WaterType)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="freshwater">Freshwater</option>
                        <option value="sea">Sea / Saltwater</option>
                      </select>
                    </div>

                    {/* Input 2: Fishing Technique */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300">
                        2. Fishing Technique
                      </label>
                      <select
                        data-testid="input-fishing-type"
                        value={fishingType}
                        onChange={(e) =>
                          setFishingType(e.target.value as FishingType)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                      >
                        {FISHING_TYPES.map((ft) => (
                          <option key={ft.value} value={ft.value}>
                            {ft.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Input 3: Target Fish Species */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">
                      3. Target Fish Species
                    </label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {waterBody.commonSpecies.map((sp) => {
                        const active = selectedSpecies.includes(sp);
                        return (
                          <button
                            key={sp}
                            type="button"
                            onClick={() => toggleSpecies(sp)}
                            className={`rounded-md border px-2.5 py-0.5 text-[11px] font-medium capitalize transition ${
                              active
                                ? 'border-emerald-400 bg-emerald-500/20 text-sky-200'
                                : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            {sp.replace(/_/g, ' ')}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Input 4: Access Mode */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-300">
                      4. Access Mode:
                    </span>
                    <div className="flex gap-1.5">
                      {(['shore', 'boat'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          data-testid={`access-mode-${mode}`}
                          onClick={() => setAccessMode(mode)}
                          className={`rounded-lg border px-3 py-1 text-xs font-semibold capitalize ${
                            accessMode === mode
                              ? 'border-emerald-400 bg-emerald-500/20 text-sky-200'
                              : 'border-slate-700 bg-slate-950 text-slate-400'
                          }`}
                        >
                          {mode === 'shore' ? 'Shore / Bank' : 'Boat / Kayak'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="run-ai-grid-button"
                    disabled={isLoadingAi}
                    onClick={() =>
                      onRunAiAnalysis({
                        waterType,
                        fishingType,
                        targetSpecies:
                          selectedSpecies.length > 0 ? selectedSpecies : ['any'],
                        accessMode,
                      })
                    }
                    className="w-full rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-sky-400 rounded-lg disabled:opacity-50"
                  >
                    {isLoadingAi
                      ? 'Analyzing Spatial Grid...'
                      : 'Generate AI Grid Spots'}
                  </button>
                </section>

                {/* Level 2: Single-Cell Micro-Analysis Panel (when user clicks a cell on the grid) */}
                {(isLoadingCell || cellMicroAnalysis) && (
                  <section
                    data-testid="cell-micro-analysis-card"
                    className="rounded-xl border border-amber-400/50 bg-amber-950/20 p-3.5"
                  >
                    {isLoadingCell ? (
                      <p className="text-xs text-amber-300">
                        Running micro-analysis on selected grid cell...
                      </p>
                    ) : (
                      cellMicroAnalysis && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-amber-300">
                              Sector Deep-Dive: Grid Cell {cellMicroAnalysis.cellId}
                            </span>
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-200">
                              Score: {cellMicroAnalysis.suitabilityScore}%
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-200">
                            {cellMicroAnalysis.structuralAnalysis}
                          </p>
                          <p className="mt-1.5 text-xs text-sky-300">
                            <strong>How to Fish:</strong>{' '}
                            {cellMicroAnalysis.howToFishThisCell}
                          </p>
                        </div>
                      )
                    )}
                  </section>
                )}

                {waterBodySummary && (
                  <p
                    data-testid="ai-water-body-summary"
                    className="rounded-lg border border-sky-500/30 bg-sky-950/30 p-2.5 text-xs text-sky-200"
                  >
                    {waterBodySummary}
                  </p>
                )}

                {/* Exact Fishing Spot Cards on the Grid */}
                <div className="space-y-3" data-testid="exact-spots-list">
                  {activeSpots.map((spot) => (
                    <article
                      key={`${spot.cell_id}-${spot.rank}`}
                      data-testid={`spot-card-${spot.cell_id}`}
                      className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 shadow"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-sky-500 px-2 py-0.5 font-mono text-xs font-bold text-slate-950">
                          #{spot.rank} · CELL {spot.cell_id}
                        </span>
                        <span className="text-xs font-semibold text-sky-400">
                          {spot.confidence_score}% Confidence
                        </span>
                      </div>
                      <h4 className="mt-2 text-sm font-bold text-white">
                        {spot.title}
                      </h4>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        Pin Coordinates: {spot.coordinates.latitude.toFixed(4)}°N,{' '}
                        {spot.coordinates.longitude.toFixed(4)}°E
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-200">
                        {spot.why_this_spot}
                      </p>

                      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 text-xs space-y-1.5">
                        <p className="text-sky-300">
                          <strong>Baits / Lures:</strong>{' '}
                          {spot.tactical_advice.recommended_baits_or_lures.join(' · ')}
                        </p>
                        <p className="text-slate-300">
                          <strong>Presentation:</strong>{' '}
                          {spot.tactical_advice.presentation_tips}
                        </p>
                        <p className="text-slate-400">
                          <strong>Best Time:</strong>{' '}
                          {spot.tactical_advice.best_time_of_day}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4" data-testid="reviews-tab-panel">
                {/* Submit New Review & Catch Photo Form */}
                <form
                  onSubmit={handleReviewSubmit}
                  data-testid="submit-review-form"
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-2.5"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                    Leave Spot Feedback & Catch Photo
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Grid Cell
                      </label>
                      <input
                        type="text"
                        data-testid="review-cell-input"
                        value={reviewCellId}
                        onChange={(e) => setReviewCellId(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Rating (1-5)
                      </label>
                      <select
                        data-testid="review-rating-select"
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      >
                        {[5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r} Stars
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        Length (cm)
                      </label>
                      <input
                        type="number"
                        value={reviewLengthCm}
                        onChange={(e) => setReviewLengthCm(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    data-testid="review-comment-input"
                    placeholder="Share your fishing results, bait/lure used, and conditions..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-300 hover:border-sky-400">
                      + Upload Catch Photo (WebP)
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="submit"
                      data-testid="submit-review-button"
                      disabled={submittingReview}
                      className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 rounded-lg"
                    >
                      {submittingReview ? 'Posting...' : 'Post Review'}
                    </button>
                  </div>
                  {photoStats && (
                    <p className="text-[11px] text-sky-400">{photoStats}</p>
                  )}
                </form>

                {/* Full Reviews List */}
                <div className="space-y-3" data-testid="full-reviews-list">
                  {details.fullReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">
                          {rev.authorName}{' '}
                          {rev.cellId && (
                            <span className="ml-1 rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                              Cell {rev.cellId}
                            </span>
                          )}
                        </span>
                        <span className="text-amber-400">
                          {'★'.repeat(rev.rating)}
                        </span>
                      </div>
                      <p className="text-slate-200">{rev.comment}</p>
                      <div className="flex flex-wrap gap-1.5 text-[11px] text-sky-400">
                        {rev.speciesCaught.map((sc, i) => (
                          <span
                            key={i}
                            className="rounded bg-slate-950 px-2 py-0.5 capitalize"
                          >
                            {sc.count}x {String(sc.species).replace(/_/g, ' ')}
                            {sc.lengthCm ? ` (${sc.lengthCm}cm)` : ''}
                          </span>
                        ))}
                      </div>
                      {rev.photos.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {rev.photos.map((ph) => (
                            <img
                              key={ph.id}
                              src={ph.publicUrl}
                              alt="Angler catch result"
                              className="h-28 w-full rounded-lg object-cover border border-slate-800"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'rules' && (
              <div
                className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 text-xs"
                data-testid="rules-tab-panel"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold uppercase tracking-wider text-amber-400">
                    3-Layer Fishing Regulations ({waterBody.countryCode})
                  </h3>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                    {restrictionOverview.overall_status.replace(/_/g, ' ')}
                  </span>
                </div>

                {restrictionOverview.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-semibold text-rose-400">
                      Spatial & Grid Restrictions:
                    </p>
                    {restrictionOverview.warnings.map((w, i) => (
                      <div
                        key={i}
                        className="rounded border border-rose-500/40 bg-rose-950/40 p-2 text-rose-200"
                      >
                        {w}
                      </div>
                    ))}
                  </div>
                )}

                {restrictionOverview.permit_requirements && (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-300">
                      Required Permits:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-300">
                      {restrictionOverview.permit_requirements.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {restrictionOverview.seasonal_rules &&
                  restrictionOverview.seasonal_rules.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-300">
                        Species & Seasonal Rules:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-300">
                        {restrictionOverview.seasonal_rules.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                <p className="rounded bg-slate-950 p-2 text-[11px] text-slate-400 italic">
                  {restrictionOverview.disclaimer}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
