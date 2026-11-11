import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight on runs/2026-10-28.jsonl', () => {
  const d = readNight('runs', '2026-10-28')!;

  it('gives 5 jobs sorted by job and 1 bad line', () => {
    expect(d.night).toBe('2026-10-28');
    expect(d.badLines).toBe(1);
    expect(d.rows.map((r) => r.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
  });

  it('counts log lines per status', () => {
    expect(d.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('builds the per-job rows', () => {
    const by = Object.fromEntries(d.rows.map((r) => [r.job, r]));
    expect(by['fixtures/refresh']).toEqual({
      job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3,
      lastStatus: 'ok', lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(by['lane/sync']).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' });
    expect(by['notes/backup']).toMatchObject({ runs: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(by['digest/render']).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });
});

describe('readNight edge cases', () => {
  it('returns null when there is no file', () => {
    expect(readNight(tmp, '2001-01-01')).toBeNull();
  });

  it('gives zero rows for an empty file', () => {
    writeFileSync(join(tmp, '2001-01-02.jsonl'), '');
    expect(readNight(tmp, '2001-01-02')).toEqual({
      night: '2001-01-02', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts unparseable or malformed lines instead of throwing', () => {
    writeFileSync(join(tmp, '2001-01-03.jsonl'), [
      '{"at":"t1","job":"b","status":"ok","owner":null}',
      'not json',
      '{"at":"t2","job":"a","status":"bogus","owner":"x"}',
      '[1,2]',
      '',
      '{"at":"t3","job":"a","status":"retry","owner":"x","error":"e"}',
      '{"at":"t4","job":"a"',
    ].join('\n'));
    const d = readNight(tmp, '2001-01-03')!;
    expect(d.badLines).toBe(4);
    expect(d.rows.map((r) => r.job)).toEqual(['a', 'b']);
    expect(d.rows[1]!.owner).toBeNull();
    expect(d.counts).toEqual({ ok: 1, retry: 1, fail: 0 });
  });
});
