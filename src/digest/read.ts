import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type Entry = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

// One log line -> entry, or null if it does not parse or lacks the required fields.
function parseLine(line: string): Entry | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || o.job === '') return null;
  if (!STATUSES.includes(o.status as RunStatus)) return null;
  if (o.owner !== undefined && o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && o.error !== null && typeof o.error !== 'string') return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: (o.owner as string | null | undefined) ?? null,
    error: (o.error as string | null | undefined) ?? null,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');

  const rows = new Map<string, DigestRow>();
  const counts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const e = parseLine(line);
    if (!e) {
      badLines++;
      continue;
    }
    counts[e.status]++;
    const row = rows.get(e.job);
    if (!row) {
      rows.set(e.job, {
        job: e.job, owner: e.owner,
        runs: 1, retries: e.status === 'retry' ? 1 : 0,
        lastStatus: e.status, lastError: e.error,
        firstAt: e.at, lastAt: e.at,
      });
      continue;
    }
    row.runs++;
    if (e.status === 'retry') row.retries++;
    row.lastStatus = e.status;
    if (e.error !== null) row.lastError = e.error;
    if (e.owner !== null) row.owner = e.owner;
    row.lastAt = e.at;
  }

  const sorted = [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows: sorted, badLines, counts } satisfies NightDigest;
};
