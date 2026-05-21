import { useEffect, useState } from 'react';
import type { PageSnapshot } from '../shared/types';

export function App() {
  const [snapshot, setSnapshot] = useState<PageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function snap() {
    setLoading(true);
    setError(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'SNAP' });
      setSnapshot(res as PageSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void snap();
  }, []);

  return (
    <main className="popup">
      <header>
        <h1>InsightSnap</h1>
        <button onClick={snap} disabled={loading}>
          {loading ? '…' : 'Re-snap'}
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      {snapshot && (
        <section className="insights">
          <h2>{snapshot.title}</h2>
          <p className="url">{snapshot.url}</p>
          <dl>
            <dt>Words</dt><dd>{snapshot.wordCount}</dd>
            <dt>Links</dt><dd>{snapshot.linkCount}</dd>
            <dt>Images</dt><dd>{snapshot.imageCount}</dd>
            <dt>Headings</dt><dd>{snapshot.headingCount}</dd>
            <dt>Lang</dt><dd>{snapshot.lang || '—'}</dd>
          </dl>
          {snapshot.description && (
            <>
              <h3>Description</h3>
              <p>{snapshot.description}</p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
