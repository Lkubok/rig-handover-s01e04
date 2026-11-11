export type RunStatus = 'ok' | 'retry' | 'fail';
export type DigestRow = {
  job: string; owner: string | null;   // view shows null as "—"; JSON keeps null
  runs: number; retries: number;       // runs = all lines for the job; retries = 'retry' lines
  lastStatus: RunStatus; lastError: string | null;  // lastError = last error seen for the job
  firstAt: string; lastAt: string;     // verbatim from the log
};
export type NightDigest = { night: string; rows: DigestRow[]; // sorted by job, by the reader
  badLines: number; counts: Record<RunStatus, number> };       // counts = log lines per status
export const NIGHT_RE = /^\d{4}-\d{2}-\d{2}$/;  // routes 404 if the night does not match
export type ReadNight = (runsDir: string, night: string) => NightDigest | null; // null = no file
