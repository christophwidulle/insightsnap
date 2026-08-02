import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MAX_TRANSCRIPT_CHARS } from '../shared/types';
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

// Never report the full length silently when only a prefix was sent to the model.
function charCount({ fullText }: TranscriptResult): string {
  const total = fullText.length.toLocaleString();
  if (fullText.length <= MAX_TRANSCRIPT_CHARS) return `${total} chars`;
  return `${MAX_TRANSCRIPT_CHARS.toLocaleString()} of ${total} chars (truncated)`;
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
      const link = transcript
        ? `[${transcript.title || 'Video'}](https://www.youtube.com/watch?v=${transcript.videoId})\n\n`
        : '';
      await navigator.clipboard.writeText(link + message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ponytail: no fallback — the clipboard API is always there on https with a gesture
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
              <button type="button" onClick={copy} title={copied ? 'Copied' : 'Copy text'}>
                {copied ? '✓' : '⧉'}
              </button>
            )}
            <button type="button" onClick={onOpenOptions} title="Options">
              ⚙
            </button>
            <button type="button" onClick={onClose} title="Close">
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
                  Try again
                </button>
                <button type="button" onClick={onOpenOptions}>
                  Open options
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
              Source: {transcript.source === 'caption-track' ? 'caption track' : 'transcript panel'}
              {transcript.language && ` · ${transcript.language}`} · {charCount(transcript)}
            </span>
            <button type="button" className="is-rerun" onClick={onRetry}>
              Re-analyze
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
