import { describe, expect, it, vi } from 'vitest';
import type { NightDigest } from '../src/digest/types.js';

const nights: Record<string, NightDigest> = {
  '2026-10-28': {
    night: '2026-10-28',
    rows: [
      { job: 'a', owner: null, runs: 5, retries: 3, lastStatus: 'fail', lastError: 'boom', firstAt: '2026-10-28T01:00:00+01:00', lastAt: '2026-10-28T02:00:00+01:00' },
    ],
    badLines: 2,
    counts: { ok: 0, retry: 3, fail: 2 },
  },
  '2026-10-27': { night: '2026-10-27', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } },
};
vi.mock('../src/digest/read.js', () => ({ readNight: (_d: string, n: string) => nights[n] ?? null }));

const { createApp } = await import('../src/app.js');
const config = { adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders marks, dash owner and unreadable count', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('—');
    expect(html).toContain('3 !');
    expect(html).toContain('fail !');
    expect(html).toContain('2 unreadable lines');
  });
  it('empty night says nothing ran', async () => {
    const html = await (await createApp(config).request('/digest/2026-10-27')).text();
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('unreadable');
  });
  it('404 for missing and malformed nights', async () => {
    expect((await createApp(config).request('/digest/2026-01-01')).status).toBe(404);
    expect((await createApp(config).request('/digest/nope')).status).toBe(404);
  });
});
