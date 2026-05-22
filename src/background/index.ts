import { callLLM } from '../shared/llm';
import { loadSettings } from '../shared/storage';
import type { LLMResponse, PlayerResponseResult, RuntimeMessage } from '../shared/types';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[InsightSnap] installed');
});

chrome.action.onClicked.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeMessage,
    sender,
    sendResponse: (resp: LLMResponse | PlayerResponseResult) => void,
  ) => {
    if (message.type === 'OPEN_OPTIONS') {
      void chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'LLM_REQUEST') {
      void handleLLM(message)
        .then((content) => sendResponse({ ok: true, content }))
        .catch((err: unknown) =>
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
        );
      return true;
    }

    if (message.type === 'GET_PLAYER_RESPONSE') {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, error: 'Kein Tab-Kontext.' });
        return false;
      }
      void fetchPlayerResponse(tabId)
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err: unknown) =>
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
        );
      return true;
    }

    return false;
  },
);

async function fetchPlayerResponse(tabId: number): Promise<unknown> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      const w = window as unknown as { ytInitialPlayerResponse?: unknown };
      return w.ytInitialPlayerResponse ?? null;
    },
  });
  const data = results[0]?.result;
  if (!data) throw new Error('window.ytInitialPlayerResponse nicht verfügbar.');
  return data;
}

async function handleLLM(
  message: Extract<RuntimeMessage, { type: 'LLM_REQUEST' }>,
): Promise<string> {
  const settings = await loadSettings();
  const systemPrompt = settings.prompt;
  const userContent =
    `Video-Titel: ${message.videoTitle}\n\n` +
    `Transkript:\n"""\n${message.transcript}\n"""`;
  return callLLM({ settings, systemPrompt, userContent });
}
