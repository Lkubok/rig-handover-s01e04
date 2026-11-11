import type { NightDigest } from '../digest/types.js';

const dash = '—';

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest {digest.night}</h1>
      {digest.badLines > 0 && <p class="warn">{digest.badLines} unreadable lines</p>}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>last</th><th>last error</th><th>first</th><th>last at</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((r) => (
              <tr>
                <td>{r.job}</td>
                <td>{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td class={r.retries >= 3 ? 'warn' : undefined}>{r.retries}{r.retries >= 3 ? ' !' : ''}</td>
                <td class={r.lastStatus === 'fail' ? 'warn' : undefined}>{r.lastStatus}{r.lastStatus === 'fail' ? ' !' : ''}</td>
                <td>{r.lastError ?? dash}</td>
                <td>{r.firstAt || dash}</td>
                <td>{r.lastAt || dash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
