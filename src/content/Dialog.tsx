import type { TranscriptResult } from '../shared/types';

interface Props {
  open: boolean;
  status: 'idle' | 'loading' | 'done' | 'error';
  message: string;
  transcript?: TranscriptResult;
  onClose: () => void;
  onOpenOptions: () => void;
  onRetry: () => void;
}

export function Dialog({
  open,
  status,
  message,
  transcript,
  onClose,
  onOpenOptions,
  onRetry,
}: Props) {
  if (!open) return null;

  return (
    <div className="is-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="is-panel" onClick={(e) => e.stopPropagation()}>
        <header className="is-header">
          <div>
            <h2>InsightSnap</h2>
            {transcript?.title && <p className="is-subtitle">{transcript.title}</p>}
          </div>
          <div className="is-actions">
            <button type="button" onClick={onOpenOptions} title="Einstellungen">
              ⚙
            </button>
            <button type="button" onClick={onClose} title="Schliessen">
              ✕
            </button>
          </div>
        </header>

        <div className={`is-body is-${status}`}>
          {status === 'loading' && (
            <div className="is-loading">
              <div className="is-spinner" aria-hidden="true" />
              <span>{message}</span>
            </div>
          )}
          {status === 'error' && (
            <div className="is-error">
              <p>{message}</p>
              <div className="is-row">
                <button type="button" onClick={onRetry}>
                  Erneut versuchen
                </button>
                <button type="button" onClick={onOpenOptions}>
                  Einstellungen öffnen
                </button>
              </div>
            </div>
          )}
          {status === 'done' && <pre className="is-content">{message}</pre>}
        </div>

        {transcript && status === 'done' && (
          <footer className="is-footer">
            Quelle: {transcript.source === 'caption-track' ? 'Caption-Track' : 'Transkript-Panel'}
            {transcript.language && ` · ${transcript.language}`} ·{' '}
            {transcript.fullText.length.toLocaleString('de-DE')} Zeichen
          </footer>
        )}
      </div>
    </div>
  );
}
