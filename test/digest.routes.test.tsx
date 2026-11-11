import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

// Fixtures live in a temp runs dir; the real runs/ is never read or written.
let runsDir: string;
const config = () => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

const line = (o: Record<string, unknown>) => JSON.stringify(o);
const FULL = [
  line({ at: '2026-10-28T23:00:06+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }),
  line({ at: '2026-10-29T01:30:00+01:00', job: 'fixtures/refresh', status: 'retry', owner: 'rook', error: 'upstream 503' }),
  line({ at: '2026-10-29T01:31:00+01:00', job: 'fixtures/refresh', status: 'retry', owner: 'rook', error: 'upstream 503' }),
  line({ at: '2026-10-29T01:33:00+01:00', job: 'fixtures/refresh', status: 'retry', owner: 'rook', error: 'upstream 503' }),
  line({ at: '2026-10-29T02:00:00+01:00', job: 'fixtures/refresh', status: 'fail', owner: 'rook', error: 'gave up' }),
  line({ at: '2026-10-29T03:00:00+01:00', job: 'ghost/job', status: 'ok', owner: null }),
  line({ at: '2026-10-29T04:00:00+01:00', job: 'a/first', status: 'ok', owner: 'lane-07' }),
].join('\n') + '\n';

const originalMarker = process.env.LANE_MARKER;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  mkdirSync(runsDir, { recursive: true });
  writeFileSync(join(runsDir, '2026-10-28.jsonl'), FULL);
  writeFileSync(join(runsDir, '2026-10-27.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-10-26.jsonl'),
    line({ at: '2026-10-26T23:00:00+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }) + '\n{not json\n',
  );
});

afterEach(() => {
  if (originalMarker === undefined) delete process.env.LANE_MARKER;
  else process.env.LANE_MARKER = originalMarker;
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

describe('digest page', () => {
  it('renders a table sorted by job with owner null as an em dash', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config()).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    const order = ['a/first', 'fixtures/refresh', 'ghost/job', 'lane/sync'].map((j) => html.indexOf(j));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('—');
  });

  it('404 for a night with no file or a malformed night', async () => {
    const app = createApp(config());
    expect((await app.request('/digest/2026-01-01')).status).toBe(404);
    expect((await app.request('/digest/not-a-night')).status).toBe(404);
  });

  it('empty night says nothing ran', async () => {
    const res = await createApp(config()).request('/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect((await res.text()).toLowerCase()).toContain('nothing ran');
  });

  it('shows the unreadable-line count for a night with a bad line', async () => {
    const res = await createApp(config()).request('/digest/2026-10-26');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toMatch(/unreadable|bad/i);
  });
});

describe('digest JSON', () => {
  it('returns the rows sorted by job with owner null kept and counts', async () => {
    const res = await createApp(config()).request('/api/digest/2026-10-28');
    const body = (await res.json()) as NightDigest;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-10-28');
    expect(body.rows.map((r) => r.job)).toEqual(['a/first', 'fixtures/refresh', 'ghost/job', 'lane/sync']);
    expect(body.rows.find((r) => r.job === 'ghost/job')?.owner).toBeNull();
    const fx = body.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fx).toMatchObject({ runs: 4, retries: 3, lastStatus: 'fail', lastError: 'gave up' });
    expect(body.badLines).toBe(0);
    expect(body.counts).toMatchObject({ ok: 3, retry: 3, fail: 1 });
  });

  it('page and JSON list the same jobs in the same order', async () => {
    const app = createApp(config());
    const html = await (await app.request('/digest/2026-10-28')).text();
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as NightDigest;
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((i) => i >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('404 for a missing or malformed night', async () => {
    const app = createApp(config());
    expect((await app.request('/api/digest/2026-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/nope')).status).toBe(404);
  });

  it('empty night gives zero rows', async () => {
    const res = await createApp(config()).request('/api/digest/2026-10-27');
    const body = (await res.json()) as NightDigest;
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
  });

  it('bad line is counted, not thrown', async () => {
    const res = await createApp(config()).request('/api/digest/2026-10-26');
    const body = (await res.json()) as NightDigest;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync']);
  });
});
