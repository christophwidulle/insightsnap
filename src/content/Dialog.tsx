import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ponytail: kein Fallback – Clipboard-API ist auf https/Nutzergeste immer da
    }
  };

  return (
    <div className="is-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="is-panel" onClick={(e) => e.stopPropagation()}>
        <header className="is-header">
          <div>
            <h2>InsightSnap</h2>
            {transcript?.title && <p className="is-subtitle">{transcript.title}</p>}
          </div>
          <div className="is-actions">
            {status === 'done' && (
              <button
                type="button"
                onClick={copy}
                title={copied ? 'Kopiert' : 'Text kopieren'}
              >
                {copied ? '✓' : '⧉'}
              </button>
            )}
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
          {status === 'done' && (
            <div className="is-content">
              <Markdown remarkPlugins={[remarkGfm]}>{message}</Markdown>
            </div>
          )}
        </div>

        {transcript && status === 'done' && (
          <footer className="is-footer">
            <span>
              Quelle: {transcript.source === 'caption-track' ? 'Caption-Track' : 'Transkript-Panel'}
              {transcript.language && ` · ${transcript.language}`} ·{' '}
              {transcript.fullText.length.toLocaleString('de-DE')} Zeichen
            </span>
            <button type="button" className="is-rerun" onClick={onRetry}>
              Neu analysieren
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
