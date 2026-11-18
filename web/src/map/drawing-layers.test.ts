import { distanceM } from '@doorpin/shared';
import { describe, expect, it } from 'vitest';
import { circleRing, drawingFeatures } from './drawing-layers.ts';

const door = { lat: 33.66, lng: 73.08 };

describe('circleRing', () => {
  it('draws a closed ring whose points are the radius away from the center', () => {
    const ring = circleRing(door, 40);
    expect(ring[0]).toEqual(ring.at(-1));
    for (const [lng, lat] of ring) {
      expect(distanceM(door, { lat, lng })).toBeCloseTo(40, 0);
    }
  });
});

describe('drawingFeatures', () => {
  it('draws nothing before the door is known', () => {
    expect(drawingFeatures({ door: null, accuracyM: null }).features).toEqual([]);
  });

  it('draws the door, with an accuracy circle only when the accuracy is known', () => {
    const kinds = (accuracyM: number | null) =>
      drawingFeatures({ door, accuracyM }).features.map((feature) => feature.properties?.kind);
    expect(kinds(25)).toEqual(['accuracy', 'door']);
    expect(kinds(null)).toEqual(['door']);
  });

  it('puts the door in [lng, lat] order', () => {
    const [feature] = drawingFeatures({ door, accuracyM: null }).features;
    expect(feature?.geometry).toEqual({ type: 'Point', coordinates: [73.08, 33.66] });
  });
});
