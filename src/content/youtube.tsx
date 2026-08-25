import { useState, type CSSProperties } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ChevronDown, Sparkles } from 'lucide-react';
import { Dialog } from './Dialog';
import { extractTranscript } from '../shared/transcript';
import { loadSettings, onSettingsChanged } from '../shared/storage';
import { DEFAULT_SETTINGS, MAX_TRANSCRIPT_CHARS } from '../shared/types';
import type { LLMResponse, PromptPreset, RuntimeMessage, TranscriptResult } from '../shared/types';
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

const MENU_STYLE: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  zIndex: 2300,
  minWidth: '180px',
  padding: '4px 0',
  borderRadius: '8px',
  border: '1px solid var(--yt-spec-10-percent-layer, rgba(128,128,128,0.3))',
  background: 'var(--yt-spec-base-background, #fff)',
  color: 'var(--yt-spec-text-primary, #0f0f0f)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
  display: 'flex',
  flexDirection: 'column',
};

const MENU_ITEM_STYLE: CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: '14px',
  textAlign: 'left',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

function Trigger({ prompts }: { prompts: PromptPreset[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const single = prompts.length <= 1;

  function onTriggerClick() {
    if (single) {
      openDialog(prompts[0].id);
    } else {
      setMenuOpen(!menuOpen);
    }
  }

  function choose(id: string) {
    setMenuOpen(false);
    openDialog(id);
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false);
      }}
    >
      <button
        type="button"
        title="InsightSnap – analyze this video"
        style={TRIGGER_STYLE}
        aria-expanded={single ? undefined : menuOpen}
        onClick={onTriggerClick}
      >
        <Sparkles size={16} />
        InsightSnap
        {!single && <ChevronDown size={14} />}
      </button>
      {menuOpen && (
        <span style={MENU_STYLE} role="menu">
          {prompts.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              style={MENU_ITEM_STYLE}
              onClick={() => choose(p.id)}
            >
              {p.title.trim() || 'Untitled'}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

// The prompt list mirrors the settings so the trigger knows whether to show the picker.
let prompts: PromptPreset[] = DEFAULT_SETTINGS.prompts;

function setPrompts(next: PromptPreset[]) {
  prompts = next;
  if (triggerRoot) triggerRoot.render(<Trigger prompts={prompts} />);
}

void loadSettings().then((s) => setPrompts(s.prompts));
onSettingsChanged((s) => setPrompts(s.prompts));

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
  triggerRoot.render(<Trigger prompts={prompts} />);
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

// Per-video-and-prompt result cache. Survives dialog close and SPA navigation; the
// analysis keeps running in the background and the result is shown on reopen.
// ponytail: in-memory only — lost on tab reload; use chrome.storage.session if that hurts.
const analyses = new Map<string, Analysis>();
let dialogOpen = false;
// The prompt the open dialog belongs to; retry and cache lookups reuse it.
let activePromptId = '';

function currentVideoId(): string {
  try {
    return new URL(location.href).searchParams.get('v') ?? '';
  } catch {
    return '';
  }
}

function analysisKey(videoId: string, promptId: string): string {
  return `${videoId}:${promptId}`;
}

function setAnalysis(key: string, analysis: Analysis) {
  analyses.set(key, analysis);
  if (dialogOpen && analysisKey(currentVideoId(), activePromptId) === key) renderCurrent();
}

function renderCurrent() {
  const a = analyses.get(analysisKey(currentVideoId(), activePromptId));
  render({
    open: dialogOpen,
    status: a?.status ?? 'idle',
    message: a?.message ?? '',
    transcript: a?.transcript,
  });
}

function openDialog(promptId: string) {
  ensureDialogHost();
  dialogOpen = true;
  activePromptId = promptId;
  const videoId = currentVideoId();
  if (analyses.has(analysisKey(videoId, promptId))) {
    renderCurrent();
    return;
  }
  void runAnalysis(videoId, promptId);
}

function rerunAnalysis() {
  void runAnalysis(currentVideoId(), activePromptId);
}

async function runAnalysis(videoId: string, promptId: string) {
  const key = analysisKey(videoId, promptId);
  setAnalysis(key, { status: 'loading', message: 'Loading transcript…' });

  let transcript: TranscriptResult;
  try {
    transcript = await extractTranscript();
  } catch (err) {
    setAnalysis(key, {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  setAnalysis(key, {
    status: 'loading',
    message: `Transcript: ${transcript.fullText.length.toLocaleString()} chars. Sending to the model…`,
    transcript,
  });

  const request: RuntimeMessage = {
    type: 'LLM_REQUEST',
    transcript: transcript.fullText.slice(0, MAX_TRANSCRIPT_CHARS),
    videoTitle: transcript.title,
    promptId,
  };

  try {
    const response = await send<LLMResponse>(request);
    if (response.ok && response.content) {
      setAnalysis(key, { status: 'done', message: response.content, transcript });
    } else {
      setAnalysis(key, {
        status: 'error',
        message: response.error ?? 'Unknown error.',
        transcript,
      });
    }
  } catch (err) {
    setAnalysis(key, {
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
    const key = analysisKey(currentVideoId(), activePromptId);
    setAnalysis(key, {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
      transcript: analyses.get(key)?.transcript,
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
