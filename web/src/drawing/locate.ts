import type { LatLng } from '@doorpin/shared';

/** A location fix worse than this can't place a door pin; the sender taps it instead. */
export const MAX_DOOR_ACCURACY_M = 100;

export type ManualReason = 'unsupported' | 'refused' | 'unavailable' | 'timeout' | 'inaccurate';

export type LocateResult =
  { kind: 'found'; position: LatLng; accuracyM: number } | { kind: 'manual'; reason: ManualReason };

// Codes from the Geolocation API's GeolocationPositionError.
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;

/**
 * Asks the phone for its location once. Never rejects: anything that stops a usable fix
 * becomes `manual`, and the sender taps the door instead. The fix stays on the phone.
 *
 * The browser's own `timeoutMs` only starts once permission is granted. Some browsers never
 * answer when the permission prompt is dismissed, so a timer of our own settles the result too.
 * It is long (`giveUpAfterMs`) because it also runs while the sender reads the prompt; the
 * sender can tap their door meanwhile.
 */
export function locateOnce(
  geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined,
  { timeoutMs = 15_000, giveUpAfterMs = 60_000 } = {},
): Promise<LocateResult> {
  if (geolocation === undefined) return Promise.resolve({ kind: 'manual', reason: 'unsupported' });

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: LocateResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => settle({ kind: 'manual', reason: 'timeout' }), giveUpAfterMs);

    geolocation.getCurrentPosition(
      ({ coords }) => {
        if (coords.accuracy > MAX_DOOR_ACCURACY_M) {
          settle({ kind: 'manual', reason: 'inaccurate' });
        } else {
          settle({
            kind: 'found',
            position: { lat: coords.latitude, lng: coords.longitude },
            accuracyM: coords.accuracy,
          });
        }
      },
      (error) => {
        const reason: ManualReason =
          error.code === PERMISSION_DENIED
            ? 'refused'
            : error.code === POSITION_UNAVAILABLE
              ? 'unavailable'
              : 'timeout';
        settle({ kind: 'manual', reason });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

/**
 * Where a location answer puts the door pin, if anywhere. Only a good fix during the door step
 * places it, and never over a pin the sender placed by hand since asking.
 */
export function doorFromAnswer(
  result: LocateResult,
  { step, tapsSinceRequest }: { step: 'door' | 'path'; tapsSinceRequest: number },
): { door: LatLng; accuracyM: number } | undefined {
  if (result.kind !== 'found' || step !== 'door' || tapsSinceRequest > 0) return undefined;
  return { door: result.position, accuracyM: result.accuracyM };
}

/** What to tell the sender when their location can't place the pin. */
export function manualMessage(reason: ManualReason): string {
  switch (reason) {
    case 'unsupported':
      return "This browser can't share your location.";
    case 'refused':
      return 'Location is turned off for this page.';
    case 'unavailable':
      return "Your phone couldn't find your location.";
    case 'timeout':
      return 'Finding your location took too long.';
    case 'inaccurate':
      return `Your location is only accurate to more than ${MAX_DOOR_ACCURACY_M} m, which is not enough to find your door.`;
  }
}
