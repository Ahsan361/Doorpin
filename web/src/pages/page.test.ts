import { describe, expect, it } from 'vitest';
import { pageFor } from './page.ts';

const ROUTE_ID = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
const TOKEN = 'fakeOwnerToken_0000000';

describe('pageFor', () => {
  it('shows the create page at the root', () => {
    expect(pageFor('/', '')).toEqual({ name: 'create' });
  });

  it('shows the edit page for a complete edit link, with or without a trailing slash', () => {
    const expected = { name: 'edit', routeId: ROUTE_ID, ownerToken: TOKEN };
    expect(pageFor(`/edit/${ROUTE_ID}`, `#${TOKEN}`)).toEqual(expected);
    expect(pageFor(`/edit/${ROUTE_ID}/`, `#${TOKEN}`)).toEqual(expected);
  });

  it('treats an edit link with a missing or malformed token as not found', () => {
    expect(pageFor(`/edit/${ROUTE_ID}`, '')).toEqual({ name: 'not-found' });
    expect(pageFor(`/edit/${ROUTE_ID}`, '#short')).toEqual({ name: 'not-found' });
    expect(pageFor(`/edit/${ROUTE_ID}`, `#${TOKEN}x`)).toEqual({ name: 'not-found' });
  });

  it('treats a malformed route id or any other path as not found', () => {
    expect(pageFor('/edit/not-a-uuid', `#${TOKEN}`)).toEqual({ name: 'not-found' });
    expect(pageFor(`/edit/${ROUTE_ID}/extra`, `#${TOKEN}`)).toEqual({ name: 'not-found' });
    expect(pageFor('/track/abc', '')).toEqual({ name: 'not-found' });
  });
});
