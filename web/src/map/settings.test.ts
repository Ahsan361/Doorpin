import { describe, expect, it } from 'vitest';
import { FALLBACK_STYLE_URL, resolveMapStyleUrl } from './settings.ts';

describe('resolveMapStyleUrl', () => {
  it('uses the configured style URL', () => {
    expect(resolveMapStyleUrl(' https://tiles.example.com/style.json ')).toBe(
      'https://tiles.example.com/style.json',
    );
  });

  it('falls back when the setting is missing or blank', () => {
    expect(resolveMapStyleUrl(undefined)).toBe(FALLBACK_STYLE_URL);
    expect(resolveMapStyleUrl('  ')).toBe(FALLBACK_STYLE_URL);
  });
});
