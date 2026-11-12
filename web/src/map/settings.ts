/**
 * Map start position as [longitude, latitude]: Faizabad Interchange, where Islamabad and
 * Rawalpindi meet. The twin cities are the first target area.
 */
export const DEFAULT_CENTER: [number, number] = [73.084, 33.663];
export const DEFAULT_ZOOM = 12;

/** Low-detail public demo style, used only when no style URL is configured. */
export const FALLBACK_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

/** Returns the configured map style URL, or the fallback when it is missing or blank. */
export function resolveMapStyleUrl(configured: string | undefined): string {
  const trimmed = configured?.trim();
  return trimmed ? trimmed : FALLBACK_STYLE_URL;
}
