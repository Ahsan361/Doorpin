import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { doorFromAnswer, locateOnce, manualMessage, type ManualReason } from './locate.ts';

type Success = Parameters<Geolocation['getCurrentPosition']>[0];
type Failure = NonNullable<Parameters<Geolocation['getCurrentPosition']>[1]>;

/** A fake Geolocation that answers with `answer`, or never answers when `answer` is undefined. */
function fakeGeolocation(answer?: (ok: Success, fail: Failure) => void) {
  return { getCurrentPosition: (ok: Success, fail?: Failure | null) => answer?.(ok, fail!) };
}

function fix(accuracy: number) {
  return (ok: Success) =>
    ok({ coords: { latitude: 33.66, longitude: 73.08, accuracy } } as GeolocationPosition);
}

function failWith(code: number) {
  return (_ok: Success, fail: Failure) => fail({ code } as GeolocationPositionError);
}

describe('locateOnce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('places the door from a good fix', async () => {
    await expect(locateOnce(fakeGeolocation(fix(12)))).resolves.toEqual({
      kind: 'found',
      position: { lat: 33.66, lng: 73.08 },
      accuracyM: 12,
    });
  });

  it('accepts a fix of exactly 100 m but not worse', async () => {
    await expect(locateOnce(fakeGeolocation(fix(100)))).resolves.toMatchObject({ kind: 'found' });
    await expect(locateOnce(fakeGeolocation(fix(100.5)))).resolves.toEqual({
      kind: 'manual',
      reason: 'inaccurate',
    });
  });

  it('falls back to tapping when location is refused, unavailable or slow', async () => {
    await expect(locateOnce(fakeGeolocation(failWith(1)))).resolves.toEqual({
      kind: 'manual',
      reason: 'refused',
    });
    await expect(locateOnce(fakeGeolocation(failWith(2)))).resolves.toEqual({
      kind: 'manual',
      reason: 'unavailable',
    });
    await expect(locateOnce(fakeGeolocation(failWith(3)))).resolves.toEqual({
      kind: 'manual',
      reason: 'timeout',
    });
  });

  it('falls back when the browser has no location API', async () => {
    await expect(locateOnce(undefined)).resolves.toEqual({ kind: 'manual', reason: 'unsupported' });
  });

  it('still takes a fix that comes 20 s later (the sender was reading the permission prompt)', async () => {
    const slow = fakeGeolocation((ok) => setTimeout(() => fix(15)(ok), 20_000));
    const result = locateOnce(slow);
    await vi.advanceTimersByTimeAsync(21_000);
    await expect(result).resolves.toMatchObject({ kind: 'found', accuracyM: 15 });
  });

  it('gives up on its own after a minute when the browser never answers (a dismissed prompt)', async () => {
    const result = locateOnce(fakeGeolocation());
    let settled = false;
    void result.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(59_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toEqual({ kind: 'manual', reason: 'timeout' });
  });

  it('keeps the first answer if the browser answers twice', async () => {
    const result = locateOnce(
      fakeGeolocation((ok, fail) => {
        fix(10)(ok);
        failWith(1)(ok, fail);
      }),
    );
    await expect(result).resolves.toMatchObject({ kind: 'found' });
  });
});

describe('doorFromAnswer', () => {
  const found = { kind: 'found', position: { lat: 33.66, lng: 73.08 }, accuracyM: 12 } as const;

  it('places the door from a good fix during the door step', () => {
    expect(doorFromAnswer(found, { step: 'door', tapsSinceRequest: 0 })).toEqual({
      door: { lat: 33.66, lng: 73.08 },
      accuracyM: 12,
    });
  });

  it('never moves a pin the sender placed by hand while waiting', () => {
    expect(doorFromAnswer(found, { step: 'door', tapsSinceRequest: 1 })).toBeUndefined();
  });

  it('ignores an answer that comes after the door step is over', () => {
    expect(doorFromAnswer(found, { step: 'path', tapsSinceRequest: 0 })).toBeUndefined();
  });

  it('places nothing when there was no usable fix', () => {
    const manual = { kind: 'manual', reason: 'refused' } as const;
    expect(doorFromAnswer(manual, { step: 'door', tapsSinceRequest: 0 })).toBeUndefined();
  });
});

describe('manualMessage', () => {
  it('has a message for every reason', () => {
    const reasons: ManualReason[] = [
      'unsupported',
      'refused',
      'unavailable',
      'timeout',
      'inaccurate',
    ];
    for (const reason of reasons) expect(manualMessage(reason).length).toBeGreaterThan(10);
  });
});
