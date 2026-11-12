/** Map start position as [longitude, latitude]. Lahore is a placeholder until the first target city is chosen. */
export const DEFAULT_CENTER: [number, number] = [74.3587, 31.5204];
export const DEFAULT_ZOOM = 14;

/** Low-detail public demo style, used only when no style URL is configured. */
export const FALLBACK_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

/** Returns the configured map style URL, or the fallback when it is missing or blank. */
export function resolveMapStyleUrl(configured: string | undefined): string {
  const trimmed = configured?.trim();
  return trimmed ? trimmed : FALLBACK_STYLE_URL;
}
