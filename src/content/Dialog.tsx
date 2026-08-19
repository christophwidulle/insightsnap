import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownFilename, withFrontMatter, withVideoLink } from '../shared/markdown';
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

// Floppy disk, the conventional save glyph — no Unicode character for it renders reliably.
function SaveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
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
  const [menuOpen, setMenuOpen] = useState(false);

  if (!open) return null;

  const copy = async (text: string) => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(withVideoLink(text, transcript));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ponytail: no fallback — the clipboard API is always there on https with a gesture
    }
  };

  // A blob URL plus a download anchor keeps this in the content script — no
  // chrome.downloads permission, no round trip through the service worker.
  const save = () => {
    const blob = new Blob([withFrontMatter(message, transcript)], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = markdownFilename(transcript);
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Chrome takes over the blob synchronously on click, so the next task can free it.
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
              <div
                className="is-split"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false);
                }}
              >
                <button
                  type="button"
                  onClick={() => copy(message)}
                  title={copied ? 'Copied' : 'Copy summary'}
                >
                  {copied ? '✓' : '⧉'}
                </button>
                {transcript && (
                  <button
                    type="button"
                    className="is-caret"
                    aria-expanded={menuOpen}
                    aria-label="More copy options"
                    onClick={() => setMenuOpen(!menuOpen)}
                  >
                    ▾
                  </button>
                )}
                {menuOpen && transcript && (
                  <div className="is-menu">
                    <button type="button" onClick={() => copy(message)}>
                      Copy summary
                    </button>
                    <button type="button" onClick={() => copy(transcript.fullText)}>
                      Copy transcript
                    </button>
                  </div>
                )}
              </div>
            )}
            {status === 'done' && (
              <button type="button" onClick={save} title="Save as Markdown">
                <SaveIcon />
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
