import { NextResponse } from 'next/server';
import { analyzeWaterBodyScreenshot } from '@/modules/ai-advisor/screenshot-analyzer.service';
import type { BoundingBox, ClientWaterMaskSummary } from '@/shared/types/domain';

export async function POST(request: Request) {
  const body = await request.json();
  const {
    bbox = [-0.972, 39.222, -0.92, 39.262],
    griddedScreenshotBase64,
    anglerGearNote,
    hintWaterBodyId,
    clientWaterMask,
  } = body as {
    bbox?: BoundingBox;
    griddedScreenshotBase64?: string;
    anglerGearNote?: string;
    hintWaterBodyId?: string;
    clientWaterMask?: ClientWaterMaskSummary | null;
  };

  const analysis = await analyzeWaterBodyScreenshot({
    bbox,
    griddedScreenshotBase64,
    anglerGearNote,
    hintWaterBodyId,
    clientWaterMask,
  });

  return NextResponse.json(analysis);
}
