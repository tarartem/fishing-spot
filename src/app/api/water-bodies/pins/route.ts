import { NextResponse } from 'next/server';
import { getWaterBodyPins } from '@/shared/db/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country =
    searchParams.get('country') ??
    searchParams.get('countryCode') ??
    undefined;
  const pins = getWaterBodyPins(country);

  return NextResponse.json({ waterBodyPins: pins });
}
