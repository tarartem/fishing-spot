import { NextResponse } from 'next/server';
import { getWaterBodyById } from '@/shared/db/store';
import { resolveSessionFromHeaders } from '@/shared/auth/tier-gating';
import {
  resolveTacticalSectorBbox,
  generateSpatialGrid,
} from '@/modules/map-grid/grid-engine';
import { analyzeSingleGridCell } from '@/modules/ai-advisor/ai-advisor.service';
import type {
  AccessMode,
  FishingType,
  TargetSpecies,
} from '@/shared/types/domain';

export async function POST(request: Request) {
  const session = resolveSessionFromHeaders(request.headers);
  if (!session.isAuthenticated) {
    return NextResponse.json(
      {
        code: 'REGISTRATION_REQUIRED',
        message:
          'Single-cell spatial grid micro-analysis requires free Email registration.',
      },
      { status: 403 }
    );
  }

  const body = await request.json();
  const {
    waterBodyId,
    cellId,
    fishingType = 'spinning',
    targetSpecies = ['any'],
    accessMode = 'shore',
  } = body as {
    waterBodyId: string;
    cellId: string;
    fishingType?: FishingType;
    targetSpecies?: TargetSpecies[];
    accessMode?: AccessMode;
  };

  const wb = getWaterBodyById(waterBodyId);
  if (!wb) {
    return NextResponse.json(
      { error: 'Water body not found' },
      { status: 404 }
    );
  }

  const sectorBbox = resolveTacticalSectorBbox(wb.bbox, {
    latitude: wb.centerLat,
    longitude: wb.centerLng,
  });
  const gridCells = generateSpatialGrid({
    sectorBbox,
    waterPolygon: wb.polygon,
    restrictionZones: wb.restrictionZones,
  });

  const cell = gridCells.find(
    (c) => c.cellId.toUpperCase() === cellId?.toUpperCase()
  );
  if (!cell) {
    return NextResponse.json(
      { error: `Grid cell "${cellId}" not found on this water body.` },
      { status: 404 }
    );
  }

  const analysis = await analyzeSingleGridCell({
    waterBody: wb,
    cell,
    fishingType,
    targetSpecies,
    accessMode,
  });

  return NextResponse.json(analysis);
}
