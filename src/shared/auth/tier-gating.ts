const MAX_GUEST_BASIC_ANALYSES = 2;
const guestQuotaMap = new Map<string, number>();

export interface AuthSessionContext {
  isAuthenticated: boolean;
  userId?: string;
  userEmail?: string;
  displayName?: string;
}

export interface GuestQuotaResult {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
}

/**
 * Tracks and enforces the 2-run basic AI analysis quota for unauthenticated guests.
 */
export function checkAndConsumeGuestBasicQuota(
  guestSessionId: string
): GuestQuotaResult {
  const current = guestQuotaMap.get(guestSessionId) ?? 0;
  if (current >= MAX_GUEST_BASIC_ANALYSES) {
    return {
      allowed: false,
      used: current,
      remaining: 0,
      limit: MAX_GUEST_BASIC_ANALYSES,
    };
  }

  const next = current + 1;
  guestQuotaMap.set(guestSessionId, next);
  return {
    allowed: true,
    used: next,
    remaining: MAX_GUEST_BASIC_ANALYSES - next,
    limit: MAX_GUEST_BASIC_ANALYSES,
  };
}

export function resetGuestQuotasForTests(): void {
  guestQuotaMap.clear();
}

/**
 * Resolves the current user session from request headers/cookies.
 */
export function resolveSessionFromHeaders(headers: Headers): AuthSessionContext {
  const emailHeader = headers.get('x-angler-email')?.trim();
  if (emailHeader && emailHeader.includes('@')) {
    const namePart = emailHeader.split('@')[0];
    return {
      isAuthenticated: true,
      userId: `user-${namePart}`,
      userEmail: emailHeader,
      displayName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
    };
  }
  return {
    isAuthenticated: false,
  };
}
