import type { CSSProperties } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Sparkles } from 'lucide-react';
import { Dialog } from './Dialog';
import { extractTranscript } from '../shared/transcript';
import { MAX_TRANSCRIPT_CHARS } from '../shared/types';
import type { LLMResponse, RuntimeMessage, TranscriptResult } from '../shared/types';
import dialogCss from './dialog.css?inline';

const BUTTON_ID = 'insightsnap-trigger';
const HOST_ID = 'insightsnap-host';

let dialogRoot: Root | null = null;
let dialogHost: HTMLDivElement | null = null;
let triggerRoot: Root | null = null;

function isWatchPage(href: string): boolean {
  try {
    const u = new URL(href);
    return u.pathname === '/watch' && u.searchParams.has('v');
  } catch {
    return false;
  }
}

// The trigger sits in YouTube's own DOM, so it carries its styles inline. Rendering it
// through React is what lets it share the Lucide icon set with the dialog.
const TRIGGER_STYLE: CSSProperties = {
  marginLeft: '8px',
  padding: '0 16px',
  height: '36px',
  borderRadius: '18px',
  border: 'none',
  background: 'rgba(255,255,255,0.1)',
  color: 'inherit',
  font: 'inherit',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};

function Trigger() {
  return (
    <button
      type="button"
      title="InsightSnap – analyze this video"
      style={TRIGGER_STYLE}
      onClick={openDialog}
    >
      <Sparkles size={16} />
      InsightSnap
    </button>
  );
}

function ensureButton() {
  const existing = document.getElementById(BUTTON_ID);

  if (!isWatchPage(location.href)) {
    if (existing) {
      triggerRoot?.unmount();
      triggerRoot = null;
      existing.remove();
    }
    return;
  }
  if (existing) return;

  const anchor =
    document.querySelector('ytd-watch-metadata #actions') ??
    document.querySelector('ytd-watch-metadata #top-level-buttons-computed');
  if (!anchor) return;

  // Reaching here with a root still set means a YouTube rerender dropped its host.
  triggerRoot?.unmount();

  const host = document.createElement('span');
  host.id = BUTTON_ID;
  // display:contents keeps the wrapper out of YouTube's flex row, so the button lays out
  // exactly as it did when it was appended directly.
  host.style.display = 'contents';
  anchor.appendChild(host);

  triggerRoot = createRoot(host);
  triggerRoot.render(<Trigger />);
}

function ensureDialogHost(): { host: HTMLDivElement; shadow: ShadowRoot } {
  if (dialogHost?.shadowRoot) {
    return { host: dialogHost, shadow: dialogHost.shadowRoot };
  }
  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = dialogCss;
  shadow.appendChild(style);

  const mount = document.createElement('div');
  shadow.appendChild(mount);

  document.body.appendChild(host);
  dialogHost = host;
  dialogRoot = createRoot(mount);
  return { host, shadow };
}

interface Analysis {
  status: 'loading' | 'done' | 'error';
  message: string;
  transcript?: TranscriptResult;
}

// Per-video result cache. Survives dialog close and SPA navigation; the analysis keeps
// running in the background and the result is shown on reopen.
// ponytail: in-memory only — lost on tab reload; use chrome.storage.session if that hurts.
const analyses = new Map<string, Analysis>();
let dialogOpen = false;

function currentVideoId(): string {
  try {
    return new URL(location.href).searchParams.get('v') ?? '';
  } catch {
    return '';
  }
}

function setAnalysis(videoId: string, analysis: Analysis) {
  analyses.set(videoId, analysis);
  if (dialogOpen && currentVideoId() === videoId) renderCurrent();
}

function renderCurrent() {
  const a = analyses.get(currentVideoId());
  render({
    open: dialogOpen,
    status: a?.status ?? 'idle',
    message: a?.message ?? '',
    transcript: a?.transcript,
  });
}

function openDialog() {
  ensureDialogHost();
  dialogOpen = true;
  const videoId = currentVideoId();
  if (analyses.has(videoId)) {
    renderCurrent();
    return;
  }
  void runAnalysis(videoId);
}

function rerunAnalysis() {
  void runAnalysis(currentVideoId());
}

async function runAnalysis(videoId: string) {
  setAnalysis(videoId, { status: 'loading', message: 'Loading transcript…' });

  let transcript: TranscriptResult;
  try {
    transcript = await extractTranscript();
  } catch (err) {
    setAnalysis(videoId, {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  setAnalysis(videoId, {
    status: 'loading',
    message: `Transcript: ${transcript.fullText.length.toLocaleString()} chars. Sending to the model…`,
    transcript,
  });

  const request: RuntimeMessage = {
    type: 'LLM_REQUEST',
    transcript: transcript.fullText.slice(0, MAX_TRANSCRIPT_CHARS),
    videoTitle: transcript.title,
  };

  try {
    const response = await send<LLMResponse>(request);
    if (response.ok && response.content) {
      setAnalysis(videoId, { status: 'done', message: response.content, transcript });
    } else {
      setAnalysis(videoId, {
        status: 'error',
        message: response.error ?? 'Unknown error.',
        transcript,
      });
    }
  } catch (err) {
    setAnalysis(videoId, {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
      transcript,
    });
  }
}

function closeDialog() {
  dialogOpen = false;
  render({ open: false, status: 'idle', message: '' });
}

function openOptions() {
  void send({ type: 'OPEN_OPTIONS' }).catch((err: unknown) => {
    setAnalysis(currentVideoId(), {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
      transcript: analyses.get(currentVideoId())?.transcript,
    });
  });
}

// After an extension reload or update the content script is orphaned in open tabs:
// Chrome strips chrome.runtime, so sendMessage would die with a bare
// "Cannot read properties of undefined". chrome.runtime.id is the liveness check.
const RELOADED = 'The extension was reloaded. Please refresh the page (F5).';

async function send<T>(message: RuntimeMessage): Promise<T> {
  if (!chrome?.runtime?.id) throw new Error(RELOADED);
  try {
    return (await chrome.runtime.sendMessage(message)) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('context invalidated') || msg.includes('Receiving end does not exist')) {
      throw new Error(RELOADED);
    }
    throw err;
  }
}

interface DialogState {
  open: boolean;
  status: 'idle' | 'loading' | 'done' | 'error';
  message: string;
  transcript?: TranscriptResult;
}

function render(state: DialogState) {
  ensureDialogHost();
  dialogRoot?.render(
    <Dialog
      open={state.open}
      status={state.status}
      message={state.message}
      transcript={state.transcript}
      onClose={closeDialog}
      onOpenOptions={openOptions}
      onRetry={rerunAnalysis}
    />,
  );
}

// Polling instead of a MutationObserver: YouTube mutates the DOM constantly, so an
// observer on documentElement/subtree fires thousands of times per minute. ensureButton
// is two DOM lookups and idempotent, so half-second polling covers SPA navigation and
// re-inserts the button whenever a YouTube rerender drops it.
setInterval(ensureButton, 500);

ensureButton();
