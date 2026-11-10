import { NextResponse } from 'next/server';
import { getWaterBodyById } from '@/shared/db/store';
import {
  resolveSessionFromHeaders,
  checkAndConsumeGuestBasicQuota,
} from '@/shared/auth/tier-gating';
import {
  resolveTacticalSectorBbox,
  generateSpatialGrid,
} from '@/modules/map-grid/grid-engine';
import { recommendFishingSpots } from '@/modules/ai-advisor/ai-advisor.service';
import type {
  AccessMode,
  FishingType,
  Season,
  TargetSpecies,
  WaterType,
} from '@/shared/types/domain';

export async function POST(request: Request) {
  const session = resolveSessionFromHeaders(request.headers);
  const body = await request.json();

  const {
    waterBodyId,
    waterType,
    fishingType = 'spinning',
    targetSpecies = ['any'],
    accessMode = 'shore',
    season = 'autumn',
  } = body as {
    waterBodyId: string;
    waterType?: WaterType;
    fishingType?: FishingType;
    targetSpecies?: TargetSpecies[];
    accessMode?: AccessMode;
    season?: Season;
  };

  const wb = getWaterBodyById(waterBodyId);
  if (!wb) {
    return NextResponse.json(
      { error: 'Water body not found' },
      { status: 404 }
    );
  }

  // Guest gating: Guests can only run up to 2 basic water-body checks and never receive exact grid spots
  if (!session.isAuthenticated) {
    const guestId =
      request.headers.get('x-guest-session') ?? 'anonymous-guest';
    const quota = checkAndConsumeGuestBasicQuota(guestId);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          code: 'GUEST_LIMIT_REACHED',
          message:
            'You have used your 2 free guest water-body checks. Register free with your email to unlock exact fishing spots on the spatial grid and unlimited AI analyses.',
          quota,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      tier: 'guest',
      quota,
      basicSummary: `${wb.name} (${wb.regionLabel}) is a prime ${wb.waterType} fishery for ${wb.commonSpecies.join(', ')}. Register free with your email to unlock the A1–H8 Spatial Grid and exact fishing spot pins.`,
      commonSpecies: wb.commonSpecies,
      grid: null,
      recommended_spots: [],
    });
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

  const result = await recommendFishingSpots({
    waterBody: wb,
    sectorBbox,
    gridCells,
    waterType: waterType ?? wb.waterType,
    fishingType,
    targetSpecies,
    accessMode,
    season,
  });

  return NextResponse.json({
    tier: 'registered',
    queryHash: result.queryHash,
    cacheHit: result.cacheHit,
    grid: {
      sectorBbox,
      cells: gridCells,
    },
    ...result.recommendation,
  });
}
