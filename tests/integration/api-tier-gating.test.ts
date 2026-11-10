import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWaterBodyPins,
  getWaterBodyDetailsForTier,
  resetStoreForTests,
} from '@/shared/db/store';
import {
  submitSpotReview,
} from '@/modules/reviews/review.service';
import { checkAndConsumeGuestBasicQuota } from '@/shared/auth/tier-gating';

describe('F01 / F02 / F04 — Guest vs. Registered Tier Gating & Reviews Integration', () => {
  beforeEach(() => {
    resetStoreForTests();
  });

  it('returns named Water Body Pins on map load for both guest and registered users', () => {
    const pins = getWaterBodyPins();
    expect(pins.length).toBeGreaterThanOrEqual(6);
    expect(pins.some((p) => p.countryCode === 'PL' && p.name.includes('Zegrzyńskie'))).toBe(true);
    expect(pins.some((p) => p.countryCode === 'ES' && p.name.includes('Mequinenza'))).toBe(true);
  });

  it('withholds spatial grid and exact fishing spots from Guests while returning basic description, catchable fish, teaser feedback, and CTA', () => {
    const guestView = getWaterBodyDetailsForTier('wb-pl-zegrzynskie', {
      isAuthenticated: false,
    });

    expect(guestView).not.toBeNull();
    expect(guestView!.tier).toBe('guest');
    expect(guestView!.waterBody.name).toBe('Jezioro Zegrzyńskie');
    expect(guestView!.waterBody.commonSpecies).toContain('zander');
    expect(guestView!.teaserFeedback.length).toBeGreaterThan(0);
    expect(guestView!.cta.requiresEmailRegistration).toBe(true);

    // Crucial SDD Invariant: Guests never receive the spatial grid or exact fishing spots!
    expect(guestView!.grid).toBeNull();
    expect(guestView!.exactSpots).toEqual([]);
    expect(guestView!.fullReviews).toEqual([]);
  });

  it('unlocks spatial grid (A1..H8), pre-seeded exact fishing spots, and full reviews/photos for Registered Users', () => {
    const registeredView = getWaterBodyDetailsForTier('wb-pl-zegrzynskie', {
      isAuthenticated: true,
      userEmail: 'angler@example.com',
    });

    expect(registeredView).not.toBeNull();
    expect(registeredView!.tier).toBe('registered');
    expect(registeredView!.grid).not.toBeNull();
    expect(registeredView!.grid!.cells.length).toBeGreaterThan(10);
    expect(registeredView!.exactSpots.length).toBeGreaterThanOrEqual(2);
    expect(registeredView!.exactSpots[0].cell_id).toBe('C4');
    expect(registeredView!.fullReviews.length).toBeGreaterThanOrEqual(2);
  });

  it('enforces the 2-analysis guest basic quota limit', () => {
    const guestSessionId = 'guest-test-session-1';
    const run1 = checkAndConsumeGuestBasicQuota(guestSessionId);
    expect(run1.allowed).toBe(true);
    expect(run1.remaining).toBe(1);

    const run2 = checkAndConsumeGuestBasicQuota(guestSessionId);
    expect(run2.allowed).toBe(true);
    expect(run2.remaining).toBe(0);

    const run3 = checkAndConsumeGuestBasicQuota(guestSessionId);
    expect(run3.allowed).toBe(false);
    expect(run3.remaining).toBe(0);
  });

  it('allows a registered user to attach a review and compressed WebP catch photo to a water body pin and updates ratings', () => {
    const newReview = submitSpotReview({
      waterBodyId: 'wb-es-mequinenza',
      spotId: 'spot-mequinenza-d3',
      cellId: 'D3',
      userId: 'user-elena',
      authorName: 'Elena G.',
      rating: 5,
      comment: 'Caught a personal best 78cm zander right on the 9m limestone terrace in D3!',
      fishingTypeUsed: 'spinning',
      speciesCaught: [{ species: 'zander', count: 1, lengthCm: 78, weightKg: 4.5 }],
      fishedOn: '2026-11-09',
      photos: [
        {
          storagePath: 'catches/elena-zander-d3.webp',
          publicUrl: 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
          photoType: 'catch',
        },
      ],
    });

    expect(newReview.id).toBeDefined();
    expect(newReview.photos.length).toBe(1);

    const updatedView = getWaterBodyDetailsForTier('wb-es-mequinenza', {
      isAuthenticated: true,
      userEmail: 'elena@example.com',
    });
    expect(updatedView!.fullReviews.some((r) => r.authorName === 'Elena G.')).toBe(true);
  });
});
