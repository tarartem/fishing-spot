'use client';

import React, { useEffect, useState } from 'react';

export interface AnalysisProgressStep {
  icon: string;
  title: string;
  detail: string;
}

export const STEP_DURATION_MS = 900;

export const ANALYSIS_STEPS: AnalysisProgressStep[] = [
  {
    icon: '🛰️',
    title: 'Water Boundary Scan',
    detail: 'Mapping shoreline contours and water surface clarity.',
  },
  {
    icon: '📐',
    title: 'Bottom Structure',
    detail: 'Detecting underwater points, drop-offs, and shelf edges.',
  },
  {
    icon: '🎣',
    title: 'Angler Ecology',
    detail: 'Evaluating wind drift, ambush cover, and baitfish lines.',
  },
  {
    icon: '🥾',
    title: 'Shore & Road Access',
    detail: 'Checking terrain slope, cliffs, and nearby approach trails.',
  },
  {
    icon: '⚖️',
    title: 'Regulations Check',
    detail: 'Verifying basin permits and restricted sanctuary zones.',
  },
  {
    icon: '🎯',
    title: 'Tactical Synthesis',
    detail: 'Ranking top 6 coordinates and optimal cast strategies.',
  },
];

export const MIN_ANALYSIS_SHOWCASE_MS = ANALYSIS_STEPS.length * STEP_DURATION_MS;

interface AnalysisProgressDialogProps {
  isOpen: boolean;
  waterBodyLabel?: string;
}

export function AnalysisProgressDialog({
  isOpen,
  waterBodyLabel,
}: AnalysisProgressDialogProps) {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setActiveStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setActiveStepIndex((prev) => {
        if (prev < ANALYSIS_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, STEP_DURATION_MS);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStep = ANALYSIS_STEPS[activeStepIndex];
  const progressPercent = Math.min(
    100,
    Math.round(((activeStepIndex + 1) / ANALYSIS_STEPS.length) * 100)
  );

  const cleanName = waterBodyLabel?.split('(')[0].trim();
  const headerTitle = cleanName ? `Analyzing ${cleanName}` : 'Analyzing Selected Basin';

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="analysis-progress-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md transition-opacity duration-300"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="min-w-0 flex-1 mr-3">
            <h3 className="text-sm font-bold text-white tracking-wide truncate">
              {headerTitle}
            </h3>
            <p className="text-[11px] text-slate-400">
              Hydrographic &amp; Angler Intelligence
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
            {activeStepIndex + 1} / {ANALYSIS_STEPS.length}
          </span>
        </div>

        {/* Single Active Feature Spotlight (Fixed Height to Prevent Vertical Jitter) */}
        <div
          key={activeStepIndex}
          className="h-[96px] rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex items-center gap-3.5 overflow-hidden"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-base">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-lg bg-emerald-400/15 opacity-75" />
            <span>{currentStep.icon}</span>
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="text-xs font-semibold text-emerald-300">
              {currentStep.title}
            </div>
            <div className="text-xs leading-relaxed text-slate-300 line-clamp-2 min-h-[2.5rem] flex items-center">
              {currentStep.detail}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-400 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Processing under the hood</span>
            <span className="font-mono text-slate-400">{progressPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
