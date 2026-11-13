'use client';

import React, { useEffect, useState } from 'react';
import {
  Crosshair,
  Fish,
  Footprints,
  Layers,
  Scale,
  Scan,
  type LucideIcon,
} from 'lucide-react';

export interface AnalysisProgressStep {
  icon: LucideIcon;
  title: string;
  detail: string;
}

export const STEP_DURATION_MS = 900;

export const ANALYSIS_STEPS: AnalysisProgressStep[] = [
  {
    icon: Scan,
    title: 'Water Boundary & Bank Scan',
    detail: 'Scanning shoreline contours, bays, and permanent water banks.',
  },
  {
    icon: Layers,
    title: '100m Hydro-Grid Sectors',
    detail: 'Overlaying tactical casting grid, points, and bottom transitions.',
  },
  {
    icon: Fish,
    title: 'Fish Species & Habitat',
    detail: 'Querying local roster (Bass, Pike, Zander, Carp, Barbel) and feeding depths.',
  },
  {
    icon: Footprints,
    title: 'Bank Access & Approaches',
    detail: 'Analyzing slope gradient, vehicle tracks, and shoreline footpaths.',
  },
  {
    icon: Scale,
    title: 'Permits & Regulations',
    detail: 'Verifying regional Spanish fishing licenses and protected sanctuaries.',
  },
  {
    icon: Crosshair,
    title: 'Tactical Master Plan',
    detail: 'Ranking top trophy coordinates and optimal casting game plan.',
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
  const StepIcon = currentStep.icon;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/85 p-4 backdrop-blur-md transition-opacity duration-300"
    >
      <div className="w-full max-w-md rounded-xl border border-[#2c3a2f] bg-[#151c16]/95 p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2c3a2f]/80 pb-3">
          <div className="min-w-0 flex-1 mr-3">
            <h3 className="text-sm font-bold text-[#dfd7c8] tracking-wide truncate">
              {headerTitle}
            </h3>
            <p className="text-[11px] text-[#918b80]">
              Tactical Angler Recon &amp; Hydrographic Synthesis
            </p>
          </div>
          <span className="shrink-0 rounded border border-[#d96b27]/40 bg-[#d96b27]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#d96b27]">
            {activeStepIndex + 1} / {ANALYSIS_STEPS.length}
          </span>
        </div>

        {/* Single Active Feature Spotlight (Fixed Height to Prevent Vertical Jitter) */}
        <div
          key={activeStepIndex}
          className="h-[96px] rounded-lg border border-[#2c3a2f]/80 bg-[#0e130f]/80 p-3.5 flex items-center gap-3.5 overflow-hidden"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#d96b27]/40 bg-[#d96b27]/10 text-[#d96b27]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-md bg-[#d96b27]/15 opacity-75" />
            <StepIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="text-xs font-semibold text-[#dfd7c8]">
              {currentStep.title}
            </div>
            <div className="text-xs leading-relaxed text-[#dfd7c8]/80 line-clamp-2 min-h-[2.5rem] flex items-center">
              {currentStep.detail}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1c251e]">
            <div
              className="h-full bg-[#d96b27] transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#918b80]">
            <span>Field telemetry synthesis</span>
            <span className="font-mono text-[#dfd7c8]/90">{progressPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
