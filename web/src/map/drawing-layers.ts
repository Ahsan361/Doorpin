import { toLngLat, type LatLng } from '@doorpin/shared';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

const SOURCE = 'drawing';
const EARTH_RADIUS_M = 6_371_008.8;

/** What the map shows of the drawing in progress. */
export interface DrawingView {
  door: LatLng | null;
  /** Shown as a circle around the door while it comes from the phone's location. */
  accuracyM: number | null;
}

/** A circle of `radiusM` meters around `center`, as a closed ring of [lng, lat] positions. */
export function circleRing(center: LatLng, radiusM: number, steps = 48): [number, number][] {
  const latRad = (center.lat * Math.PI) / 180;
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.cos(latRad);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    ring.push([center.lng + dLng * Math.cos(angle), center.lat + dLat * Math.sin(angle)]);
  }
  return ring;
}

/** The GeoJSON the map draws. Each feature's `kind` picks its layer. */
export function drawingFeatures(view: DrawingView): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (view.door !== null && view.accuracyM !== null) {
    features.push({
      type: 'Feature',
      properties: { kind: 'accuracy' },
      geometry: { type: 'Polygon', coordinates: [circleRing(view.door, view.accuracyM)] },
    });
  }
  if (view.door !== null) {
    features.push({
      type: 'Feature',
      properties: { kind: 'door' },
      geometry: { type: 'Point', coordinates: toLngLat(view.door) },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Adds the drawing's source and layers. Call once, after the map's `load` event. */
export function addDrawingLayers(map: MapLibreMap): void {
  map.addSource(SOURCE, {
    type: 'geojson',
    data: drawingFeatures({ door: null, accuracyM: null }),
  });
  map.addLayer({
    id: 'drawing-accuracy',
    type: 'fill',
    source: SOURCE,
    filter: ['==', ['get', 'kind'], 'accuracy'],
    paint: { 'fill-color': '#1f6feb', 'fill-opacity': 0.12, 'fill-outline-color': '#1f6feb' },
  });
  map.addLayer({
    id: 'drawing-door',
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['get', 'kind'], 'door'],
    paint: {
      'circle-radius': 9,
      'circle-color': '#d1242f',
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  });
}

/** Redraws the drawing. Safe to call before `addDrawingLayers`: it does nothing then. */
export function showDrawing(map: MapLibreMap, view: DrawingView): void {
  map.getSource<GeoJSONSource>(SOURCE)?.setData(drawingFeatures(view));
}
